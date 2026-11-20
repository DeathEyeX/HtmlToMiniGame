
import * as DracoModule from './draco/draco_decoder.js';

async function main() {
  console.log('[Draco] Static test started');

  console.log(
    '[Draco] Module exports:',
    Object.keys(DracoModule)
  );

  console.log(
    '[Draco] Global factory:',
    typeof globalThis.DracoDecoderModule
  );

  const factory =
    DracoModule.default ||
    DracoModule.DracoDecoderModule ||
    globalThis.DracoDecoderModule;

  console.log('[Draco] Factory type:', typeof factory);

  if (typeof factory !== 'function') {
    throw new Error('Draco decoder factory not found');
  }

  const decoder = await factory({});

  console.log('[Draco] Decoder ready:', {
    Decoder: typeof decoder.Decoder,
    DecoderBuffer: typeof decoder.DecoderBuffer,
    Mesh: typeof decoder.Mesh,
    PointCloud: typeof decoder.PointCloud,
  });
}

main().catch((error) => {
  console.error('[Draco] Static test failed:', error);
});
