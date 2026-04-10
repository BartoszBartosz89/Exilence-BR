import { action, computed, makeObservable, observable } from 'mobx';
import { persist } from 'mobx-persist';
import { v4 as uuidv4 } from 'uuid';
import { INetWorthArchive } from '../interfaces/net-worth-archive.interface';
import { INetWorthArchiveItem } from '../interfaces/net-worth-archive-item.interface';
import { findPriceForItem } from '../utils/price.utils';
import {
  buildDefaultArchiveName,
  createArchiveItemsFromPricedItems,
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

    return archive.items.map((item) => {
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

    const snapshotTotal = archive.items.reduce((sum, item) => sum + item.snapshotTotal, 0);
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

    const archive: INetWorthArchive = {
      uuid: uuidv4(),
      name: buildDefaultArchiveName(sourceLabel),
      createdAt: new Date().toISOString(),
      sourceDate: new Date().toISOString(),
      origin: 'saved',
      pricingModel: settingStore.pricingModel,
      poedbPricingDate: settingStore.poedbPricingDate,
      currency: settingStore.currency,
      sourceLabels: [sourceLabel],
      items: mergeArchiveItems(createArchiveItemsFromPricedItems(items, sourceLabel)),
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

    const items = mergeArchiveItems(parsedFiles.flatMap((entry) => entry.parsed.items));
    const firstDetectedDate = parsedFiles.find((entry) => entry.parsed.detectedDate)?.parsed
      .detectedDate;
    const archive: INetWorthArchive = {
      uuid: uuidv4(),
      name:
        files.length === 1
          ? buildDefaultArchiveName(files[0].name.replace(/\.csv$/i, ''))
          : buildDefaultArchiveName(`Imported ${files.length} files`),
      createdAt: new Date().toISOString(),
      sourceDate: firstDetectedDate || this.toIsoOrUndefined(files[0]?.lastModified),
      origin: 'imported',
      pricingModel: 'traditional',
      poedbPricingDate: undefined,
      currency: this.rootStore.settingStore.currency,
      sourceLabels: files.map((file) => file.name),
      items,
    };

    this.archives.unshift(archive);
    this.activeArchiveId = archive.uuid;
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

    const livePrice = this.rootStore.priceStore.activePricesWithCustomValues || [];
    const matched =
      findPriceForItem(livePrice, item) ||
      livePrice.find((price) => price.name === item.name && price.frameType === item.frameType) ||
      livePrice.find((price) => price.name === item.name);

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
