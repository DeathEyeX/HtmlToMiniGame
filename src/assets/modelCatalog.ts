const modelCatalog = {
  littlestTokyo: {
    url: 'http://192.168.1.46:8080/model.glb',
    cacheKey: 'littlest-tokyo',
    version: 'network-test-v3'
  }
};

export function modelAsset(id: keyof typeof modelCatalog) {
  return modelCatalog[id];
}
