import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import { oceanHudIconNames, type loadOceanHudImages } from './assets';
import { glyphs } from './hudGlyphs';

type IconName = typeof oceanHudIconNames[number];
const glyphCell = 40, glyphColumns = 16;

export function createOceanHudArt([page, ...icons]: Awaited<ReturnType<typeof loadOceanHudImages>>) {
  function source(image: typeof page) {
    return new ImageSource({
      resource: image as unknown as HTMLImageElement,
      width: image.width,
      height: image.height
    });
  }

  const atlas = source(page);
  const letters = new Map(Array.from(glyphs, (glyph, index) => [glyph, new Texture({
    source: atlas,
    frame: new Rectangle(index % glyphColumns * glyphCell, Math.floor(index / glyphColumns) * glyphCell, glyphCell, glyphCell)
  })]));
  const textures = new Map(oceanHudIconNames.map((name, index) => [name, new Texture({ source: source(icons[index]) })]));

  function advance(glyph: string, size: number) {
    return size * (/^[A-Z0-9· ]$/.test(glyph) ? .58 : 1);
  }

  return {
    icon(name: IconName) {
      return new Sprite(textures.get(name)!);
    },
    measure(text: string, size: number) {
      return Array.from(text).reduce((width, glyph) => width + advance(glyph, size), 0);
    },
    text(text: string, size: number, tint: number) {
      const label = new Container();
      let x = 0;
      for (const glyph of text) {
        const step = advance(glyph, size);
        const texture = letters.get(glyph);
        if (texture) {
          const sprite = new Sprite(texture);
          sprite.anchor.set(.5);
          sprite.setSize(size * 1.25);
          sprite.position.set(x + step / 2, size / 2);
          sprite.tint = tint;
          label.addChild(sprite);
        }
        x += step;
      }
      return label;
    },
    dispose() {
      for (const letter of letters.values()) letter.destroy();
      for (const texture of textures.values()) texture.destroy(true);
      atlas.destroy();
    }
  };
}
