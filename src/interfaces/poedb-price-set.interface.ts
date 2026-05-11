import { IPoeDbItemMapping } from './poedb-item-mapping.interface';
import { IPoeDbUrlHistory } from './poedb-url-history.interface';

export interface IPoeDbPriceSet {
  uuid: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  mappings: IPoeDbItemMapping[];
  urlHistories: IPoeDbUrlHistory[];
  selectedDate?: string;
}

export interface IPoeDbPriceSetExport {
  exportType: 'exilence-poedb-price-set';
  version: 1;
  exportedAt: string;
  priceSet: IPoeDbPriceSet;
}
