import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { persist } from 'mobx-persist';
import { v4 as uuidv4 } from 'uuid';
import { IConnectionChartSeries } from '../interfaces/connection-chart-series.interface';
import { INetWorthArchiveItem } from '../interfaces/net-worth-archive-item.interface';
import { IStrategyReviewerAnalysis } from '../interfaces/strategy-reviewer-analysis.interface';
import { IStrategyReviewerCostItem } from '../interfaces/strategy-reviewer-cost.interface';
import { IStrategyReviewerPoint } from '../interfaces/strategy-reviewer-point.interface';
import { IStrategyReviewerStrategy } from '../interfaces/strategy-reviewer-strategy.interface';
import { IExternalPrice } from '../interfaces/external-price.interface';
import { RootStore } from './rootStore';

export class StrategyReviewerStore {
  @persist('list') @observable analyses: IStrategyReviewerAnalysis[] = [];
  @persist @observable activeAnalysisId?: string = undefined;
  @persist('list') @observable legacyStrategies: IStrategyReviewerStrategy[] = [];
  @persist @observable legacyRangeStartDate?: string = undefined;
  @persist @observable legacyRangeEndDate?: string = undefined;
  @observable recalculating: boolean = false;

  constructor(private rootStore: RootStore) {
    makeObservable(this);
  }

  @computed
  get activeAnalysis() {
    this.ensureMigrated();
    return this.analyses.find((analysis) => analysis.uuid === this.activeAnalysisId);
  }

  @computed
  get availableCostItems() {
    const byKey = new Map<string, IExternalPrice>();

    (this.rootStore.priceStore.activePricesWithCustomValues || []).forEach((price) => {
      const key = this.getPriceLookupKey(price);
      if (!byKey.has(key)) {
        byKey.set(key, price);
      }
    });

    return Array.from(byKey.values()).sort((a, b) =>
      this.getCostItemLabel(a).localeCompare(this.getCostItemLabel(b))
    );
  }

  @computed
  get availableRangeDates() {
    return this.rootStore.poeDbPriceStore.availableDates;
  }

  @computed
  get effectiveRangeStartDate() {
    this.ensureMigrated();
    if (
      this.activeAnalysis?.rangeStartDate &&
      this.availableRangeDates.includes(this.activeAnalysis.rangeStartDate)
    ) {
      return this.activeAnalysis.rangeStartDate;
    }

    return this.availableRangeDates[0];
  }

  @computed
  get effectiveRangeEndDate() {
    this.ensureMigrated();
    if (
      this.activeAnalysis?.rangeEndDate &&
      this.availableRangeDates.includes(this.activeAnalysis.rangeEndDate)
    ) {
      return this.activeAnalysis.rangeEndDate;
    }

    return this.availableRangeDates[this.availableRangeDates.length - 1];
  }

  @computed
  get filteredStrategies() {
    this.ensureMigrated();
    const start = this.effectiveRangeStartDate;
    const end = this.effectiveRangeEndDate;
    const strategies = this.activeAnalysis?.strategies || [];

    return strategies.map((strategy) => ({
      ...strategy,
      filteredPoints: strategy.cachedPoints.filter((point) => {
        if (start && point.date < start) {
          return false;
        }
        if (end && point.date > end) {
          return false;
        }

        return true;
      }),
    }));
  }

  @computed
  get chartSeries(): IConnectionChartSeries[] {
    return this.buildSeriesFromPointValue((point) => this.getPointProfitPerMap(point));
  }

  @computed
  get profitPerHourChartSeries(): IConnectionChartSeries[] {
    return this.buildSeriesFromPointValue((point) => this.getPointProfitPerHour(point));
  }

  private buildSeriesFromPointValue(getValue: (point: IStrategyReviewerPoint) => number) {
    return this.filteredStrategies
      .filter((strategy) => strategy.filteredPoints.length > 0)
      .map((strategy) => ({
        seriesName: strategy.name,
        series: strategy.filteredPoints.map((point) => [
          new Date(point.date).getTime(),
          +getValue(point).toFixed(2),
        ]),
      }));
  }

  @computed
  get summaryRows() {
    this.ensureMigrated();
    return this.filteredStrategies
      .map((strategy) => {
        const latest = strategy.filteredPoints[strategy.filteredPoints.length - 1];
        return {
          uuid: strategy.uuid,
          name: strategy.name,
          archiveName:
            this.rootStore.netWorthArchiveStore.archives.find((a) => a.uuid === strategy.archiveId)
              ?.name || 'No archive',
          pointCount: strategy.filteredPoints.length,
          grossValue: latest?.grossValue || 0,
          costValue: latest?.costValue || 0,
          profitValue: latest?.profitValue || 0,
          grossPerMap:
            latest && typeof latest.grossPerMap === 'number'
              ? latest.grossPerMap
              : (latest?.grossValue || 0) / Math.max(1, latest?.mapCount || 1),
          costPerMap:
            latest && typeof latest.costPerMap === 'number'
              ? latest.costPerMap
              : (latest?.costValue || 0) / Math.max(1, latest?.mapCount || 1),
          profitPerMap:
            latest && typeof latest.profitPerMap === 'number'
              ? latest.profitPerMap
              : (latest?.profitValue || 0) / Math.max(1, latest?.mapCount || 1),
          grossPerHour: latest ? this.getPointGrossPerHour(latest) : 0,
          costPerHour: latest ? this.getPointCostPerHour(latest) : 0,
          profitPerHour: latest ? this.getPointProfitPerHour(latest) : 0,
          mapCount:
            latest?.mapCount ||
            this.getEffectiveMapCount(
              strategy,
              this.rootStore.netWorthArchiveStore.archives.find(
                (archive) => archive.uuid === strategy.archiveId
              )
            ),
          clearTimeMinutes: latest?.clearTimeMinutes || this.getEffectiveClearTimeMinutes(strategy),
          averageDivinePrice: this.getAverageDivinePrice(strategy.filteredPoints),
          latestDate: latest?.date,
        };
      })
      .sort((a, b) => b.profitPerMap - a.profitPerMap);
  }

  @action
  setRangeStartDate(date?: string) {
    this.ensureMigrated();
    if (!this.activeAnalysis) {
      return;
    }

    this.activeAnalysis.rangeStartDate = date || undefined;

    if (
      this.activeAnalysis.rangeStartDate &&
      this.activeAnalysis.rangeEndDate &&
      this.activeAnalysis.rangeStartDate > this.activeAnalysis.rangeEndDate
    ) {
      this.activeAnalysis.rangeEndDate = this.activeAnalysis.rangeStartDate;
    }
  }

  @action
  setRangeEndDate(date?: string) {
    this.ensureMigrated();
    if (!this.activeAnalysis) {
      return;
    }

    this.activeAnalysis.rangeEndDate = date || undefined;

    if (
      this.activeAnalysis.rangeStartDate &&
      this.activeAnalysis.rangeEndDate &&
      this.activeAnalysis.rangeEndDate < this.activeAnalysis.rangeStartDate
    ) {
      this.activeAnalysis.rangeStartDate = this.activeAnalysis.rangeEndDate;
    }
  }

  @action
  resetRangeDates() {
    this.ensureMigrated();
    if (!this.activeAnalysis) {
      return;
    }
    this.activeAnalysis.rangeStartDate = undefined;
    this.activeAnalysis.rangeEndDate = undefined;
  }

  @action
  setActiveAnalysis(id?: string) {
    this.ensureMigrated();
    this.activeAnalysisId = id;
  }

  @action
  addAnalysis(name?: string) {
    this.ensureMigrated();
    const analysis: IStrategyReviewerAnalysis = {
      uuid: uuidv4(),
      name: (name || `Analysis ${this.analyses.length + 1}`).trim(),
      createdAt: new Date().toISOString(),
      strategies: [],
    };

    this.analyses.push(analysis);
    this.activeAnalysisId = analysis.uuid;
    return analysis;
  }

  @action
  renameAnalysis(id: string, name: string) {
    this.ensureMigrated();
    const analysis = this.analyses.find((entry) => entry.uuid === id);
    const nextName = name.trim();
    if (analysis && nextName) {
      analysis.name = nextName;
    }
  }

  @action
  deleteAnalysis(id: string) {
    this.ensureMigrated();
    this.analyses = this.analyses.filter((analysis) => analysis.uuid !== id);
    if (this.activeAnalysisId === id) {
      this.activeAnalysisId = this.analyses[0]?.uuid;
    }
  }

  @action
  addStrategy() {
    this.ensureMigrated();
    const analysis = this.activeAnalysis || this.addAnalysis();
    const firstArchiveId = this.rootStore.netWorthArchiveStore.archives[0]?.uuid;
    const strategy: IStrategyReviewerStrategy = {
      uuid: uuidv4(),
      name: `Strategy ${analysis.strategies.length + 1}`,
      archiveId: firstArchiveId,
      clearTimeMinutes: 3,
      collapsed: false,
      costItems: [],
      cachedPoints: [],
    };

    analysis.strategies.push(strategy);
    if (strategy.archiveId) {
      void this.refreshStrategy(strategy.uuid);
    }
  }

  @action
  removeStrategy(id: string) {
    this.ensureMigrated();
    if (!this.activeAnalysis) {
      return;
    }
    this.activeAnalysis.strategies = this.activeAnalysis.strategies.filter(
      (strategy) => strategy.uuid !== id
    );
  }

  @action
  renameStrategy(id: string, name: string) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === id);
    const nextName = name.trim();
    if (strategy && nextName) {
      strategy.name = nextName;
    }
  }

  @action
  setStrategyMapCountOverride(id: string, mapCount?: number) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === id);
    if (!strategy) {
      return;
    }

    if (typeof mapCount !== 'number' || !Number.isFinite(mapCount)) {
      strategy.mapCountOverride = undefined;
    } else {
      strategy.mapCountOverride = Math.max(1, Math.floor(mapCount));
    }

    strategy.cachedPoints = [];
    strategy.calculationSignature = undefined;
    void this.refreshStrategy(strategy.uuid);
  }

  @action
  setStrategyClearTimeMinutes(id: string, clearTimeMinutes?: number) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === id);
    if (!strategy) {
      return;
    }

    if (typeof clearTimeMinutes !== 'number' || !Number.isFinite(clearTimeMinutes)) {
      strategy.clearTimeMinutes = undefined;
    } else {
      strategy.clearTimeMinutes = Math.max(0.1, clearTimeMinutes);
    }

    strategy.cachedPoints = [];
    strategy.calculationSignature = undefined;
    void this.refreshStrategy(strategy.uuid);
  }

  @action
  toggleStrategyCollapsed(id: string) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === id);
    if (!strategy) {
      return;
    }

    strategy.collapsed = !strategy.collapsed;
  }

  @action
  setArchiveForStrategy(id: string, archiveId?: string) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === id);
    if (!strategy) {
      return;
    }

    strategy.archiveId = archiveId;
    strategy.cachedPoints = [];
    strategy.calculationSignature = undefined;
    void this.refreshStrategy(strategy.uuid);
  }

  @action
  addCostItem(id: string, price: IExternalPrice) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === id);
    if (!strategy || strategy.costItems.length >= 20) {
      return;
    }

    const existing = strategy.costItems.find(
      (item) => this.getCostLookupKey(item) === this.getPriceLookupKey(price)
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      strategy.costItems.push({
        uuid: uuidv4(),
        name: price.name,
        icon: price.icon,
        quantity: 1,
        calculated: price.calculated,
        frameType: price.frameType,
        variant: price.variant,
        elder: price.elder,
        shaper: price.shaper,
        links: price.links,
        quality: price.quality,
        ilvl: price.ilvl,
        level: price.level,
        corrupted: price.corrupted,
        tier: price.tier,
        detailsUrl: price.detailsUrl,
        customPrice: price.customPrice,
      });
    }

    strategy.cachedPoints = [];
    strategy.calculationSignature = undefined;
    void this.refreshStrategy(strategy.uuid);
  }

  @action
  updateCostQuantity(strategyId: string, costId: string, quantity: number) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === strategyId);
    const costItem = strategy?.costItems.find((item) => item.uuid === costId);
    if (!costItem) {
      return;
    }

    costItem.quantity = Math.max(0, quantity);
    strategy!.costItems = strategy!.costItems.filter((item) => item.quantity > 0);
    strategy!.cachedPoints = [];
    strategy!.calculationSignature = undefined;
    void this.refreshStrategy(strategyId);
  }

  @action
  removeCostItem(strategyId: string, costId: string) {
    this.ensureMigrated();
    const strategy = this.activeAnalysis?.strategies.find((entry) => entry.uuid === strategyId);
    if (!strategy) {
      return;
    }

    strategy.costItems = strategy.costItems.filter((item) => item.uuid !== costId);
    strategy.cachedPoints = [];
    strategy.calculationSignature = undefined;
    void this.refreshStrategy(strategyId);
  }

  @action
  async refreshAllStrategies() {
    this.ensureMigrated();
    if (this.recalculating) {
      return;
    }

    this.recalculating = true;

    try {
      for (const analysis of this.analyses) {
        for (const strategy of analysis.strategies) {
          await this.refreshStrategy(strategy.uuid);
        }
      }
    } finally {
      runInAction(() => {
        this.recalculating = false;
      });
    }
  }

  @action
  async refreshStrategy(id: string) {
    this.ensureMigrated();
    const strategy = this.analyses
      .flatMap((analysis) => analysis.strategies)
      .find((entry) => entry.uuid === id);
    if (!strategy || !strategy.archiveId) {
      return;
    }

    const archive = this.rootStore.netWorthArchiveStore.archives.find(
      (entry) => entry.uuid === strategy.archiveId
    );
    if (!archive) {
      strategy.cachedPoints = [];
      strategy.calculationSignature = undefined;
      return;
    }

    const archiveItems = this.rootStore.netWorthArchiveStore.getMergedArchiveItems(archive);
    const availableDates = this.getRelevantDates(archive);
    const baseSignature = this.buildSignature(strategy, archive);

    const existingPointMap =
      strategy.calculationSignature === baseSignature
        ? new Map(strategy.cachedPoints.map((point) => [point.date, point]))
        : new Map<string, IStrategyReviewerPoint>();

    const pointsToKeep = availableDates
      .map((date) => existingPointMap.get(date))
      .filter((point): point is IStrategyReviewerPoint => !!point);

    const missingDates = availableDates.filter((date) => !existingPointMap.has(date));
    const priceCache = new Map<string, number>();

    const mapCount = this.getEffectiveMapCount(strategy, archive);
    const clearTimeMinutes = this.getEffectiveClearTimeMinutes(strategy);
    const newPoints = missingDates.map((date) =>
      this.calculatePointForDate(
        strategy.costItems,
        archiveItems,
        mapCount,
        clearTimeMinutes,
        date,
        priceCache
      )
    );

    strategy.cachedPoints = [...pointsToKeep, ...newPoints].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    strategy.calculationSignature = baseSignature;
    strategy.cachedAt = new Date().toISOString();
  }

  private calculatePointForDate(
    costItems: IStrategyReviewerCostItem[],
    archiveItems: INetWorthArchiveItem[],
    mapCount: number,
    clearTimeMinutes: number,
    date: string,
    priceCache: Map<string, number>
  ): IStrategyReviewerPoint {
    const grossValue = archiveItems.reduce((sum, item) => {
      return sum + this.resolveHistoricalPrice(item, date, priceCache) * (item.stackSize || 0);
    }, 0);

    const costPerMap = costItems.reduce(
      (sum, item) => sum + this.resolveHistoricalPrice(item, date, priceCache) * (item.quantity || 0),
      0
    );
    const costValue = costPerMap * mapCount;
    const profitValue = grossValue - costValue;
    const grossPerMap = grossValue / mapCount;
    const profitPerMap = profitValue / mapCount;
    const mapsPerHour = 60 / clearTimeMinutes;
    const grossPerHour = grossPerMap * mapsPerHour;
    const costPerHour = costPerMap * mapsPerHour;
    const profitPerHour = profitPerMap * mapsPerHour;
    const divinePrice = this.resolveDivinePriceForDate(date, priceCache);

    return {
      date,
      grossValue,
      costValue,
      profitValue,
      grossPerMap,
      costPerMap,
      profitPerMap,
      grossPerHour,
      costPerHour,
      profitPerHour,
      mapCount,
      clearTimeMinutes,
      divinePrice,
    };
  }

  private resolveHistoricalPrice(
    item: Pick<
      INetWorthArchiveItem | IStrategyReviewerCostItem,
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
      | 'calculated'
      | 'customPrice'
    > & { snapshotCalculated?: number },
    date: string,
    priceCache: Map<string, number>
  ) {
    const cacheKey = `${date}|${this.getCostLookupKey(item)}`;
    const cached = priceCache.get(cacheKey);
    if (typeof cached === 'number') {
      return cached;
    }

    let value = 0;
    if (item.name === 'Chaos Orb') {
      value = 1;
    } else {
      const customPrice = this.rootStore.customPriceStore.findCustomPriceForItem(
        item as any,
        this.rootStore.accountStore.getSelectedAccount.activeProfile?.activePriceLeagueId || ''
      )?.customPrice;

      if (customPrice && customPrice > 0) {
        value = customPrice;
      } else {
        const matched = this.rootStore.priceStore.getMatchedActivePriceForItem(item as any);
        if (matched && this.rootStore.settingStore.pricingModel !== 'traditional') {
          const poedbValue = this.rootStore.poeDbPriceStore.getClosestMetricPriceForExternalPrice(
            matched,
            this.rootStore.settingStore.pricingModel,
            date
          );
          if (typeof poedbValue === 'number' && Number.isFinite(poedbValue)) {
            value = poedbValue;
          }
        }

        if (!value && matched) {
          value =
            (matched.customPrice && matched.customPrice > 0 ? matched.customPrice : 0) ||
            matched.calculated ||
            0;
        }

        if (!value && typeof item.snapshotCalculated === 'number') {
          value = item.snapshotCalculated;
        }

        if (!value && typeof item.calculated === 'number') {
          value = item.calculated;
        }
      }
    }

    priceCache.set(cacheKey, value);
    return value;
  }

  private getRelevantDates(_archive: { createdAt: string; sources?: { sourceDate?: string }[] }) {
    const allDates = this.rootStore.poeDbPriceStore.availableDates;
    if (allDates.length === 0) {
      return [];
    }

    return allDates;
  }

  getEffectiveMapCount(
    strategy: Pick<IStrategyReviewerStrategy, 'mapCountOverride' | 'archiveId'>,
    archiveArg?: { uuid: string; mapCount?: number }
  ) {
    if (typeof strategy.mapCountOverride === 'number' && Number.isFinite(strategy.mapCountOverride)) {
      return Math.max(1, Math.floor(strategy.mapCountOverride));
    }

    const archive =
      archiveArg ||
      this.rootStore.netWorthArchiveStore.archives.find((entry) => entry.uuid === strategy.archiveId);

    if (typeof archive?.mapCount === 'number' && Number.isFinite(archive.mapCount)) {
      return Math.max(1, Math.floor(archive.mapCount));
    }

    return 1;
  }

  getEffectiveClearTimeMinutes(strategy: Pick<IStrategyReviewerStrategy, 'clearTimeMinutes'>) {
    if (typeof strategy.clearTimeMinutes === 'number' && Number.isFinite(strategy.clearTimeMinutes)) {
      return Math.max(0.1, strategy.clearTimeMinutes);
    }

    return 3;
  }

  private getPointGrossPerMap(point: IStrategyReviewerPoint) {
    return typeof point.grossPerMap === 'number'
      ? point.grossPerMap
      : point.grossValue / Math.max(1, point.mapCount || 1);
  }

  private getPointCostPerMap(point: IStrategyReviewerPoint) {
    return typeof point.costPerMap === 'number'
      ? point.costPerMap
      : point.costValue / Math.max(1, point.mapCount || 1);
  }

  private getPointProfitPerMap(point: IStrategyReviewerPoint) {
    return typeof point.profitPerMap === 'number'
      ? point.profitPerMap
      : point.profitValue / Math.max(1, point.mapCount || 1);
  }

  private getPointGrossPerHour(point: IStrategyReviewerPoint) {
    if (typeof point.grossPerHour === 'number') {
      return point.grossPerHour;
    }

    return this.getPointGrossPerMap(point) * (60 / Math.max(0.1, point.clearTimeMinutes || 3));
  }

  private getPointCostPerHour(point: IStrategyReviewerPoint) {
    if (typeof point.costPerHour === 'number') {
      return point.costPerHour;
    }

    return this.getPointCostPerMap(point) * (60 / Math.max(0.1, point.clearTimeMinutes || 3));
  }

  private getPointProfitPerHour(point: IStrategyReviewerPoint) {
    if (typeof point.profitPerHour === 'number') {
      return point.profitPerHour;
    }

    return this.getPointProfitPerMap(point) * (60 / Math.max(0.1, point.clearTimeMinutes || 3));
  }

  private getAverageDivinePrice(points: IStrategyReviewerPoint[]) {
    const values = points
      .map((point) => point.divinePrice)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

    if (values.length === 0) {
      return this.rootStore.priceStore.divinePrice || 1;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private resolveDivinePriceForDate(date: string, priceCache: Map<string, number>) {
    const cacheKey = `${date}|__divine_orb__`;
    const cached = priceCache.get(cacheKey);
    if (typeof cached === 'number') {
      return cached;
    }

    const divinePrice = this.rootStore.priceStore.activePricesWithCustomValues?.find(
      (price) => price.name === 'Divine Orb'
    );
    let value = this.rootStore.priceStore.divinePrice || 1;

    if (divinePrice && this.rootStore.settingStore.pricingModel !== 'traditional') {
      const poedbValue = this.rootStore.poeDbPriceStore.getClosestMetricPriceForExternalPrice(
        divinePrice,
        this.rootStore.settingStore.pricingModel,
        date
      );
      if (typeof poedbValue === 'number' && Number.isFinite(poedbValue) && poedbValue > 0) {
        value = poedbValue;
      }
    }

    priceCache.set(cacheKey, value);
    return value;
  }

  @action
  private ensureMigrated() {
    if (this.analyses.length > 0) {
      return;
    }

    if (this.legacyStrategies.length > 0) {
      const migratedAnalysis: IStrategyReviewerAnalysis = {
        uuid: uuidv4(),
        name: 'Analysis 1',
        createdAt: new Date().toISOString(),
        rangeStartDate: this.legacyRangeStartDate,
        rangeEndDate: this.legacyRangeEndDate,
        strategies: this.legacyStrategies.slice(),
      };

      this.analyses = [migratedAnalysis];
      this.activeAnalysisId = migratedAnalysis.uuid;
      this.legacyStrategies = [];
      this.legacyRangeStartDate = undefined;
      this.legacyRangeEndDate = undefined;
      return;
    }

    if (!this.activeAnalysisId) {
      const analysis: IStrategyReviewerAnalysis = {
        uuid: uuidv4(),
        name: 'Analysis 1',
        createdAt: new Date().toISOString(),
        strategies: [],
      };
      this.analyses = [analysis];
      this.activeAnalysisId = analysis.uuid;
    }
  }

  private buildSignature(
    strategy: IStrategyReviewerStrategy,
    archive: { uuid: string; sources?: { uuid: string }[]; mapCount?: number }
  ) {
    return JSON.stringify({
      engineVersion: 4,
      archiveId: archive.uuid,
      sourceIds: (archive.sources || []).map((source) => source.uuid),
      mapCount: this.getEffectiveMapCount(strategy, archive),
      clearTimeMinutes: this.getEffectiveClearTimeMinutes(strategy),
      pricingModel: this.rootStore.settingStore.pricingModel,
      costs: strategy.costItems
        .map((item) => ({
          key: this.getCostLookupKey(item),
          quantity: item.quantity,
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    });
  }

  private getPriceLookupKey(
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

  getCostItemLabel(
    item: Pick<
      IExternalPrice,
      | 'name'
      | 'frameType'
      | 'variant'
      | 'level'
      | 'quality'
      | 'corrupted'
      | 'links'
      | 'tier'
    >
  ) {
    const parts = [item.name];

    if (item.variant) {
      parts.push(item.variant);
    }
    if (item.frameType === 4 && item.level) {
      parts.push(`Lv ${item.level}`);
    }
    if (item.quality) {
      parts.push(`Q${item.quality}`);
    }
    if (item.links) {
      parts.push(`${item.links}L`);
    }
    if (item.tier) {
      parts.push(`T${item.tier}`);
    }
    if (item.corrupted) {
      parts.push('Corrupted');
    }

    return parts.join(' • ');
  }

  private getCostLookupKey(
    item: Pick<
      IStrategyReviewerCostItem,
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
    return this.getPriceLookupKey(item);
  }
}
