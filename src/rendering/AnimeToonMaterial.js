
import {
  DataTexture,
  LuminanceFormat,
  RedFormat,
  UnsignedByteType,
  NearestFilter,
  ClampToEdgeWrapping,
  MeshStandardMaterial,
  MeshToonMaterial,
  Color
} from 'three-platformize';

function createGradient(format) {
  const texture = new DataTexture(new Uint8Array([105, 150, 195, 230, 255]), 5, 1, format, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const webGL1Gradient = createGradient(LuminanceFormat);
let webGL2Gradient;

export function applyAnimeToon(model, usesWebGL2 = false) {
  // Three's WebGL2 upload uses immutable storage, which requires a sized format (R8).
  const gradient = usesWebGL2 ? (webGL2Gradient ??= createGradient(RedFormat)) : webGL1Gradient;
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
