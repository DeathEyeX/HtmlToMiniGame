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
  return targets[name];
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
  const { entry, webgl2 } = targetConfig(name);
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
      ...(webgl2 && { WebGL2RenderingContext: 'globalThis.WebGL2RenderingContext' })
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
  const next = path.join(stage, 'dist');
  const previous = path.join(stage, 'previous');
  const dist = path.join(root, 'dist');
  const lock = path.join(buildDir, 'publish.lock');
  let canCleanStage = true;

  try {
    fs.mkdirSync(next);
    fs.writeFileSync(path.join(next, 'game.bundle.js'), bundle);
    for (const { file, bytes } of assets) {
      const output = path.join(next, 'resources', file);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, bytes);
    }

    fs.mkdirSync(lock);
    try {
      const hadPrevious = fs.existsSync(dist);
      if (hadPrevious) {
        if (fs.realpathSync(dist) !== dist) throw new Error(`产物目录必须位于 ${root}`);
        fs.renameSync(dist, previous);
      }
      try {
        fs.renameSync(next, dist);
      } catch (error) {
        if (hadPrevious) {
          canCleanStage = false;
          try {
            fs.renameSync(previous, dist);
          } catch (restoreError) {
            throw new Error(`恢复上一份构建失败，产物保存在 ${previous}。${restoreError.message}`);
          }
          canCleanStage = true;
        }
        throw error;
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
      for (const [name, { entry }] of Object.entries(targets)) console.log(`${name.padEnd(16)} ${entry}`);
    } else {
      const { entry } = targetConfig(name);
      const assets = readAssets(name);
      typecheck(entry);
      const { outputFiles: [bundle], metafile } = compileTarget(name);
      publish(bundle.contents, assets);
      const inputs = Object.keys(metafile.outputs['dist/game.bundle.js'].inputs).length;
      console.log(`${name} · ${entry}\ndist/game.bundle.js ${bundle.contents.length} bytes · ${inputs} modules`);
      for (const { file, bytes } of assets) console.log(`dist/resources/${file} ${bytes.length} bytes`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { compileTarget, readAssets, platformDefines };
