export interface IStrategyReviewerCostItem {
  uuid: string;
  name: string;
  icon: string;
  quantity: number;
  calculated?: number;
  frameType?: number;
  variant?: string;
  elder?: boolean;
  shaper?: boolean;
  links?: number;
  quality?: number;
  ilvl?: number;
  level?: number;
  corrupted?: boolean;
  tier?: number;
  detailsUrl?: string;
  customPrice?: number;
}
