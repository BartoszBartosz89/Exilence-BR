import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { persist } from 'mobx-persist';
import { IExternalPrice } from '../interfaces/external-price.interface';
import { IPoeDbItemMapping } from '../interfaces/poedb-item-mapping.interface';
import { IPoeDbPriceHistoryRow } from '../interfaces/poedb-price-history.interface';
import { IPoeDbUrlHistory } from '../interfaces/poedb-url-history.interface';
import { poeDbService } from '../services/poedb.service';
import { RootStore } from './rootStore';

const POEDB_PULL_CONCURRENCY = 1;
const POEDB_PULL_THROTTLE_MS = 40;

export class PoeDbPriceStore {
  @persist('list') @observable mappings: IPoeDbItemMapping[] = [];
  @persist('list') @observable urlHistories: IPoeDbUrlHistory[] = [];
  @persist @observable selectedDate?: string = undefined;

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

  private cancelResolve: boolean = false;
  private cancelPull: boolean = false;

  constructor(private rootStore: RootStore) {
    makeObservable(this);
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
  get availableDates(): string[] {
    const set = new Set<string>();
    this.urlHistories.forEach((entry) => entry.history.forEach((h) => set.add(h.date)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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

  @action
  setSelectedDate(date?: string) {
    this.selectedDate = date;
  }

  @action
  syncMappingsFromPrices() {
    this.migrateLegacyHistoryToUrlCache();

    const existing = new Map(this.mappings.map((m) => [m.itemKey, m]));
    const nowIso = new Date().toISOString();

    const next: IPoeDbItemMapping[] = this.sourceItems.map((item) => {
      const key = this.getItemKey(item);
      const found = existing.get(key);
      const hardcodedUrl = poeDbService.getHardcodedUrlForItem(item);
      const resolvedUrl = hardcodedUrl || found?.url;
      const status = resolvedUrl ? 'resolved' : 'no_match';

      return {
        itemKey: key,
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
    });
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

  private upsertUrlHistory(url: string, incomingHistory?: IPoeDbPriceHistoryRow[], lastError?: string) {
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

  private get historyByUrlMap() {
    return new Map(this.urlHistories.map((entry) => [entry.url, entry]));
  }

  private getItemKey(item: IExternalPrice) {
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
