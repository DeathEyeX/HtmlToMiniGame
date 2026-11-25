const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { buildSync } = require('esbuild');
const targets = require('./targets.json');
const { writeRelease, publishFiles, outputEntries, pruneEmptyDirectories } = require('./release-output.cjs');

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
  return entryBuildOptions(entry, renderer, runtimeUrlFor(name, runtimeUrl));
}

function entryBuildOptions(entry, renderer, url) {
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
      GAME_BROWSER_CHECK: 'false',
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

function targetOutputs(name, bundle, assets, runtimeUrl) {
  const subpackages = targetConfig(name).runtimeResources && !runtimeUrl
    ? [{ name, root: `dist/resources/${name}` }]
    : [];
  const outputs = new Map(assets.map(({ file, bytes }) => [path.join('dist', 'resources', file), bytes]));
  outputs.set(path.join('dist', 'game.bundle.js'), Buffer.from(bundle));
  for (const { root: packageRoot } of subpackages) {
    const entry = path.join(packageRoot, 'game.js');
    if (!outputs.has(entry)) outputs.set(entry, Buffer.from('// Resource subpackage.\n'));
  }
  return { outputs, subpackages };
}

function exportWechat(name, bundle, assets, runtimeUrl) {
  const { outputs, subpackages } = targetOutputs(name, bundle, assets, runtimeUrl);
  const config = packageConfig(fs.readFileSync(path.join(root, 'game.json')), subpackages);
  outputs.set('game.json', config);
  for (const file of ['game.js', 'project.config.json']) outputs.set(file, fs.readFileSync(path.join(root, file)));
  // 手动声明的分包沿用原项目的路径。仅复制 game.json 明确引用的文件。
  for (const item of JSON.parse(config).subpackages ?? []) {
    if (subpackages.some(pkg => pkg.root === item.root)) continue;
    const source = path.resolve(root, item.root);
    if (path.isAbsolute(item.root) || !source.startsWith(root + path.sep) || fs.realpathSync(source) !== source) {
      throw new Error(`微信分包路径须位于当前仓库 ${item.root}`);
    }
    const stat = fs.lstatSync(source);
    const entries = stat.isDirectory() ? fs.readdirSync(source, { recursive: true, withFileTypes: true }) : [];
    if (entries.some(entry => !entry.isDirectory() && !entry.isFile()) || (!stat.isFile() && !stat.isDirectory())) {
      throw new Error(`微信分包须为常规文件或目录 ${item.root}`);
    }
    const files = stat.isFile() ? [source] : entries.filter(entry => entry.isFile()).map(entry => path.join(entry.parentPath, entry.name));
    for (const file of files) {
      const relative = path.relative(root, file);
      if (outputs.has(relative)) throw new Error(`微信分包覆盖生成文件 ${relative}`);
      outputs.set(relative, fs.readFileSync(file));
    }
  }
  return writeRelease(name, runtimeUrl ? 'wechat-remote' : 'wechat', outputs);
}

function publish(name, bundle, assets, runtimeUrl) {
  const buildDir = path.join(root, '.build');
  fs.mkdirSync(buildDir, { recursive: true });
  if (fs.realpathSync(buildDir) !== buildDir) throw new Error(`构建暂存目录必须位于 ${root}`);
  const { outputs, subpackages } = targetOutputs(name, bundle, assets, runtimeUrl);
  const dist = path.join(root, 'dist');
  const lock = path.join(buildDir, 'publish.lock');
  fs.mkdirSync(lock);
  try {
    fs.mkdirSync(dist, { recursive: true });
    if (fs.realpathSync(dist) !== dist) throw new Error(`产物目录必须位于 ${root}`);
    const entries = outputEntries(dist);
    const existing = new Set(entries.filter(entry => entry.isFile())
      .map(entry => path.relative(root, path.join(entry.parentPath, entry.name))));
    const gameConfig = path.join(root, 'game.json');
    if (!fs.lstatSync(gameConfig).isFile()) throw new Error('game.json 必须为常规文件。');
    outputs.set('game.json', packageConfig(fs.readFileSync(gameConfig), subpackages));
    existing.add('game.json');
    publishFiles(root, buildDir, outputs, existing);
    pruneEmptyDirectories(entries);
  } finally {
    fs.rmdirSync(lock);
  }
}

if (require.main === module) {
  try {
    const { values, positionals: [name, ...extra] } = parseArgs({
      allowPositionals: true,
      options: { list: { type: 'boolean' }, isolated: { type: 'boolean' }, 'runtime-url': { type: 'string' } }
    });
    if (extra.length || (values.list && (name || values.isolated || values['runtime-url'] !== undefined))) {
      throw new Error('用法 npm run build:target -- <目标名> [--isolated] [--runtime-url <资源目录 URL>]');
    }
    if (values.list) {
      for (const name of Object.keys(targets)) {
        const { entry, renderer } = targetConfig(name);
        console.log(`${name.padEnd(16)} ${renderer} · ${entry}`);
      }
    } else {
      const { entry, renderer } = targetConfig(name);
      const runtimeUrl = runtimeUrlFor(name, values['runtime-url']);
      const assets = readAssets(name, runtimeUrl);
      typecheck(entry);
      const { outputFiles: [bundle], metafile } = compileTarget(name, runtimeUrl);
      if (values.isolated) {
        const destination = exportWechat(name, bundle.contents, assets, runtimeUrl);
        console.log(`微信产物 · ${destination}`);
      } else {
        publish(name, bundle.contents, assets, runtimeUrl);
      }
      const inputs = Object.keys(metafile.outputs['dist/game.bundle.js'].inputs).length;
      console.log(`${name} · ${renderer} · ${entry}\ndist/game.bundle.js ${bundle.contents.length} bytes · ${inputs} modules`);
      for (const { file, bytes } of assets) console.log(`dist/resources/${file} ${bytes.length} bytes`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  compileTarget, readAssets, platformDefines, targetBuildOptions, entryBuildOptions, listTargetAssets,
  typecheck, targetConfig, runtimeUrlFor, targetOutputs, packageConfig
};
