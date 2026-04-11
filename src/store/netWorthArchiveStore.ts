import { action, computed, makeObservable, observable } from 'mobx';
import { persist } from 'mobx-persist';
import { v4 as uuidv4 } from 'uuid';
import { INetWorthArchive } from '../interfaces/net-worth-archive.interface';
import { INetWorthArchiveItem } from '../interfaces/net-worth-archive-item.interface';
import {
  buildArchiveSourceFromParsedCsv,
  buildArchiveSourceFromPricedItems,
  buildDefaultArchiveName,
  getArchiveSources,
  mergeArchiveItems,
  parseArchiveCsv,
} from '../utils/net-worth-archive.utils';
import { RootStore } from './rootStore';

type ImportedArchiveFile = {
  name: string;
  text: string;
  lastModified?: number;
};

export class NetWorthArchiveStore {
  @persist('list') @observable archives: INetWorthArchive[] = [];
  @persist @observable activeArchiveId?: string = undefined;

  constructor(private rootStore: RootStore) {
    makeObservable(this);
  }

  @computed
  get activeArchive() {
    return this.archives.find((archive) => archive.uuid === this.activeArchiveId);
  }

  @computed
  get activeArchiveItems() {
    const archive = this.activeArchive;
    if (!archive) {
      return [];
    }

    return this.getMergedArchiveItems(archive).map((item) => {
      const liveCalculated = this.getLiveCalculated(item);

      return {
        ...item,
        liveCalculated,
        liveTotal:
          typeof liveCalculated === 'number' ? liveCalculated * (item.stackSize || 0) : undefined,
      };
    });
  }

  @computed
  get activeArchiveTotals() {
    const archive = this.activeArchive;
    if (!archive) {
      return undefined;
    }

    const snapshotTotal = this.activeArchiveItems.reduce(
      (sum, item) => sum + item.snapshotTotal,
      0
    );
    const liveTotal = this.activeArchiveItems.reduce((sum, item) => sum + (item.liveTotal || 0), 0);

    return { snapshotTotal, liveTotal };
  }

  @action
  setActiveArchive(id?: string) {
    this.activeArchiveId = id;
  }

  @action
  saveCurrentNetWorthArchive() {
    const { accountStore, signalrStore, settingStore } = this.rootStore;
    const activeProfile = accountStore.getSelectedAccount.activeProfile;
    const activeGroup = signalrStore.activeGroup;
    const items = activeGroup ? activeGroup.items : activeProfile?.items || [];
    const sourceLabel = activeGroup
      ? activeGroup.name || 'Group snapshot'
      : activeProfile?.name || 'Net worth';
    const createdAt = new Date().toISOString();

    const archive: INetWorthArchive = {
      uuid: uuidv4(),
      name: buildDefaultArchiveName(sourceLabel),
      createdAt,
      currency: settingStore.currency,
      sources: [
        buildArchiveSourceFromPricedItems(items, sourceLabel, {
          createdAt,
          sourceDate: createdAt,
          origin: 'saved',
          pricingModel: settingStore.pricingModel,
          poedbPricingDate: settingStore.poedbPricingDate,
          currency: settingStore.currency,
        }),
      ],
    };

    this.archives.unshift(archive);
    this.activeArchiveId = archive.uuid;
  }

  @action
  importArchiveFiles(files: ImportedArchiveFile[]) {
    const parsedFiles = files.map((file) => ({
      file,
      parsed: parseArchiveCsv(file.text, file.name),
    }));

    const createdAt = new Date().toISOString();
    const archive: INetWorthArchive = {
      uuid: uuidv4(),
      name:
        files.length === 1
          ? buildDefaultArchiveName(files[0].name.replace(/\.csv$/i, ''))
          : buildDefaultArchiveName(`Imported ${files.length} files`),
      createdAt,
      currency: this.rootStore.settingStore.currency,
      sources: parsedFiles.map((entry) =>
        buildArchiveSourceFromParsedCsv(entry.file.name, entry.parsed, {
          createdAt,
          sourceDate: entry.parsed.detectedDate || this.toIsoOrUndefined(entry.file.lastModified),
          currency: this.rootStore.settingStore.currency,
        })
      ),
    };

    this.archives.unshift(archive);
    this.activeArchiveId = archive.uuid;
  }

  @action
  addCurrentSnapshotToArchive(id: string) {
    const archive = this.archives.find((entry) => entry.uuid === id);
    if (!archive) {
      return;
    }

    const { accountStore, signalrStore, settingStore } = this.rootStore;
    const activeProfile = accountStore.getSelectedAccount.activeProfile;
    const activeGroup = signalrStore.activeGroup;
    const items = activeGroup ? activeGroup.items : activeProfile?.items || [];
    const sourceLabel = activeGroup
      ? activeGroup.name || 'Group snapshot'
      : activeProfile?.name || 'Net worth';
    const createdAt = new Date().toISOString();

    archive.sources = [
      ...getArchiveSources(archive),
      buildArchiveSourceFromPricedItems(items, sourceLabel, {
        createdAt,
        sourceDate: createdAt,
        origin: 'saved',
        pricingModel: settingStore.pricingModel,
        poedbPricingDate: settingStore.poedbPricingDate,
        currency: archive.currency,
      }),
    ];
  }

  @action
  addArchiveFilesToArchive(id: string, files: ImportedArchiveFile[]) {
    const archive = this.archives.find((entry) => entry.uuid === id);
    if (!archive || files.length === 0) {
      return;
    }

    const parsedFiles = files.map((file) => ({
      file,
      parsed: parseArchiveCsv(file.text, file.name),
    }));

    const createdAt = new Date().toISOString();
    archive.sources = [
      ...getArchiveSources(archive),
      ...parsedFiles.map((entry) =>
        buildArchiveSourceFromParsedCsv(entry.file.name, entry.parsed, {
          createdAt,
          sourceDate: entry.parsed.detectedDate || this.toIsoOrUndefined(entry.file.lastModified),
          currency: archive.currency,
        })
      ),
    ];
  }

  @action
  deleteArchive(id: string) {
    this.archives = this.archives.filter((archive) => archive.uuid !== id);
    if (this.activeArchiveId === id) {
      this.activeArchiveId = this.archives[0]?.uuid;
    }
  }

  @action
  renameArchive(id: string, name: string) {
    const archive = this.archives.find((entry) => entry.uuid === id);
    const nextName = name.trim();
    if (archive && nextName.length > 0) {
      archive.name = nextName;
    }
  }

  getMergedArchiveItems(archive: INetWorthArchive) {
    return mergeArchiveItems(getArchiveSources(archive).flatMap((source) => source.items));
  }

  private getLiveCalculated(item: INetWorthArchiveItem) {
    if (item.name === 'Chaos Orb') {
      return 1;
    }

    const customPrice = this.rootStore.customPriceStore.findCustomPriceForItem(
      item,
      this.rootStore.accountStore.getSelectedAccount.activeProfile?.activePriceLeagueId || ''
    )?.customPrice;

    if (customPrice && customPrice > 0) {
      return customPrice;
    }

    const matched = this.rootStore.priceStore.getMatchedActivePriceForItem(item);

    if (!matched) {
      return undefined;
    }

    const resolved = this.rootStore.priceStore.resolveEffectivePriceValue(matched);
    return Number.isFinite(resolved) ? resolved : undefined;
  }

  private toIsoOrUndefined(lastModified?: number) {
    return typeof lastModified === 'number' && Number.isFinite(lastModified)
      ? new Date(lastModified).toISOString()
      : undefined;
  }
}
