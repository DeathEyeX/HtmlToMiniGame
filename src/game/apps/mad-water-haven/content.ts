export type Point3 = [number, number, number];

// 浮台位置为甲板中心。主住宅四周留出高度不同的栈桥，辅助浮台沿三面外扩。
// 观察塔抬高纵向轮廓，水下城压低到水面以下，形成三层空间：塔顶、甲板、海床。
export const zones = {
  home: { title: '生活区', position: [-1.4, 1.22, -.6], size: [9.4, 8.8], turn: 0, view: [0, 3.2, 0], color: 0xec9464 },
  garden: { title: '种植区', position: [8.4, 1.02, -6.7], size: [6.8, 5.6], turn: -.12, view: [0, .95, 0], color: 0xaad379 },
  works: { title: '加工区', position: [-9.7, .96, 3.9], size: [5.9, 6.6], turn: .13, view: [0, .95, 0], color: 0xe6ad71 },
  water: { title: '淡水区', position: [9.4, .96, 1.4], size: [6.2, 5.6], turn: .075, view: [0, 1.15, 0], color: 0x90daf2 },
  fish: { title: '捕鱼区', position: [2.4, .74, 8.6], size: [5.8, 5.5], turn: -.13, view: [.7, .7, 1.1], color: 0xf0c883 },
  power: { title: '能源区', position: [.8, 1.0, -9.0], size: [6.2, 4.4], turn: .09, view: [0, 1.9, 0], color: 0x92bfe9 },
  tower: { title: '观察塔', position: [-8.2, 1.06, -4.1], size: [4.4, 4.7], turn: -.11, view: [0, 4.2, 0], color: 0xf2b58c },
  depths: { title: '水下城', position: [-1.4, -3.55, .4], size: [10.4, 8.6], turn: 0, view: [0, -.8, 1.2], color: 0x7fd7c4 }
} satisfies Record<string, { title: string; position: Point3; size: [number, number]; turn: number; view: Point3; color: number }>;

export type ZoneId = keyof typeof zones;
// 水下城没有独立浮台，其余顺序按视觉动线排列，HUD 底部按同一顺序生成按钮。
export const zoneIds = Object.keys(zones) as ZoneId[];
export const buildings: Record<ZoneId, { footprint: [number, number]; offset?: Point3; turn?: number; scale?: number }> = {
  home: { footprint: [9.2, 8.6] },
  garden: { footprint: [6.4, 5.2], offset: [-.04, 0, 0] },
  works: { footprint: [5.7, 6.2] },
  water: { footprint: [5.9, 5.3], turn: -.018 },
  fish: { footprint: [5.7, 5.4] },
  power: { footprint: [5.9, 4.2], offset: [.08, 0, 0] },
  tower: { footprint: [3.8, 4.1], scale: .98 },
  depths: { footprint: [9.8, 8.2] }
};
export const havenTitle = '海上庇护所';
export const havenControls = ['全景', '净屏', '界面', '拖动环绕 · 双指缩放'];
