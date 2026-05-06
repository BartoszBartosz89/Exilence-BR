import { action, computed, makeObservable, observable, reaction, runInAction } from 'mobx';
import { persist } from 'mobx-persist';
import { IExternalPrice } from '../interfaces/external-price.interface';
import { IPoeDbItemMapping } from '../interfaces/poedb-item-mapping.interface';
import { IPoeDbPriceSet, IPoeDbPriceSetExport } from '../interfaces/poedb-price-set.interface';
import { IPoeDbPriceHistoryRow } from '../interfaces/poedb-price-history.interface';
import { IPoeDbUrlHistory } from '../interfaces/poedb-url-history.interface';
import { poeDbService } from '../services/poedb.service';
import type { PricingModel } from './settingStore';
import { RootStore } from './rootStore';
import { v4 as uuidv4 } from 'uuid';

const POEDB_PULL_CONCURRENCY = 2;
const POEDB_PULL_THROTTLE_MS = 40;

export class PoeDbPriceStore {
  @persist('list') @observable mappings: IPoeDbItemMapping[] = [];
  @persist('list') @observable urlHistories: IPoeDbUrlHistory[] = [];
  @persist @observable selectedDate?: string = undefined;
  @persist('list') @observable priceSets: IPoeDbPriceSet[] = [];
  @persist @observable activePriceSetId?: string = undefined;

  @observable resolving: boolean = false;
  @observable pulling: boolean = false;
  @observable resolveProgress: { total: number; done: number; resolved: number } = {
    total: 0,
    done: 0,
    resolved: 0,
  };
  @observable pullProgress: { total: number; done: number; success: number; skipped: number } = {
    total: 0,
    done: 0,
    success: 0,
    skipped: 0,
  };

  @observable error?: string = undefined;
  @observable importExportMessage?: string = undefined;

  private cancelResolve: boolean = false;
  private cancelPull: boolean = false;

  constructor(private rootStore: RootStore) {
    makeObservable(this);
    reaction(
      () => this.sourceItemsSignature,
      () => {
        this.syncMappingsFromPrices();
      },
      { fireImmediately: true }
    );
  }

  @computed
  get sourceItems(): IExternalPrice[] {
    const prices = this.rootStore.priceStore.activePricesWithCustomValues || [];
    const dedup = new Map<string, IExternalPrice>();
    prices.forEach((p) => {
      dedup.set(this.getItemKey(p), p);
    });
    return Array.from(dedup.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  @computed
  get sourceItemsSignature(): string {
    return this.sourceItems.map((item) => this.getItemKey(item)).join('\n');
  }

  @computed
  get availableDates(): string[] {
    const set = new Set<string>();
    this.urlHistories.forEach((entry) => entry.history.forEach((h) => set.add(h.date)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  @computed
  get activePriceSet() {
    return this.priceSets.find((set) => set.uuid === this.activePriceSetId);
  }

  @computed
  get activePriceSetName() {
    return this.activePriceSet?.name || 'PoEDB prices';
  }

  @computed
  get compactRows() {
    const targetDate = this.selectedDate || this.availableDates[this.availableDates.length - 1];
    const historyByUrl = this.historyByUrlMap;

    return this.mappings
      .map((mapping) => {
        const urlHistory = mapping.url ? historyByUrl.get(mapping.url) : undefined;
        const history = urlHistory?.history || [];
        const point = targetDate ? history.find((h) => h.date === targetDate) : undefined;

        return {
          itemKey: mapping.itemKey,
          icon: mapping.icon,
          name: mapping.name,
          status: mapping.status,
          url: mapping.url,
          point,
          rowCount: history.length,
          lastError: mapping.lastError || urlHistory?.lastError,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  @computed
  get hardcodedLinksCount() {
    return poeDbService.getHardcodedLinksCount();
  }

  @computed
  get resolvedRowsCount() {
    return this.mappings.filter((m) => m.status === 'resolved' && !!m.url).length;
  }

  @computed
  get resolvedUniqueUrlCount() {
    const set = new Set<string>();
    this.mappings.forEach((m) => {
      if (m.status === 'resolved' && m.url) {
        set.add(m.url);
      }
    });
    return set.size;
  }

  @computed
  get historyByUrlMap() {
    return new Map(this.urlHistories.map((entry) => [entry.url, entry]));
  }

  @computed
  get mappingsByItemKey() {
    return new Map(this.mappings.map((mapping) => [mapping.itemKey, mapping]));
  }

  @computed
  get mappingsByNormalizedItemKey() {
    const map = new Map<string, IPoeDbItemMapping>();

    this.mappings.forEach((mapping) => {
      const parts = mapping.itemKey.split('|');
      if (parts.length >= 12) {
        const normalizedKey = [...parts.slice(0, 11), ''].join('|');
        if (!map.has(normalizedKey)) {
          map.set(normalizedKey, mapping);
        }
      }
    });

    return map;
  }

  @action
  setSelectedDate(date?: string) {
    this.ensurePriceSetsInitialized();
    this.selectedDate = date;
    this.syncActivePriceSetData();
  }

  @action
  clearStoredSnapshots() {
    this.ensurePriceSetsInitialized();
    this.stopPull();
    this.urlHistories = [];
    this.selectedDate = undefined;
    this.error = undefined;
    this.pullProgress = {
      total: 0,
      done: 0,
      success: 0,
      skipped: 0,
    };
    this.syncActivePriceSetData();
  }

  @action
  createPriceSet(name?: string, copyCurrent: boolean = true) {
    this.ensurePriceSetsInitialized();
    const nowIso = new Date().toISOString();
    const priceSet: IPoeDbPriceSet = {
      uuid: uuidv4(),
      name: this.normalizePriceSetName(name, `PoEDB prices ${this.priceSets.length + 1}`),
      createdAt: nowIso,
      updatedAt: nowIso,
      mappings: copyCurrent ? this.cloneMappings(this.mappings) : [],
      urlHistories: copyCurrent ? this.cloneUrlHistories(this.urlHistories) : [],
      selectedDate: copyCurrent ? this.selectedDate : undefined,
    };

    this.priceSets.push(priceSet);
    this.activatePriceSet(priceSet.uuid);
    this.importExportMessage = `Created price set "${priceSet.name}".`;
  }

  @action
  activatePriceSet(priceSetId: string) {
    this.ensurePriceSetsInitialized();
    const priceSet = this.priceSets.find((set) => set.uuid === priceSetId);
    if (!priceSet) {
      return;
    }

    this.activePriceSetId = priceSet.uuid;
    this.mappings = this.cloneMappings(priceSet.mappings);
    this.urlHistories = this.cloneUrlHistories(priceSet.urlHistories);
    this.selectedDate = priceSet.selectedDate;
    this.error = undefined;
    this.importExportMessage = `Switched to "${priceSet.name}".`;

    this.syncMappingsFromPrices();
  }

  @action
  renamePriceSet(priceSetId: string, name: string) {
    this.ensurePriceSetsInitialized();
    const priceSet = this.priceSets.find((set) => set.uuid === priceSetId);
    if (!priceSet) {
      return;
    }

    priceSet.name = this.normalizePriceSetName(name, priceSet.name);
    priceSet.updatedAt = new Date().toISOString();
    this.importExportMessage = `Renamed price set to "${priceSet.name}".`;
  }

  @action
  deletePriceSet(priceSetId: string) {
    this.ensurePriceSetsInitialized();
    if (this.priceSets.length <= 1) {
      this.error = 'At least one PoEDB price set is required.';
      return;
    }

    const index = this.priceSets.findIndex((set) => set.uuid === priceSetId);
    if (index === -1) {
      return;
    }

    const [removed] = this.priceSets.splice(index, 1);
    if (this.activePriceSetId === priceSetId) {
      const next = this.priceSets[Math.max(0, index - 1)] || this.priceSets[0];
      this.activatePriceSet(next.uuid);
    }
    this.importExportMessage = `Deleted price set "${removed.name}".`;
  }

  buildActivePriceSetExport(): IPoeDbPriceSetExport {
    this.ensurePriceSetsInitialized();
    this.syncActivePriceSetData();
    const active = this.activePriceSet;

    return {
      exportType: 'exilence-poedb-price-set',
      version: 1,
      exportedAt: new Date().toISOString(),
      priceSet: active
        ? this.clonePriceSet(active)
        : this.createPriceSetSnapshot(
            'PoEDB prices',
            this.mappings,
            this.urlHistories,
            this.selectedDate
          ),
    };
  }

  @action
  importPriceSetFromJson(text: string) {
    this.ensurePriceSetsInitialized();

    try {
      const parsed = JSON.parse(text);
      const importedSet = this.parseImportedPriceSet(parsed);
      this.priceSets.push(importedSet);
      this.activatePriceSet(importedSet.uuid);
      this.importExportMessage = `Imported price set "${importedSet.name}".`;
    } catch (e: any) {
      this.error = e?.message || 'Could not import PoEDB price set.';
    }
  }

  getMetricPriceForExternalPrice(
    price: IExternalPrice,
    model: PricingModel,
    selectedDate?: string
  ): number | undefined {
    const url =
      this.getMappedUrlForExternalPrice(price) || poeDbService.getHardcodedUrlForItem(price);
    if (!url) {
      return undefined;
    }

    const history = this.historyByUrlMap.get(url)?.history;
    if (!history || history.length === 0) {
      return undefined;
    }

    const targetDate = selectedDate || this.availableDates[this.availableDates.length - 1];
    const point = targetDate
      ? history.find((entry) => entry.date === targetDate)
      : history[history.length - 1];
    if (!point) {
      return undefined;
    }

    switch (model) {
      case 'poedb_rate':
        return point.rate;
      case 'poedb_open':
        return point.open;
      case 'poedb_close':
        return point.close;
      case 'poedb_low':
        return point.low;
      case 'poedb_high':
        return point.high;
      default:
        return undefined;
    }
  }

  getClosestMetricPriceForExternalPrice(
    price: IExternalPrice,
    model: PricingModel,
    selectedDate?: string
  ): number | undefined {
    const url =
      this.getMappedUrlForExternalPrice(price) || poeDbService.getHardcodedUrlForItem(price);
    if (!url) {
      return undefined;
    }

    const history = this.historyByUrlMap.get(url)?.history;
    if (!history || history.length === 0) {
      return undefined;
    }

    const targetDate = selectedDate || this.availableDates[this.availableDates.length - 1];
    if (!targetDate) {
      return this.getMetricValueForPoint(history[history.length - 1], model);
    }

    const exact = history.find((entry) => entry.date === targetDate);
    if (exact) {
      return this.getMetricValueForPoint(exact, model);
    }

    const previous = [...history].reverse().find((entry) => entry.date < targetDate);
    if (previous) {
      return this.getMetricValueForPoint(previous, model);
    }

    const next = history.find((entry) => entry.date > targetDate);
    if (next) {
      return this.getMetricValueForPoint(next, model);
    }

    return undefined;
  }

  getSparklineDetailsForExternalPrice(
    price: IExternalPrice,
    model: PricingModel,
    selectedDate?: string,
    dayCount: number = 7
  ) {
    const url =
      this.getMappedUrlForExternalPrice(price) || poeDbService.getHardcodedUrlForItem(price);
    if (!url || model === 'traditional') {
      return undefined;
    }

    const history = this.historyByUrlMap.get(url)?.history;
    if (!history || history.length === 0) {
      return undefined;
    }

    const targetDate = selectedDate || this.availableDates[this.availableDates.length - 1];
    const boundedHistory = targetDate
      ? history.filter((entry) => entry.date <= targetDate)
      : [...history];
    const points = boundedHistory.slice(-dayCount).map((entry) => {
      return this.getMetricValueForPoint(entry, model);
    });

    if (points.length < 2 || points.some((value) => !Number.isFinite(value))) {
      return undefined;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const totalChange = first !== 0 ? +(((last - first) / first) * 100).toFixed(2) : 0;

    return {
      data: points,
      totalChange,
    };
  }

  @action
  syncMappingsFromPrices() {
    this.ensurePriceSetsInitialized();
    this.migrateLegacyHistoryToUrlCache();
    const nowIso = new Date().toISOString();

    const next: IPoeDbItemMapping[] = this.sourceItems.map((item) => {
      const hardcodedUrl = poeDbService.getHardcodedUrlForItem(item);
      const resolvedUrl = hardcodedUrl;
      const status = resolvedUrl ? 'resolved' : 'no_match';

      return {
        itemKey: this.getItemKey(item),
        name: item.name,
        icon: item.icon,
        url: resolvedUrl,
        status,
        lastCheckedAt: nowIso,
        lastError: status === 'no_match' ? 'No hardcoded PoEDB link' : undefined,
      };
    });

    this.mappings = next;

    if (this.availableDates.length > 0 && !this.selectedDate) {
      this.selectedDate = this.availableDates[this.availableDates.length - 1];
    }

    this.syncActivePriceSetData();
  }

  @action
  stopResolve() {
    this.cancelResolve = true;
  }

  @action
  stopPull() {
    this.cancelPull = true;
  }

  @action
  async resolveLinksForAllItems() {
    this.error = undefined;
    this.resolving = true;
    this.cancelResolve = false;

    this.syncMappingsFromPrices();

    const total = this.mappings.length;
    const resolved = this.mappings.filter((m) => m.status === 'resolved').length;
    this.resolveProgress = { total, done: total, resolved };

    runInAction(() => {
      this.resolving = false;
    });
  }

  @action
  async pullHistoryForResolvedItems(force: boolean = false) {
    this.error = undefined;
    this.pulling = true;
    this.cancelPull = false;
    this.migrateLegacyHistoryToUrlCache();

    const targets = this.mappings.filter((m) => m.url && m.status === 'resolved');
    const uniqueUrls = Array.from(new Set(targets.map((mapping) => mapping.url as string)));

    const today = this.getTodayDateKey();
    const urlsToFetch = uniqueUrls.filter((url) => {
      if (force) {
        return true;
      }
      const existing = this.historyByUrlMap.get(url);
      return this.needsHistoryRefresh(existing?.history, today);
    });

    this.pullProgress = {
      total: urlsToFetch.length,
      done: 0,
      success: 0,
      skipped: uniqueUrls.length - urlsToFetch.length,
    };

    await this.runWithConcurrency(urlsToFetch, POEDB_PULL_CONCURRENCY, async (url) => {
      if (this.cancelPull) {
        return;
      }

      try {
        const incomingHistory = await poeDbService.fetchHistoryFromUrl(url);

        runInAction(() => {
          this.upsertUrlHistory(url, incomingHistory, undefined);
          this.pullProgress.success++;
          this.pullProgress.done++;
        });
      } catch (e: any) {
        runInAction(() => {
          this.upsertUrlHistory(url, undefined, e?.message || 'Pull failed');
          this.pullProgress.done++;
        });
      }

      await this.delay(POEDB_PULL_THROTTLE_MS);
    });

    runInAction(() => {
      this.pulling = false;
      if (this.availableDates.length > 0) {
        this.selectedDate = this.availableDates[this.availableDates.length - 1];
      }
      this.syncActivePriceSetData();
    });
  }

  @action
  async pullHistoryForUrl(url: string, force: boolean = true) {
    if (!url) {
      return;
    }

    this.error = undefined;
    this.pulling = true;
    this.cancelPull = false;
    this.migrateLegacyHistoryToUrlCache();
    this.pullProgress = {
      total: 1,
      done: 0,
      success: 0,
      skipped: 0,
    };

    try {
      const existing = this.historyByUrlMap.get(url);
      const shouldFetch =
        force || this.needsHistoryRefresh(existing?.history, this.getTodayDateKey());

      if (!shouldFetch) {
        runInAction(() => {
          this.pullProgress.done = 1;
          this.pullProgress.skipped = 1;
          this.pulling = false;
          this.syncActivePriceSetData();
        });
        return;
      }

      const incomingHistory = await poeDbService.fetchHistoryFromUrl(url);

      runInAction(() => {
        this.upsertUrlHistory(url, incomingHistory, undefined);
        this.pullProgress.success = 1;
        this.pullProgress.done = 1;
        this.pulling = false;
        if (this.availableDates.length > 0) {
          this.selectedDate = this.availableDates[this.availableDates.length - 1];
        }
        this.syncActivePriceSetData();
      });
    } catch (e: any) {
      runInAction(() => {
        this.upsertUrlHistory(url, undefined, e?.message || 'Pull failed');
        this.pullProgress.done = 1;
        this.pulling = false;
        this.error = e?.message || 'Pull failed';
        this.syncActivePriceSetData();
      });
    }
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
  ) {
    let index = 0;

    const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (index < items.length) {
        const currentIndex = index;
        index++;
        await worker(items[currentIndex]);
      }
    });

    await Promise.all(runners);
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  }

  private getTodayDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private needsHistoryRefresh(history: IPoeDbPriceHistoryRow[] | undefined, today: string) {
    if (!history || history.length === 0) {
      return true;
    }
    const latest = history.reduce((acc, row) => (row.date > acc ? row.date : acc), history[0].date);
    return latest < today;
  }

  private mergeHistoryRows(
    existing: IPoeDbPriceHistoryRow[] | undefined,
    incoming: IPoeDbPriceHistoryRow[]
  ): IPoeDbPriceHistoryRow[] {
    const byDate = new Map<string, IPoeDbPriceHistoryRow>();
    (existing || []).forEach((row) => byDate.set(row.date, row));
    incoming.forEach((row) => byDate.set(row.date, row));

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private upsertUrlHistory(
    url: string,
    incomingHistory?: IPoeDbPriceHistoryRow[],
    lastError?: string
  ) {
    const existing = this.urlHistories.find((entry) => entry.url === url);
    const fetchedAt = new Date().toISOString();

    if (existing) {
      if (incomingHistory) {
        existing.history = this.mergeHistoryRows(existing.history, incomingHistory);
        existing.historyFetchedAt = fetchedAt;
        existing.lastError = undefined;
      } else if (lastError) {
        existing.lastError = lastError;
      }
      return;
    }

    this.urlHistories.push({
      url,
      history: incomingHistory || [],
      historyFetchedAt: incomingHistory ? fetchedAt : undefined,
      lastError,
    });
  }

  private migrateLegacyHistoryToUrlCache() {
    const staleMappings = this.mappings.filter((m) => m.url && m.history && m.history.length > 0);
    if (staleMappings.length === 0) {
      return;
    }

    staleMappings.forEach((mapping) => {
      this.upsertUrlHistory(mapping.url as string, mapping.history, undefined);
      mapping.history = undefined;
      mapping.historyFetchedAt = undefined;
    });
  }

  @action
  ensurePriceSetsInitialized() {
    if (!Array.isArray(this.mappings)) {
      this.mappings = [];
    }
    if (!Array.isArray(this.urlHistories)) {
      this.urlHistories = [];
    }
    if (!Array.isArray(this.priceSets)) {
      this.priceSets = [];
    }

    if (this.priceSets.length > 0) {
      if (
        !this.activePriceSetId ||
        !this.priceSets.some((set) => set.uuid === this.activePriceSetId)
      ) {
        this.activePriceSetId = this.priceSets[0].uuid;
      }
      const activeSet = this.priceSets.find((set) => set.uuid === this.activePriceSetId);
      if (activeSet && activeSet.urlHistories.length === 0 && this.urlHistories.length > 0) {
        this.syncActivePriceSetData();
      }
      return;
    }

    const nowIso = new Date().toISOString();
    const initialSet: IPoeDbPriceSet = {
      uuid: uuidv4(),
      name: 'Default PoEDB prices',
      createdAt: nowIso,
      updatedAt: nowIso,
      mappings: this.cloneMappings(this.mappings),
      urlHistories: this.cloneUrlHistories(this.urlHistories),
      selectedDate: this.selectedDate,
    };
    this.priceSets = [initialSet];
    this.activePriceSetId = initialSet.uuid;
  }

  private syncActivePriceSetData() {
    if (!this.activePriceSetId) {
      return;
    }

    const priceSet = this.priceSets.find((set) => set.uuid === this.activePriceSetId);
    if (!priceSet) {
      return;
    }

    priceSet.mappings = this.cloneMappings(this.mappings);
    priceSet.urlHistories = this.cloneUrlHistories(this.urlHistories);
    priceSet.selectedDate = this.selectedDate;
    priceSet.updatedAt = new Date().toISOString();
  }

  private cloneMappings(mappings: IPoeDbItemMapping[]) {
    return mappings.map((mapping) => ({
      ...mapping,
      history: mapping.history ? this.cloneHistoryRows(mapping.history) : undefined,
    }));
  }

  private cloneUrlHistories(histories: IPoeDbUrlHistory[]) {
    return histories.map((entry) => ({
      ...entry,
      history: this.cloneHistoryRows(entry.history || []),
    }));
  }

  private cloneHistoryRows(history: IPoeDbPriceHistoryRow[]) {
    return history.map((row) => ({ ...row }));
  }

  private clonePriceSet(priceSet: IPoeDbPriceSet): IPoeDbPriceSet {
    return {
      ...priceSet,
      mappings: this.cloneMappings(priceSet.mappings || []),
      urlHistories: this.cloneUrlHistories(priceSet.urlHistories || []),
    };
  }

  private createPriceSetSnapshot(
    name: string,
    mappings: IPoeDbItemMapping[],
    urlHistories: IPoeDbUrlHistory[],
    selectedDate?: string
  ): IPoeDbPriceSet {
    const nowIso = new Date().toISOString();
    return {
      uuid: uuidv4(),
      name,
      createdAt: nowIso,
      updatedAt: nowIso,
      mappings: this.cloneMappings(mappings),
      urlHistories: this.cloneUrlHistories(urlHistories),
      selectedDate,
    };
  }

  private parseImportedPriceSet(parsed: any): IPoeDbPriceSet {
    const rawSet =
      parsed?.exportType === 'exilence-poedb-price-set'
        ? parsed.priceSet
        : parsed?.priceSet || parsed;
    if (!rawSet || !Array.isArray(rawSet.urlHistories)) {
      throw new Error('Selected file is not a valid PoEDB price set export.');
    }

    const nowIso = new Date().toISOString();
    return {
      uuid: uuidv4(),
      name: this.normalizePriceSetName(
        rawSet.name,
        `Imported PoEDB prices ${this.priceSets.length + 1}`
      ),
      createdAt: typeof rawSet.createdAt === 'string' ? rawSet.createdAt : nowIso,
      updatedAt: nowIso,
      mappings: Array.isArray(rawSet.mappings) ? this.cloneMappings(rawSet.mappings) : [],
      urlHistories: this.sanitizeImportedHistories(rawSet.urlHistories),
      selectedDate: typeof rawSet.selectedDate === 'string' ? rawSet.selectedDate : undefined,
    };
  }

  private sanitizeImportedHistories(histories: any[]): IPoeDbUrlHistory[] {
    return histories
      .filter((entry) => typeof entry?.url === 'string' && Array.isArray(entry.history))
      .map((entry) => ({
        url: entry.url,
        history: entry.history
          .filter((row: any) => typeof row?.date === 'string')
          .map((row: any) => ({
            date: row.date,
            open: Number(row.open) || 0,
            close: Number(row.close) || 0,
            low: Number(row.low) || 0,
            high: Number(row.high) || 0,
            rate: Number(row.rate) || 0,
            volume: Number(row.volume) || 0,
          }))
          .sort((a: IPoeDbPriceHistoryRow, b: IPoeDbPriceHistoryRow) =>
            a.date.localeCompare(b.date)
          ),
        historyFetchedAt:
          typeof entry.historyFetchedAt === 'string' ? entry.historyFetchedAt : undefined,
        lastError: typeof entry.lastError === 'string' ? entry.lastError : undefined,
      }));
  }

  private normalizePriceSetName(name: string | undefined, fallback: string) {
    const trimmed = (name || '').trim();
    return trimmed || fallback;
  }

  getMappedUrlForExternalPrice(
    price: Pick<
      IExternalPrice,
      | 'name'
      | 'quality'
      | 'links'
      | 'level'
      | 'corrupted'
      | 'frameType'
      | 'variant'
      | 'elder'
      | 'shaper'
      | 'ilvl'
      | 'tier'
      | 'icon'
    >
  ) {
    const mapping = this.findMappingForPrice(price);
    return mapping?.url;
  }

  private getMetricValueForPoint(point: IPoeDbPriceHistoryRow, model: PricingModel): number {
    switch (model) {
      case 'poedb_rate':
        return point.rate;
      case 'poedb_open':
        return point.open;
      case 'poedb_close':
        return point.close;
      case 'poedb_low':
        return point.low;
      case 'poedb_high':
        return point.high;
      default:
        return 0;
    }
  }

  private findMappingForPrice(
    price: Pick<
      IExternalPrice,
      | 'name'
      | 'quality'
      | 'links'
      | 'level'
      | 'corrupted'
      | 'frameType'
      | 'variant'
      | 'elder'
      | 'shaper'
      | 'ilvl'
      | 'tier'
      | 'icon'
    >
  ) {
    const exactKey = this.getItemKey(price);
    const exactMatch = this.mappingsByItemKey.get(exactKey);
    if (exactMatch) {
      return exactMatch;
    }

    const keyWithoutIcon = this.getItemKey({
      ...price,
      icon: '',
    });

    return this.mappingsByNormalizedItemKey.get(keyWithoutIcon);
  }

  private getItemKey(
    item: Pick<
      IExternalPrice,
      | 'name'
      | 'quality'
      | 'links'
      | 'level'
      | 'corrupted'
      | 'frameType'
      | 'variant'
      | 'elder'
      | 'shaper'
      | 'ilvl'
      | 'tier'
      | 'icon'
    >
  ) {
    return [
      item.name,
      item.quality ?? 0,
      item.links ?? 0,
      item.level ?? 0,
      item.corrupted ? 1 : 0,
      item.frameType ?? 0,
      item.variant || '',
      item.elder ? 1 : 0,
      item.shaper ? 1 : 0,
      item.ilvl ?? 0,
      item.tier ?? 0,
      item.icon || '',
    ].join('|');
  }
}
