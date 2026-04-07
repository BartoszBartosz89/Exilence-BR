import { IPoeDbPriceHistoryRow } from './poedb-price-history.interface';

export interface IPoeDbUrlHistory {
  url: string;
  history: IPoeDbPriceHistoryRow[];
  historyFetchedAt?: string;
  lastError?: string;
}
