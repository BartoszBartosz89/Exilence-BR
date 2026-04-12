import { PricingModel } from '../store/settingStore';
import { INetWorthArchiveItem } from './net-worth-archive-item.interface';
import { INetWorthArchiveSource } from './net-worth-archive-source.interface';

export type NetWorthArchiveOrigin = 'saved' | 'imported';

export interface INetWorthArchive {
  uuid: string;
  name: string;
  createdAt: string;
  currency: string;
  mapCount?: number;
  sources: INetWorthArchiveSource[];
  items?: INetWorthArchiveItem[];
  sourceDate?: string;
  origin?: NetWorthArchiveOrigin;
  pricingModel?: PricingModel;
  poedbPricingDate?: string;
  sourceLabels?: string[];
}
