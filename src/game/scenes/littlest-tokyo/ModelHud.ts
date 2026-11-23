import type { Graphics } from 'pixi.js';
import type { ModelStatus } from './LittlestTokyo';
import { toolbar } from '../../ui/toolbarLayout';

export function drawModelHud(buttons: Graphics, load: ModelStatus) {
  const { step, padding, size } = toolbar;
  buttons.roundRect(63, 25, 101, 6, 3).fill(0x304764);
  if (load.stage === 'error') {
    const retryX = padding + 4 * step;
    buttons.roundRect(retryX, padding, size, size, 8).fill(0xa44742)
      .arc(retryX + 20, 28, 8, -Math.PI / 2, Math.PI).stroke({ color: 0xffffff, width: 2 })
      .moveTo(retryX + 15, 23).lineTo(retryX + 20, 20).lineTo(retryX + 15, 17)
      .stroke({ color: 0xffffff, width: 2 });
  } else {
    const length = load.stage === 'ready' ? 101 : Math.max(6, Math.min(101, load.progress * 1.01));
    buttons.roundRect(63, 25, length, 6, 3).fill(load.stage === 'ready' ? 0x58dcc1 : 0x68c8fc);
  }
}
