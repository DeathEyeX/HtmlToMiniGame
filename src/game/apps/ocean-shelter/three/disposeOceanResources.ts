import { Material, Texture, type BufferGeometry, type Object3D, type WebGLRenderTarget } from 'three-platformize';

export function disposeOceanResources(
  root: Object3D, extraTextures: Iterable<Texture> = [], extraTargets: Iterable<WebGLRenderTarget> = []
) {
  // Cloned props can share geometry, materials and textures.
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set(extraTextures);
  const targets = new Set(extraTargets);
  root.traverse(node => {
    const renderable = node as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
      shadow?: { map: WebGLRenderTarget | null; mapPass: WebGLRenderTarget | null };
    };
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) {
      for (const material of [renderable.material].flat()) materials.add(material);
    }
    if (renderable.shadow?.map) targets.add(renderable.shadow.map);
    if (renderable.shadow?.mapPass) targets.add(renderable.shadow.mapPass);
    if ('isInstancedMesh' in node && 'dispose' in node && typeof node.dispose === 'function') node.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value);
    }
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const target of targets) target.dispose();
  for (const texture of textures) texture.dispose();
}
