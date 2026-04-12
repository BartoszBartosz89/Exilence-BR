import { IStrategyReviewerStrategy } from './strategy-reviewer-strategy.interface';

export interface IStrategyReviewerAnalysis {
  uuid: string;
  name: string;
  createdAt: string;
  rangeStartDate?: string;
  rangeEndDate?: string;
  strategies: IStrategyReviewerStrategy[];
}
