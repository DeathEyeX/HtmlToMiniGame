import { Container, Graphics, Sprite } from 'pixi.js';
import { loadPackagedUIAtlas } from '../../game/ui/packagedUIAtlas';
import type { CreateHudView } from '../../framework/ui/PixiHud';

export const createPixiUIDiagnostics: CreateHudView = async (stage, width, height) => {
  const atlas = await loadPackagedUIAtlas();
  const sprite = new Sprite(atlas.colorSample);
  sprite.scale.set(1.5);
  sprite.position.set(12, 14);
  const counter = atlas.createNumber('012345', 18);
  counter.position.set(73, 16);
  const button = new Graphics().roundRect(73, 41, 106, 24, 5).fill(0x2675c7)
    .rect(121, 52, 10, 2).rect(125, 48, 2, 10).fill(0xffffff);
  const panel = new Container();
  panel.addChild(new Graphics().roundRect(0, 0, 200, 77, 10).fill(0x142942), sprite, counter, button);
  stage.addChild(panel);
  console.log('[PixiUI] Sprite and BitmapText mounted');

  function resize(width: number, height: number) {
    const scale = Math.min(1, width / 200, height / 77);
    panel.scale.set(scale);
    panel.position.set(Math.min(14, width - 200 * scale), Math.max(0, Math.min(66, height - 77 * scale)));
  }

  const hitsButton = ({ x, y }: { x: number; y: number }) => {
    const localX = (x - panel.x) / panel.scale.x;
    const localY = (y - panel.y) / panel.scale.y;
    return localX >= 73 && localX < 179 && localY >= 41 && localY < 65;
  };
  let count = 12345;
  resize(width, height);
  return {
    resize,
    beginGesture(point) {
      if (!hitsButton(point)) return;
      let pressed = true;
      return {
        move(next) { pressed &&= hitsButton(next); },
        release(next) {
          if (!pressed || !hitsButton(next)) return;
          count = (count + 1) % 1_000_000;
          counter.text = String(count).padStart(6, '0');
          console.log('[PixiUI] BitmapText changed', counter.text);
        },
        cancel() {}
      };
    }
  };
};
