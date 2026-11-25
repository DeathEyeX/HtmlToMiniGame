import * as THREE from 'three-platformize';

// 暖木、锈铁、蓝色塑料与植物绿是整座基地的主色。颜色统一在线性空间生成，
// 保证卡通高饱和外观在 sRGB 输出后仍然明亮，不会灰掉。
export const wood = [0xd88a44, 0xe8a054, 0xc97a36, 0xf2b064, 0xdd9349, 0xefa75a];
export const timber = 0x8c4a1c;
export const plankDark = 0x9b5a28;
export const rope = 0xd8b878;
export const iron = 0x3d545c;
export const rust = [0xd44e22, 0xe86030, 0xbf4418, 0xf07438, 0xc84e20];
export const blue = [0x1878cc, 0x1e96e0, 0x1470b8, 0x2290ca];
// 绿色偏深并且跨度大：暖色阳光会把浅绿洗黄，需要更深的底色维持层次。
export const green = [0x2f7a3a, 0x4b9a46, 0x69b552, 0x24663a, 0x86c45c, 0x3f8a3c];
export const cream = 0xfbf0cc;
export const teal = [0x478a88, 0x5b9d96, 0x88aca0, 0x689b90, 0x3e7678];
export const hull = [0x5f8f8b, 0x4e7f7d, 0x6f9b92];

export const swatch = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();

export function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function toonGradient(shadow: number, mid: number) {
  const steps = [shadow, shadow, mid, mid, 255, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((value, i) => data.set([value, value, value, 255], i * 4));
  const texture = new THREE.DataTexture(data, steps.length, 1);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}
