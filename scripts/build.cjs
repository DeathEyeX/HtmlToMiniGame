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

function compileTarget(name) {
  const { entry, renderer } = targetConfig(name);
  return buildSync({
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
      ...(renderer === 'webgl2' && { WebGL2RenderingContext: 'globalThis.WebGL2RenderingContext' })
    },
    outfile: 'dist/game.bundle.js',
    metafile: true,
    write: false
  });
}

function readAssets(name) {
  return (targetConfig(name).assets ?? []).map((file) => {
    const segments = file.split('/');
    if (path.isAbsolute(file) || file.includes('\\') || file.includes(':')
      || segments.some((part) => !part || part === '.' || part === '..')) {
      throw new Error(`无效素材路径 ${file}。素材路径应相对于 media/。`);
    }
    return { file, bytes: fs.readFileSync(path.join(root, 'media', file)) };
  });
}

function publish(bundle, assets) {
  const buildDir = path.join(root, '.build');
  fs.mkdirSync(buildDir, { recursive: true });
  if (fs.realpathSync(buildDir) !== buildDir) throw new Error(`构建暂存目录必须位于 ${root}`);
  const stage = fs.mkdtempSync(path.join(buildDir, 'target-'));
  const next = path.join(stage, 'next');
  const previous = path.join(stage, 'previous');
  const dist = path.join(root, 'dist');
  const lock = path.join(buildDir, 'publish.lock');
  const outputs = new Map(assets.map(({ file, bytes }) => [path.join('resources', file), bytes]));
  outputs.set('game.bundle.js', Buffer.from(bundle));
  let canCleanStage = true;

  try {
    fs.mkdirSync(lock);
    try {
      fs.mkdirSync(dist, { recursive: true });
      if (fs.realpathSync(dist) !== dist) throw new Error(`产物目录必须位于 ${root}`);
      const entries = fs.readdirSync(dist, { recursive: true, withFileTypes: true });
      const relative = (entry) => path.relative(dist, path.join(entry.parentPath, entry.name));
      if (entries.some((entry) => !entry.isFile() && !entry.isDirectory())) {
        throw new Error('dist 产物目录仅支持常规文件和目录。');
      }
      const existing = new Set(entries.filter((entry) => entry.isFile()).map(relative));
      const stale = [...existing].filter((file) => !outputs.has(file));
      const applied = [];

      // Keep the project tool's dist directory in place. Replace its generated files atomically.
      try {
        for (const file of [...outputs.keys(), ...stale]) {
          const output = path.join(dist, file);
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
          const output = path.join(dist, file);
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
          fs.rmdirSync(path.join(dist, dir));
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
  const [name] = process.argv.slice(2);
  try {
    if (name === '--list') {
      for (const name of Object.keys(targets)) {
        const { entry, renderer } = targetConfig(name);
        console.log(`${name.padEnd(16)} ${renderer} · ${entry}`);
      }
    } else {
      const { entry, renderer } = targetConfig(name);
      const assets = readAssets(name);
      typecheck(entry);
      const { outputFiles: [bundle], metafile } = compileTarget(name);
      publish(bundle.contents, assets);
      const inputs = Object.keys(metafile.outputs['dist/game.bundle.js'].inputs).length;
      console.log(`${name} · ${renderer} · ${entry}\ndist/game.bundle.js ${bundle.contents.length} bytes · ${inputs} modules`);
      for (const { file, bytes } of assets) console.log(`dist/resources/${file} ${bytes.length} bytes`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { compileTarget, readAssets, platformDefines };
