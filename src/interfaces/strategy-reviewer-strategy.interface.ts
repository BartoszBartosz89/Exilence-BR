import { IStrategyReviewerCostItem } from './strategy-reviewer-cost.interface';
import { IStrategyReviewerPoint } from './strategy-reviewer-point.interface';

export interface IStrategyReviewerStrategy {
  uuid: string;
  name: string;
  archiveId?: string;
  mapCountOverride?: number;
  clearTimeMinutes?: number;
  collapsed?: boolean;
  costItems: IStrategyReviewerCostItem[];
  cachedPoints: IStrategyReviewerPoint[];
  calculationSignature?: string;
  cachedAt?: string;
}
