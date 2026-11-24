import { findRoute, routes, zones, type Position, type RouteId, type ZoneId } from './routes';

export const taskSteps = [
  { id: 'dock', text: '在打捞码头回收废料' },
  { id: 'greenhouse', text: '从温室收集淡水' },
  { id: 'lookout', text: '在瞭望台发出信号' }
] as const;

const rewards = {
  dock: '回收了接头和线材，废料 +8。',
  greenhouse: '收集了冷凝罐淡水，淡水 +6 L。',
  lookout: '发出呼叫信号，废料 -4，电力 -6%。'
};

const passages: Partial<Record<RouteId, string>> = {
  junction: '中央栈桥', stairFoot: '瞭望台楼梯', upper: '瞭望台楼梯',
  knee: '码头楼梯', dockLip: '码头楼梯', bottom: '码头楼梯'
};

const nameOf = (id: RouteId) => passages[id] ?? zones[id as ZoneId].name;

interface Leg {
  to: RouteId;
  length: number;
  direction: number;
  progress: number;
}

export function createDriftGame(onArrival: () => void, onTask: () => void) {
  let at: RouteId = 'command';
  let destination: RouteId = at;
  let path: RouteId[] = [];
  let leg: Leg | undefined;
  let feedback = '';
  const position: Position = [...routes.command.position];
  const completed = new Set<ZoneId>();
  const log = [{ area: zones.command.name, message: '值班交接。电台静默，码头有昨夜捞起的废料。' }];

  function nextLeg() {
    const to = path.shift();
    if (!to) return;
    const [x, y, z] = routes[at].position;
    const [nextX, nextY, nextZ] = routes[to].position;
    leg = { to, length: Math.hypot(nextX - x, nextY - y, nextZ - z), direction: Math.atan2(nextX - x, nextZ - z), progress: 0 };
  }

  function travelTo(to: RouteId) {
    if (destination === to) return;
    destination = to;
    // 改目的地时先走到当前路段的落脚点，避免在楼梯中途切出甲板。
    path = findRoute(leg?.to ?? at, to);
    if (!leg) nextLeg();
    feedback = '';
  }

  function update(delta: number) {
    if (!leg) return;
    leg.progress = Math.min(1, leg.progress + delta * 6.1 / leg.length);
    const start = routes[at].position;
    const end = routes[leg.to].position;
    for (let i = 0; i < position.length; i++) position[i] = start[i] + (end[i] - start[i]) * leg.progress;
    if (leg.progress < 1) return;
    at = leg.to;
    leg = undefined;
    nextLeg();
    if (!leg) onArrival();
  }

  function step(horizontal: number, vertical: number) {
    if (leg) return;
    const [x, y, z] = routes[at].position;
    let best = .36;
    let next: RouteId | undefined;
    for (const candidate of routes[at].links as RouteId[]) {
      const [cx, cy, cz] = routes[candidate].position;
      // 把路段换算到侧视相机的屏幕方向，楼梯按屏幕上的上下移动。
      const dx = cx - x - (cz - z) * .32;
      const dy = cy - y - (cz - z) * .27 - (cx - x) * .084;
      const score = (dx * horizontal + dy * vertical) / Math.hypot(dx, dy);
      if (score > best) {
        best = score;
        next = candidate;
      }
    }
    if (next) travelTo(next);
  }

  function interact(): 'log' | undefined {
    if (leg || !(at in zones) || completed.has(at as ZoneId)) return;
    if (at === 'command') return 'log';
    if (at === 'lookout' && (!completed.has('dock') || !completed.has('greenhouse'))) {
      feedback = '先完成码头和温室的补给。';
      return;
    }
    const zone = at as keyof typeof rewards;
    completed.add(zone);
    feedback = zone === 'lookout' ? '已发出信号，联络任务完成。' : rewards[zone];
    log.unshift({ area: zones[zone].name, message: rewards[zone] });
    onTask();
  }

  return {
    update, travelTo, step, interact, position, log, completed,
    get at() { return at; },
    get direction() { return leg?.direction; },
    get destination() { return destination; },
    get moving() { return Boolean(leg); },
    get location() { return leg ? `前往${nameOf(destination)}` : nameOf(at); },
    get action() {
      if (leg) return '沿甲板通行';
      if (completed.has(at as ZoneId)) return '已完成互动';
      return zones[at as ZoneId]?.action ?? '请前往一个区域';
    },
    get canInteract() { return !leg && at in zones && !completed.has(at as ZoneId); },
    get feedback() { return feedback; },
    get resources() {
      return {
        water: completed.has('greenhouse') ? 30 : 24,
        food: 16,
        scrap: 32 + (completed.has('dock') ? 8 : 0) - (completed.has('lookout') ? 4 : 0),
        power: completed.has('lookout') ? 72 : 78
      };
    }
  };
}

export type DriftGame = ReturnType<typeof createDriftGame>;
