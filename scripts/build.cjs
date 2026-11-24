const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const targets = require('./targets.json');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const platformDefines = Object.freeze({
  performance: 'globalThis.performance',
  Intl: 'globalThis.Intl'
});

function targetConfig(name) {
  if (!Object.hasOwn(targets, name)) {
    throw new Error(`未知构建目标 ${name ?? '（未指定）'}。运行 npm run build:list 查看可用目标。`);
  }
  const config = targets[name];
  const { renderer = 'webgl1' } = config;
  if (Object.hasOwn(config, 'webgl2')) {
    throw new Error(`目标 ${name} 请使用 renderer: "webgl1" 或 renderer: "webgl2"。`);
  }
  if (renderer !== 'webgl1' && renderer !== 'webgl2') {
    throw new Error(`目标 ${name} 的 renderer 必须为 "webgl1" 或 "webgl2"，收到 ${JSON.stringify(renderer)}。`);
  }
  return { ...config, renderer };
}

function typecheck(entry) {
  const ts = require('typescript');
  const configPath = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, root);
  const declarations = parsed.fileNames.filter((file) => file.endsWith('.d.ts'));
  const program = ts.createProgram([path.join(root, entry), ...declarations], parsed.options);
  const diagnostics = [config.error, ...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter(Boolean);
  if (diagnostics.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: (file) => file, getNewLine: () => '\n'
    }));
  }
}

function runtimeUrlFor(name, value) {
  if (value === undefined) return undefined;
  if (!targetConfig(name).runtimeResources) throw new Error(`目标 ${name} 未声明运行时资源。`);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || value.includes('?') || value.includes('#')) {
    throw new Error('--runtime-url 需要不含账号、查询参数或片段的 HTTP(S) 资源目录。');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function targetBuildOptions(name, runtimeUrl) {
  const { entry, renderer } = targetConfig(name);
  const url = runtimeUrlFor(name, runtimeUrl);
  return {
    absWorkingDir: root,
    entryPoints: [entry],
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2019',
    external: ['fs', 'path'],
    define: {
      ...platformDefines,
      GAME_RENDERER: JSON.stringify(renderer),
      GAME_RUNTIME_ASSET_URL: url ? JSON.stringify(url) : 'undefined',
      ...(renderer === 'webgl2' && { WebGL2RenderingContext: 'globalThis.WebGL2RenderingContext' })
    },
    metafile: true,
    write: false
  };
}

function compileTarget(name, runtimeUrl) {
  return buildSync({ ...targetBuildOptions(name, runtimeUrl), outfile: 'dist/game.bundle.js' });
}

function assetPath(file) {
  const segments = file.split('/');
  if (path.isAbsolute(file) || file.includes('\\') || file.includes(':')
    || segments.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`无效素材路径 ${file}。素材路径应相对于 media/。`);
  }
  return path.join(root, 'media', file);
}

function readAssetDirectory(directory, prefix) {
  const source = assetPath(directory);
  const entries = fs.readdirSync(source, { recursive: true, withFileTypes: true });
  if (entries.some(entry => !entry.isFile() && !entry.isDirectory())) {
    throw new Error(`素材目录 ${directory} 仅支持常规文件和目录。`);
  }
  const files = entries.filter(entry => entry.isFile()).map(entry => path.join(entry.parentPath, entry.name)).sort();
  return files.map(sourceFile => {
    const relative = path.relative(source, sourceFile).split(path.sep).join('/');
    return { file: `${prefix}/${relative}`, source: sourceFile };
  });
}

function listTargetAssets(name, runtimeUrl) {
  const { assets = [], packagedResources, runtimeResources } = targetConfig(name);
  return [
    ...assets.map(file => ({ file, source: assetPath(file) })),
    ...(packagedResources ? readAssetDirectory(packagedResources, `packaged/${name}`) : []),
    ...(runtimeResources && !runtimeUrl ? readAssetDirectory(runtimeResources, name) : [])
  ];
}

function readAssets(name, runtimeUrl) {
  return listTargetAssets(name, runtimeUrl).map(({ file, source }) => ({ file, bytes: fs.readFileSync(source) }));
}

function packageConfig(original, selected) {
  const config = JSON.parse(original.toString('utf8'));
  const managed = new Set(Object.keys(targets).filter(name => targets[name].runtimeResources));
  const existing = config.subpackages ?? [];
  const subpackages = existing.filter(pkg => !managed.has(pkg.name) || pkg.root !== `dist/resources/${pkg.name}`);
  subpackages.push(...selected);
  if (JSON.stringify(existing) === JSON.stringify(subpackages)) return original;
  if (subpackages.length) config.subpackages = subpackages;
  else delete config.subpackages;
  return Buffer.from(JSON.stringify(config, null, 2) + '\n');
}

function publish(name, bundle, assets, runtimeUrl) {
  const buildDir = path.join(root, '.build');
  fs.mkdirSync(buildDir, { recursive: true });
  if (fs.realpathSync(buildDir) !== buildDir) throw new Error(`构建暂存目录必须位于 ${root}`);
  const stage = fs.mkdtempSync(path.join(buildDir, 'target-'));
  const next = path.join(stage, 'next');
  const previous = path.join(stage, 'previous');
  const dist = path.join(root, 'dist');
  const lock = path.join(buildDir, 'publish.lock');
  const subpackages = targetConfig(name).runtimeResources && !runtimeUrl
    ? [{ name, root: `dist/resources/${name}` }]
    : [];
  const outputs = new Map(assets.map(({ file, bytes }) => [path.join('dist', 'resources', file), bytes]));
  outputs.set(path.join('dist', 'game.bundle.js'), Buffer.from(bundle));
  for (const { root: packageRoot } of subpackages) {
    const entry = path.join(packageRoot, 'game.js');
    if (!outputs.has(entry)) outputs.set(entry, Buffer.from('// Resource subpackage.\n'));
  }
  let canCleanStage = true;

  try {
    fs.mkdirSync(lock);
    try {
      fs.mkdirSync(dist, { recursive: true });
      if (fs.realpathSync(dist) !== dist) throw new Error(`产物目录必须位于 ${root}`);
      const entries = fs.readdirSync(dist, { recursive: true, withFileTypes: true });
      const relative = (entry) => path.relative(root, path.join(entry.parentPath, entry.name));
      if (entries.some((entry) => !entry.isFile() && !entry.isDirectory())) {
        throw new Error('dist 产物目录仅支持常规文件和目录。');
      }
      const existing = new Set(entries.filter((entry) => entry.isFile()).map(relative));
      const stale = [...existing].filter((file) => !outputs.has(file));
      const gameConfig = path.join(root, 'game.json');
      if (!fs.lstatSync(gameConfig).isFile()) throw new Error('game.json 必须为常规文件。');
      outputs.set('game.json', packageConfig(fs.readFileSync(gameConfig), subpackages));
      existing.add('game.json');
      const applied = [];

      // Keep the project tool's dist directory in place. Replace its generated files atomically.
      try {
        for (const file of [...outputs.keys(), ...stale]) {
          const output = path.join(root, file);
          const bytes = outputs.get(file);
          if (existing.has(file)) {
            const original = fs.readFileSync(output);
            if (bytes?.equals(original)) continue;
            const backup = path.join(previous, file);
            fs.mkdirSync(path.dirname(backup), { recursive: true });
            fs.writeFileSync(backup, original);
          }
          if (bytes) {
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(next, bytes);
            fs.renameSync(next, output);
          } else {
            fs.unlinkSync(output);
          }
          applied.push(file);
        }
      } catch (error) {
        let restoreError;
        for (const file of applied.reverse()) {
          const output = path.join(root, file);
          try {
            if (existing.has(file)) fs.renameSync(path.join(previous, file), output);
            else fs.unlinkSync(output);
          } catch (failure) {
            restoreError ??= failure;
          }
        }
        if (restoreError) {
          canCleanStage = false;
          throw new Error(`恢复上一份构建失败，备份位于 ${previous}。${restoreError.message}`);
        }
        throw error;
      }

      for (const dir of entries.filter((entry) => entry.isDirectory()).map(relative).sort((a, b) => b.length - a.length)) {
        try {
          fs.rmdirSync(path.join(root, dir));
        } catch (error) {
          if (!['ENOTEMPTY', 'EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(error.code)) throw error;
        }
      }
    } finally {
      fs.rmdirSync(lock);
    }
  } finally {
    if (canCleanStage && path.dirname(stage) === buildDir && path.basename(stage).startsWith('target-')) {
      fs.rmSync(stage, { recursive: true, force: true, maxRetries: 2 });
    }
  }
}

if (require.main === module) {
  const [name, flag, value, ...extra] = process.argv.slice(2);
  try {
    if (flag !== undefined && (name === '--list' || flag !== '--runtime-url' || !value || extra.length)) {
      throw new Error('用法 npm run build:target -- <目标名> [--runtime-url <资源目录 URL>]');
    }
    if (name === '--list') {
      for (const name of Object.keys(targets)) {
        const { entry, renderer } = targetConfig(name);
        console.log(`${name.padEnd(16)} ${renderer} · ${entry}`);
      }
    } else {
      const { entry, renderer } = targetConfig(name);
      const runtimeUrl = runtimeUrlFor(name, value);
      const assets = readAssets(name, runtimeUrl);
      typecheck(entry);
      const { outputFiles: [bundle], metafile } = compileTarget(name, runtimeUrl);
      publish(name, bundle.contents, assets, runtimeUrl);
      const inputs = Object.keys(metafile.outputs['dist/game.bundle.js'].inputs).length;
      console.log(`${name} · ${renderer} · ${entry}\ndist/game.bundle.js ${bundle.contents.length} bytes · ${inputs} modules`);
      for (const { file, bytes } of assets) console.log(`dist/resources/${file} ${bytes.length} bytes`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { compileTarget, readAssets, platformDefines, targetBuildOptions, listTargetAssets };
