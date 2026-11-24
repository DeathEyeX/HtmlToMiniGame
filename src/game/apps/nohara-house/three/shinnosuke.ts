import { Sprite, SpriteMaterial, Texture } from 'three-platformize';

export function createShinnosuke(image: WechatMinigame.Image, height: number) {
  const texture = new Texture(image as unknown as HTMLImageElement);
  texture.needsUpdate = true;

  // A camera-facing sprite keeps the drawn proportions and still respects scene depth.
  const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: .06 });
  const sprite = new Sprite(material);
  sprite.name = 'Shinnosuke';
  // Anchor the sprite at the soles, just above the PNG's transparent bottom margin.
  sprite.center.set(.5, 6 / image.height);
  sprite.scale.set(height * image.width / image.height, height, 1);
  return {
    sprite,
    dispose() {
      material.dispose();
      texture.dispose();
    }
  };
}
