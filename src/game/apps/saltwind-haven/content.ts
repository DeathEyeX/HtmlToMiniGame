export type Point3 = [number, number, number];

export const zones = {
  home: { title: '生活区', position: [-1.2, 1.18, -.3], size: [8.6, 8.3], turn: 0, view: [0, 2.8, 0], color: 0xec9464 },
  garden: { title: '种植区', position: [7.65, 1.02, -6.05], size: [6.5, 5.3], turn: -.12, view: [0, .9, 0], color: 0xaad379 },
  works: { title: '加工区', position: [-8.7, .96, 2.8], size: [5.5, 6.3], turn: .13, view: [0, .9, 0], color: 0xe6ad71 },
  water: { title: '淡水区', position: [8.6, .96, .9], size: [6, 5.2], turn: .075, view: [0, 1.1, 0], color: 0x90daf2 },
  fish: { title: '捕鱼区', position: [1.9, .76, 7.55], size: [5.3, 5.15], turn: -.13, view: [.7, .65, 1.0], color: 0xf0c883 },
  power: { title: '能源区', position: [.5, 1.01, -8.05], size: [5.8, 4.05], turn: .09, view: [0, 1.8, 0], color: 0x92bfe9 },
  tower: { title: '观察塔', position: [-7.65, 1.04, -4.2], size: [4.15, 4.55], turn: -.11, view: [0, 3.75, 0], color: 0xf2b58c }
} satisfies Record<string, { title: string; position: Point3; size: [number, number]; turn: number; view: Point3; color: number }>;

export type ZoneId = keyof typeof zones;
export const zoneIds = Object.keys(zones) as ZoneId[];
export const buildings: Record<ZoneId, { footprint: [number, number]; offset?: Point3; turn?: number; scale?: number }> = {
  home: { footprint: [8.4, 8.2] },
  garden: { footprint: [6.0, 4.9], offset: [-.04, 0, 0] },
  works: { footprint: [5.2, 5.9] },
  water: { footprint: [5.6, 4.9], turn: -.018 },
  fish: { footprint: [5.3, 5.0] },
  power: { footprint: [5.4, 3.75], offset: [.08, 0, 0] },
  tower: { footprint: [3.4, 3.75], scale: .98 }
};
export const havenTitle = '盐风庇护所';
export const havenControls = ['全景', '净屏', '界面', '拖动环绕 · 双指缩放'];
