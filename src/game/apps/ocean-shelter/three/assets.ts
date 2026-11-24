import { LinearFilter, LoadingManager, MathUtils, Texture, TextureLoader } from 'three-platformize';
import { GLTFLoader, type GLTF } from 'three-platformize/examples/jsm/loaders/GLTFLoader';
import { createResourceLoader } from '../../../../framework/assets/createResourceLoader';

declare const GAME_RUNTIME_ASSET_URL: string | undefined;

const runtimeUrl = typeof GAME_RUNTIME_ASSET_URL === 'undefined' ? undefined : GAME_RUNTIME_ASSET_URL;
const runtimeResources = createResourceLoader(runtimeUrl ? {
  kind: 'remote',
  baseUrl: runtimeUrl
} : {
  kind: 'subpackage',
  name: 'ocean-shelter',
  root: 'dist/resources/ocean-shelter'
});

export function createTextureCanvas() {
  return wx.createCanvas() as unknown as HTMLCanvasElement;
}

export const readOceanFile = runtimeResources.readBinary;

export async function loadOceanTexture(file: string) {
  const image = await runtimeResources.loadImage(file);
  const texture = new Texture(image as unknown as HTMLImageElement);
  // WebGL1 requires non-power-of-two textures to use a minification filter without mipmaps.
  if (!MathUtils.isPowerOfTwo(image.width) || !MathUtils.isPowerOfTwo(image.height)) {
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
  }
  texture.needsUpdate = true;
  return texture;
}

// Feed the glTF relative texture URI to the same resource source as its GLB.
class RuntimeTextureLoader extends TextureLoader {
  override load(url: string, onLoad?: (texture: Texture) => void, _progress?: unknown, onError?: (error: ErrorEvent) => void) {
    const texture = new Texture();
    void runtimeResources.loadImage(url).then(image => {
      texture.image = image;
      texture.needsUpdate = true;
      onLoad?.(texture);
    }, (error: unknown) => onError?.(error as ErrorEvent));
    return texture;
  }
}

export async function readOceanModel(file: string) {
  const source = await readOceanFile(file);
  const directory = file.slice(0, file.lastIndexOf('/') + 1);
  const manager = new LoadingManager();
  manager.addHandler(/\.(png|jpg)$/, new RuntimeTextureLoader(manager));
  const loader = new GLTFLoader(manager);
  return new Promise<GLTF>((resolve, reject) => loader.parse(source, directory, resolve, reject));
}
