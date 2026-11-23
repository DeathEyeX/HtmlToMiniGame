import type { Graphics } from 'pixi.js';
import { toolbar } from '../../ui/toolbarLayout';

export function drawHomeHud(buttons: Graphics, hasModel: boolean) {
  const { step, padding, size } = toolbar;
  const challengeX = padding + step;
  buttons.roundRect(challengeX, padding, size, size, 8).fill(0x6345a3)
    .circle(challengeX + 15, 24, 4).fill(0x46a9e4)
    .circle(challengeX + 25, 24, 4).fill(0xffae56)
    .circle(challengeX + 20, 33, 4).fill(0xbb78e8);
  const x = padding + 2 * step;
  buttons.roundRect(x, padding, size, size, 8).fill(0x245cc7)
    .moveTo(x + 12, 28).lineTo(x + 28, 28)
    .moveTo(x + 22, 22).lineTo(x + 28, 28).lineTo(x + 22, 34)
    .stroke({ color: 0xffffff, width: 2 });
  if (hasModel) {
    const modelX = padding + 4 * step;
    buttons.roundRect(modelX, padding, size, size, 8).fill(0x147b6e)
      .rect(modelX + 9, 26, 6, 11).rect(modelX + 16, 17, 8, 20)
      .rect(modelX + 25, 21, 6, 16).fill(0xffffff);
  }
}
