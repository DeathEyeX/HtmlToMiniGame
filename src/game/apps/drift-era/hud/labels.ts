import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import { cellSize, columns, glyphs } from './glyphs';

export function createLabels(page: WechatMinigame.Image) {
  const source = new ImageSource({ resource: page as unknown as HTMLImageElement, width: page.width, height: page.height });
  const textures = new Map(Array.from(glyphs, (glyph, index) => [glyph, new Texture({
    source,
    frame: new Rectangle(index % columns * cellSize, Math.floor(index / columns) * cellSize, cellSize, cellSize)
  })]));

  return (text: string, size: number, color: number, align: 'left' | 'center' | 'right') => {
    const row = new Container();
    let width = 0;
    for (const glyph of text) {
      const advance = size * (glyph === ' ' ? .36 : glyph.charCodeAt(0) < 128 ? .62 : 1.04);
      const texture = textures.get(glyph);
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.tint = color;
        sprite.anchor.set(.5);
        sprite.position.set(width + advance / 2, 0);
        sprite.setSize(size * 1.44);
        row.addChild(sprite);
      }
      width += advance;
    }
    row.pivot.x = width * (align === 'center' ? .5 : align === 'right' ? 1 : 0);
    return row;
  };
}
