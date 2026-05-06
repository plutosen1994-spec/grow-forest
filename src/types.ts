
export enum GrowthStage {
  SEED = 'SEED',
  SPROUT = 'SPROUT',
  GROWING = 'GROWING',
  BLOOM = 'BLOOM'
}

export interface Plant {
  id: string;
  type: string;
  name: string;
  stage: GrowthStage;
  sunlightNeeded: number;
  sunlightCollected: number;
  waterLevel: number;
  plantedAt: number;
}

export interface UserStats {
  waterDrops: number;
  totalFocusMinutes: number;
}
