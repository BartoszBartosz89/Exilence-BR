import { PricingModel } from '../store/settingStore';
import { INetWorthArchiveItem } from './net-worth-archive-item.interface';

export type NetWorthArchiveOrigin = 'saved' | 'imported';

export interface INetWorthArchive {
  uuid: string;
  name: string;
  createdAt: string;
  sourceDate?: string;
  origin: NetWorthArchiveOrigin;
  pricingModel: PricingModel;
  poedbPricingDate?: string;
  currency: string;
  sourceLabels: string[];
  items: INetWorthArchiveItem[];
}
