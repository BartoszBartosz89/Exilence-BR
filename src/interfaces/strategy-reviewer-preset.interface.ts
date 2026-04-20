import { IStrategyReviewerCostItem } from './strategy-reviewer-cost.interface';

export interface IStrategyReviewerPreset {
  uuid: string;
  name: string;
  createdAt: string;
  costItems: IStrategyReviewerCostItem[];
}
