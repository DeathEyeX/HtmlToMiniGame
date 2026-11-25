const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { listTargetAssets, targetBuildOptions } = require('./build.cjs');

function webBuildOptions(name, { browserCheck = false, release = false, liveReload = !release } = {}) {
  const options = targetBuildOptions(name);
  const [entry] = options.entryPoints;
  const root = options.absWorkingDir;
  const files = new Map([['index.html', path.join(root, 'scripts/web/index.html')]]);
  for (const { file, source } of listTargetAssets(name)) files.set(`dist/resources/${file}`, source);

  // The existing model demo can use its local fixture without a separate asset server.
  const modelTargets = ['model-viewer', 'showcase-model', 'webgl2-model'];
  const model = path.join(root, '../WechatAssetServer/model.glb');
  const modelUrl = 'models/model.glb';
  if (modelTargets.includes(name)) {
    if (fs.statSync(model, { throwIfNoEntry: false })?.isFile()) files.set(modelUrl, model);
    else if (release) throw new Error('静态模型示例需要同级 WechatAssetServer/model.glb。');
  }

  return {
    ...options,
    // 联调和导出使用同一份内存文件，导出命令再发布到独立目录。
    outdir: path.join('.build', 'web', name),
    entryPoints: [
      { in: entry, out: 'game' },
      { in: './src/framework/platform/browser/installBrowserWx.ts', out: 'platform' },
      ...[...files.keys()].map(file => ({
        in: `web-file:${file}`, out: file.slice(0, file.length - path.extname(file).length)
      }))
    ],
    sourcemap: release ? false : 'linked',
    minify: release,
    define: {
      ...options.define,
      GAME_BROWSER_CHECK: JSON.stringify(browserCheck),
      GAME_WEB_MODEL_URL: files.has(modelUrl) ? JSON.stringify(modelUrl) : 'undefined'
    },
    plugins: [{
      name: 'web-preview',
      setup(build) {
        build.onResolve({ filter: /^web-file:/ }, ({ path: request }) => ({
          namespace: 'web-file', path: files.get(request.slice('web-file:'.length))
        }));
        build.onLoad({ filter: /.*/, namespace: 'web-file' }, async ({ path: source }) => {
          let contents = await fs.promises.readFile(source);
          if (source === files.get('index.html')) {
            const reload = liveReload ? "<script>new EventSource('/esbuild').addEventListener('change', () => location.reload());</script>" : '';
            contents = contents.toString('utf8').replace('<!-- web live reload -->', reload);
          }
          return { contents, loader: 'copy', watchFiles: [source] };
        });
        build.onResolve({ filter: /^\.\/WechatAssetLoader\.js$/ }, ({ resolveDir }) => {
          if (resolveDir === path.join(root, 'src/framework/assets/model')) {
            return { path: path.join(resolveDir, 'loadBrowserModel.ts') };
          }
        });
      }
    }]
  };
}

async function serveWebPreview(name, { watch = true, browserCheck = false } = {}) {
  const context = await esbuild.context(webBuildOptions(name, { browserCheck, liveReload: watch }));
  try {
    if (watch) await context.watch();
    else await context.rebuild();
    const { port } = await context.serve({ host: '127.0.0.1' });
    return { url: `http://127.0.0.1:${port}/`, close: () => context.dispose() };
  } catch (error) {
    await context.dispose();
    throw error;
  }
}

if (require.main === module) {
  const [name, ...extra] = process.argv.slice(2);
  if (!name || extra.length) {
    console.error('用法 npm run dev:web -- <目标名>。运行 npm run build:list 查看可用目标。');
    process.exitCode = 1;
  } else {
    serveWebPreview(name).then(({ url }) => {
      console.log(`${name} · ${url} (Ctrl+C 停止)`);
    }).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { webBuildOptions, serveWebPreview };
