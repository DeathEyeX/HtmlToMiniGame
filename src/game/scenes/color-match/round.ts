export const matchColors = [0x46a9e4, 0xffae56, 0xbb78e8] as const;
export const roundSeconds = 20;

export function createMatchRound(random = Math.random) {
  let phase: 'ready' | 'playing' | 'finished' = 'ready';
  let target = 0;
  let score = 0;
  let remaining = roundSeconds;

  return {
    state: () => ({ phase, target, score, seconds: Math.max(0, Math.ceil(remaining - 1e-9)) }),
    start() {
      if (phase === 'playing') return;
      phase = 'playing';
      target = Math.floor(random() * matchColors.length);
      score = 0;
      remaining = roundSeconds;
    },
    choose(index: number) {
      if (phase !== 'playing' || index !== target) return false;
      score += 1;
      const offset = 1 + Math.floor(random() * (matchColors.length - 1));
      target = (target + offset) % matchColors.length;
      return true;
    },
    advance(delta: number) {
      if (phase !== 'playing') return;
      remaining = Math.max(0, remaining - delta);
      if (remaining <= 1e-9) {
        remaining = 0;
        phase = 'finished';
      }
    }
  };
}
