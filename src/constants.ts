import { GrowthStage } from './types';

export const PLANT_TYPES = [
  { id: 'succulent', name: '肉肉球', color: '#7ED957', baseSunlight: 50, icon: '🍮' },
  { id: 'bamboo', name: '小青竹', color: '#2DCE89', baseSunlight: 100, icon: '🎋' },
  { id: 'lotus', name: '粉粉荷', color: '#FF85A1', baseSunlight: 200, icon: '🌸' },
  { id: 'sunflower', name: '呼呼葵', color: '#FFB600', baseSunlight: 150, icon: '🌻' },
  { id: 'cactus', name: '扎扎怪', color: '#059669', baseSunlight: 80, icon: '🌵' },
  { id: 'lavender', name: '薰衣香', color: '#B39DDB', baseSunlight: 180, icon: '🟣' },
  { id: 'ginkgo', name: '金银杏', color: '#FFB300', baseSunlight: 250, icon: '💛' },
  { id: 'cherry', name: '恋樱桃', color: '#F06292', baseSunlight: 300, icon: '🍒' },
];

export const FOCUS_OPTIONS = [10, 25, 45, 60, 90];

export const STAGE_NAMES = {
  [GrowthStage.SEED]: '沉睡之种',
  [GrowthStage.SPROUT]: '破土新绿',
  [GrowthStage.GROWING]: '蓬勃生长',
  [GrowthStage.BLOOM]: '芳华绽放',
};

export const GROWTH_THRESHOLDS = {
  [GrowthStage.SEED]: 0,
  [GrowthStage.SPROUT]: 0.25,
  [GrowthStage.GROWING]: 0.6,
  [GrowthStage.BLOOM]: 1.0,
};
