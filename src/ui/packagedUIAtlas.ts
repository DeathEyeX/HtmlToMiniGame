import { BitmapFont, BitmapText, Cache, ImageSource, Rectangle, Texture, type BitmapFontData } from 'pixi.js';
import 'pixi.js/text-bitmap';
import { loadPackagedImage } from '../assets/loadPackagedImage';

const imagePath = 'media/pixi-ui-probe.png';
const fontFamily = 'PackagedDigits';

function prepareAtlas(image: ReturnType<typeof wx.createImage>) {
  if (image.width !== 116 || image.height !== 32) {
    throw new Error(`Unexpected image size for ${imagePath}: ${image.width} × ${image.height}`);
  }

  // Specify the source explicitly for native wx.Image objects.
  const source = new ImageSource({
    resource: image as unknown as HTMLImageElement,
    width: image.width,
    height: image.height,
    scaleMode: 'nearest'
  });
  const page = new Texture({ source });
  const chars: BitmapFontData['chars'] = {};
  for (const [index, letter] of [...'0123456789'].entries()) {
    chars[letter] = {
      id: letter.charCodeAt(0), letter, page: 0, kerning: {},
      x: 36 + (index % 5) * 16, y: Math.floor(index / 5) * 16,
      width: 10, height: 14, xOffset: 0, yOffset: 0, xAdvance: 12
    };
  }
  const font = new BitmapFont({
    textures: [page],
    data: { fontFamily, fontSize: 14, lineHeight: 16, baseLineOffset: 0, chars, pages: [{ id: 0, file: imagePath }] }
  });
  Cache.set(`${fontFamily}-bitmap`, font);
  return {
    colorSample: new Texture({ source, frame: new Rectangle(0, 0, 32, 32) }),
    swatch: new Texture({ source, frame: new Rectangle(110, 0, 6, 16) }),
    createNumber(text: string, fontSize: number) {
      return new BitmapText({ text, style: { fontFamily, fontSize, fill: 0xffffff } });
    }
  };
}

let atlas: Promise<ReturnType<typeof prepareAtlas>> | undefined;

export function loadPackagedUIAtlas() {
  atlas ??= loadPackagedImage(imagePath).then((image) => {
    const prepared = prepareAtlas(image);
    console.log('[PixiUI] Package image decoded', imagePath, image.width, image.height);
    return prepared;
  }).catch((error: unknown) => {
    atlas = undefined;
    throw error;
  });
  return atlas;
}
