import { IPricedItem } from './priced-item.interface';

export interface INetWorthArchiveItem extends IPricedItem {
  snapshotCalculated: number;
  snapshotTotal: number;
  sourceCount: number;
  sourceLabels: string[];
}
