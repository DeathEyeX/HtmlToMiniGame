export type Position = readonly [x: number, y: number, z: number];

export const views = {
  harbor: { title: '潮汐浮城', tab: '庇护所', status: '海上聚落', detail: '栈桥连起码头、工坊、温室和信标。' },
  coast: { title: '水线残城', tab: '水线', status: '近岸水线', detail: '旧写字楼和断桥露出海面。' },
  depths: { title: '沉没城区', tab: '海底', status: '海床约 18 米', detail: '鱼群穿过被珊瑚和海藻覆盖的旧街道。' }
} as const;

export type View = keyof typeof views;
export const viewIds = Object.keys(views) as View[];

export const stops = {
  dock: { label: '打捞码头', level: 'L1', color: 0x6fd4ce, node: 0 },
  workshop: { label: '净水工坊', level: 'L2', color: 0xf4b473, node: 5 },
  garden: { label: '屋顶温室', level: 'L3', color: 0xa7d373, node: 7 },
  beacon: { label: '潮汐信标', level: 'L3', color: 0xffa898, node: 8 }
} as const;

export type Stop = keyof typeof stops;
export const stopIds = Object.keys(stops) as Stop[];

export const landings: readonly Position[] = [
  [-4.4, 1.35, 7.16], [-3.16, 1.35, 4.04], [4.77, 1.35, 4.04],
  [4.77, 4.08, .44], [.50, 4.08, .07], [-4.38, 4.08, .07],
  [4.77, 6.78, -2.61], [1.44, 6.78, -2.81], [-2.94, 6.78, -2.81]
];

// 工坊在中层的支路，屋顶楼梯从中层东端直接接到上层。
const links: readonly (readonly number[])[] = [[1], [0, 2], [1, 3], [2, 4, 6], [3, 5], [4], [3, 7], [6, 8], [7]];

export function deckRoute(start: number, destination: number) {
  const pending: number[][] = [[start]];
  const visited = new Set([start]);
  for (const path of pending) {
    const current = path[path.length - 1];
    if (current === destination) return path.slice(1);
    for (const next of links[current]) {
      if (visited.has(next)) continue;
      visited.add(next);
      pending.push([...path, next]);
    }
  }
  return [];
}
