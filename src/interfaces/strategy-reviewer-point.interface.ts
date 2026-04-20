export interface IStrategyReviewerPoint {
  date: string;
  grossValue: number;
  costValue: number;
  profitValue: number;
  grossPerMap: number;
  costPerMap: number;
  profitPerMap: number;
  grossPerHour: number;
  costPerHour: number;
  profitPerHour: number;
  mapCount: number;
  clearTimeMinutes: number;
  divinePrice?: number;
}
