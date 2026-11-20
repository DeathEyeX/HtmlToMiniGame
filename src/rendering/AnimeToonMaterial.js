
import {
  DataTexture,
  LuminanceFormat,
  UnsignedByteType,
  NearestFilter,
  ClampToEdgeWrapping,
  MeshStandardMaterial,
  MeshToonMaterial,
  Color
} from 'three-platformize';

const gradient = new DataTexture(
  new Uint8Array([105, 150, 195, 230, 255]),
  5,
  1,
  LuminanceFormat,
  UnsignedByteType
);

gradient.minFilter = NearestFilter;
gradient.magFilter = NearestFilter;
gradient.wrapS = ClampToEdgeWrapping;
gradient.wrapT = ClampToEdgeWrapping;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;

export function applyAnimeToon(model) {
  let converted = 0;

  model.traverse((object) => {
    if (!object.isMesh) return;

    function convert(original) {
      if (!(original instanceof MeshStandardMaterial)) {
        return original;
      }

      const toon = new MeshToonMaterial({
        color: original.color.clone(),
        map: original.map,
        gradientMap: gradient,

        transparent: original.transparent,
        opacity: original.opacity,
        alphaTest: original.alphaTest,
        alphaMap: original.alphaMap,
        side: original.side,
        vertexColors: original.vertexColors,

        emissive: new Color('#24160e'),
        emissiveIntensity: 0.08
      });

      toon.name = `${original.name}_AnimeToon`;
      toon.depthWrite = original.depthWrite;
      toon.depthTest = original.depthTest;

      converted++;
      return toon;
    }

    object.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material);

    object.castShadow = true;
    object.receiveShadow = true;
  });

  console.log('[AnimeToon] Converted materials:', converted);
}
