import { PricingModel } from '../store/settingStore';
import { INetWorthArchiveItem } from './net-worth-archive-item.interface';
import { NetWorthArchiveOrigin } from './net-worth-archive.interface';

export interface INetWorthArchiveSource {
  uuid: string;
  createdAt: string;
  sourceDate?: string;
  origin: NetWorthArchiveOrigin;
  pricingModel: PricingModel;
  poedbPricingDate?: string;
  currency: string;
  sourceLabel: string;
  items: INetWorthArchiveItem[];
}
