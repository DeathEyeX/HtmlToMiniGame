export type Position = [x: number, height: number, depth: number]

export const routes = {
  command: { position: [-7.2, 3.2, 1.45], links: ['junction'] },
  junction: { position: [-1, 3.2, 1.45], links: ['command', 'stairFoot', 'greenhouse'] },
  stairFoot: { position: [-1, 3.2, 0.27], links: ['junction', 'upper'] },
  upper: { position: [-3.95, 6.3, 0.27], links: ['stairFoot', 'lookout'] },
  lookout: { position: [-7.7, 6.3, 1.05], links: ['upper'] },
  greenhouse: { position: [6.7, 3.2, 1.45], links: ['junction', 'knee'] },
  knee: { position: [10.1, 3.2, 1.45], links: ['greenhouse', 'dockLip'] },
  dockLip: { position: [10.1, 3.2, 2.32], links: ['knee', 'bottom'] },
  bottom: { position: [10.1, 1.1, 5.7], links: ['knee', 'dock'] },
  dock: { position: [8.1, 1.1, 6.45], links: ['bottom'] },
} satisfies Record<string, { position: Position, links: string[] }>

export type RouteId = keyof typeof routes
export type ZoneId = 'command' | 'lookout' | 'greenhouse' | 'dock'

export const zones = {
  lookout: { name: '瞭望台', level: '上层甲板', floor: 'L3', icon: 'signal', color: '#e1ab65', action: '修复电台并发信号' },
  command: { name: '指挥舱', level: '中层甲板', floor: 'L2', icon: 'compass', color: '#6db7ac', action: '查看航行日志' },
  greenhouse: { name: '温室', level: '中层甲板', floor: 'L2', icon: 'food', color: '#9cb675', action: '收集冷凝罐淡水' },
  dock: { name: '打捞码头', level: '下层甲板', floor: 'L1', icon: 'anchor', color: '#75a8c5', action: '回收打捞废料' },
} satisfies Record<ZoneId, { name: string, level: string, floor: string, icon: string, color: string, action: string }>

export const zoneIds = Object.keys(zones) as ZoneId[]

export function findRoute(from: RouteId, to: RouteId): RouteId[] {
  const queue: RouteId[][] = [[from]]
  const visited = new Set<RouteId>([from])
  for (const path of queue) {
    const end = path[path.length - 1]
    if (end === to) return path.slice(1)
    for (const neighbor of routes[end].links as RouteId[]) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push([...path, neighbor])
    }
  }
  return []
}
