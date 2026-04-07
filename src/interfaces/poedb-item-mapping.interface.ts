import { IPoeDbPriceHistoryRow } from './poedb-price-history.interface';

export type PoeDbMappingStatus = 'pending' | 'resolved' | 'no_match' | 'error';

export interface IPoeDbItemMapping {
  itemKey: string;
  name: string;
  icon?: string;
  url?: string;
  status: PoeDbMappingStatus;
  lastCheckedAt?: string;
  lastError?: string;

  // Legacy fields kept only for one-way migration to URL-level history cache.
  history?: IPoeDbPriceHistoryRow[];
  historyFetchedAt?: string;
}
