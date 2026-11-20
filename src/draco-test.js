
import {
  PLATFORM,
} from 'three-platformize';

import {
  WechatGamePlatform,
} from 'three-platformize/src/WechatGamePlatform';

// 使用 esbuild 的 text loader 将解码器作为字符串打包
import dracoSource from './draco/draco_decoder.txt';

async function main() {
  console.log('[Draco] Test started');

  const canvas = wx.createCanvas();
  PLATFORM.set(new WechatGamePlatform(canvas));

  console.log('[Draco] Source length:', dracoSource.length);

  // Emscripten 生成的 JS 文件通常定义 DracoDecoderModule。
  // 使用 Function 在当前线程执行，避免创建 Worker。
  const createModule = new Function(
    dracoSource + '\nreturn DracoDecoderModule;'
  )();

  console.log('[Draco] Factory type:', typeof createModule);

  const decoder = await createModule({});

  console.log('[Draco] Decoder ready:', {
    Decoder: typeof decoder.Decoder,
    DecoderBuffer: typeof decoder.DecoderBuffer,
    Mesh: typeof decoder.Mesh,
    PointCloud: typeof decoder.PointCloud,
  });
}

main().catch((error) => {
  console.error('[Draco] Test failed:', error);
});
