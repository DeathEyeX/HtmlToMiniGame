import { Container, Sprite, type Graphics } from 'pixi.js';
import { loadPackagedUIAtlas } from '../../ui/packagedUIAtlas';
import { toolbar } from '../../ui/toolbarLayout';
import { finishes } from './finishes';

export function createWorkbenchHud(panel: Container, buttons: Graphics, refresh: () => void) {
  const { step, padding, size } = toolbar;
  const palette = new Container();
  panel.addChild(palette);
  let requestedPalette = false;

  async function loadPalette() {
    try {
      const atlas = await loadPackagedUIAtlas();
      const tiles = finishes.flatMap((color, index) => {
        const x = padding + (index + 1) * step;
        const swatch = new Sprite(atlas.swatch);
        swatch.position.set(x + 3, padding + 3);
        swatch.setSize(size - 6, size - 6);
        swatch.tint = color;
        const label = atlas.createNumber(String(index + 1).padStart(2, '0'), 14);
        label.position.set(x + 9, padding + 12);
        label.tint = 0x102746;
        return [swatch, label];
      });
      palette.addChild(...tiles);
      console.log('[App] Workbench palette ready');
      refresh();
    } catch (error) {
      console.warn('[App] Workbench uses Graphics swatches', error);
    }
  }

  return {
    setVisible(visible: boolean) { palette.visible = visible; },
    draw(state: { selected: number; confirmed: boolean }) {
      if (!requestedPalette) {
        requestedPalette = true;
        void loadPalette();
      }
      finishes.forEach((color, index) => {
        const x = padding + (index + 1) * step;
        if (state.selected === index) buttons.roundRect(x, padding, size, size, 8).fill(0xffffff);
        if (!palette.children.length) buttons.roundRect(x + 3, padding + 3, size - 6, size - 6, 6).fill(color);
      });
      const confirmX = padding + 4 * step;
      buttons.roundRect(confirmX, padding, size, size, 8).fill(state.confirmed ? 0x147b6e : 0x245cc7)
        .moveTo(confirmX + 11, 28).lineTo(confirmX + 17, 34).lineTo(confirmX + 29, 22)
        .stroke({ color: 0xffffff, width: 2 });
    }
  };
}
