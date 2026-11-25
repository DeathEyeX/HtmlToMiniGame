const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const ts = require('typescript');
const {
  compileTarget, readAssets, targetConfig, runtimeUrlFor, targetOutputs, packageConfig
} = require('./build.cjs');

const root = path.resolve(__dirname, '..');
const loaderMethods = new Set(['loadImage', 'readBinary']);

function modelUris(file, bytes) {
  let json = bytes;
  if (file.endsWith('.glb')) {
    // GLB v2 的 JSON 是第一个块，外部图片和缓冲区 URI 与模型位于同一资源来源。
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF'
      || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length
      || bytes.toString('ascii', 16, 20) !== 'JSON'
      || 20 + bytes.readUInt32LE(12) > bytes.length) {
      throw new Error('GLB 头或 JSON 块无效。');
    }
    json = bytes.subarray(20, 20 + bytes.readUInt32LE(12));
  }
  const manifest = JSON.parse(json.toString('utf8'));
  return [...(manifest.images ?? []), ...(manifest.buffers ?? [])].flatMap(({ uri }) => typeof uri === 'string' ? [uri] : []);
}

function inspectModelAssets(assets) {
  const files = new Set(assets.map(({ file }) => file));
  const errors = [];
  const external = [];
  for (const { file, bytes } of assets) {
    if (!/\.(?:glb|gltf)$/iu.test(file)) continue;
    try {
      for (const uri of modelUris(file.toLowerCase(), bytes)) {
        if (/^data:/iu.test(uri)) continue;
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(uri)) {
          external.push({ model: file, uri });
          continue;
        }
        const relative = decodeURIComponent(uri.split(/[?#]/u, 1)[0]);
        const asset = path.posix.join(path.posix.dirname(file), relative);
        if (relative.startsWith('/') || relative.includes('\\') || !files.has(asset)) {
          errors.push({ code: 'MISSING_MODEL_ASSET', file, uri, expected: asset });
        }
      }
    } catch (error) {
      errors.push({ code: 'INVALID_MODEL', file, message: error.message });
    }
  }
  return { errors, external };
}

function loaderKind(receiver) {
  if (receiver === 'runtime' || receiver === 'runtimeResources') return 'runtime';
  if (receiver === 'packaged' || receiver === 'packagedResources') return 'packaged';
}

function loaderCall(expression) {
  if (ts.isPropertyAccessExpression(expression) && loaderMethods.has(expression.name.text)) {
    const receiver = expression.expression;
    return {
      method: expression.name.text,
      kind: loaderKind(ts.isPropertyAccessExpression(receiver) ? receiver.name.text : receiver.getText())
    };
  }
}

function inspectLoaderCalls(name, inputs, assets) {
  const files = new Set(assets.map(({ file }) => file));
  const sources = inputs.filter(file => /^src\/game\/.*\.[cm]?[jt]s$/u.test(file))
    .map(file => ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true));
  const aliases = new Map();
  const errors = [];
  const dynamic = [];
  let checked = 0;
  function walk(node, visit) {
    visit(node);
    ts.forEachChild(node, child => walk(child, visit));
  }
  // 识别 readOceanFile 之类的直接方法别名。运行时拼接路径保留为提示。
  for (const source of sources) {
    walk(source, node => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
      const loader = loaderCall(node.initializer);
      if (loader) aliases.set(node.name.text, loader);
    });
  }
  for (const source of sources) {
    walk(source, node => {
      if (!ts.isCallExpression(node) || !node.arguments.length) return;
      const call = node.expression;
      const loader = loaderCall(call) ?? (ts.isIdentifier(call) ? aliases.get(call.text) : undefined);
      if (!loader) return;
      const arg = node.arguments[0];
      const { line } = source.getLineAndCharacterOfPosition(arg.getStart(source));
      const location = { file: source.fileName, line: line + 1 };
      if (!ts.isStringLiteralLike(arg)) {
        dynamic.push({ ...location, method: loader.method });
        return;
      }
      const asset = arg.text;
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(asset)) {
        dynamic.push({ ...location, method: loader.method, asset });
        return;
      }
      const candidates = loader.kind === 'runtime' ? [`${name}/${asset}`]
        : loader.kind === 'packaged' ? [`packaged/${name}/${asset}`]
          : [asset, `packaged/${name}/${asset}`, `${name}/${asset}`];
      checked++;
      if (!candidates.some(candidate => files.has(candidate))) {
        errors.push({ code: 'MISSING_LOADER_ASSET', ...location, asset, expected: candidates });
      }
    });
  }
  return { errors, dynamic, checked };
}

function summarize(files) {
  return {
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    count: files.length,
    largest: [...files].sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file)).slice(0, 10)
  };
}

function moduleBreakdown(inputs) {
  const byGroup = new Map();
  for (const [file, { bytesInOutput }] of Object.entries(inputs)) {
    const parts = file.split('/');
    const group = parts[0] === 'node_modules'
      ? parts.slice(0, parts[1]?.startsWith('@') ? 3 : 2).join('/')
      : parts.slice(0, parts[2] === 'apps' ? 4 : parts[1] === 'game' ? 3 : 2).join('/');
    byGroup.set(group, (byGroup.get(group) ?? 0) + bytesInOutput);
  }
  return [...byGroup].map(([group, bytes]) => ({ group, bytes })).sort((a, b) => b.bytes - a.bytes);
}

function createBuildReport(name, requestedUrl) {
  const { entry, renderer, runtimeResources } = targetConfig(name);
  const runtimeUrl = runtimeUrlFor(name, requestedUrl);
  const { outputFiles: [bundle], metafile } = compileTarget(name, runtimeUrl);
  const bundled = readAssets(name, runtimeUrl);
  const assets = runtimeUrl ? readAssets(name) : bundled;
  const bundledNames = new Set(bundled.map(({ file }) => file));
  const { outputs, subpackages } = targetOutputs(name, bundle.contents, bundled, runtimeUrl);
  outputs.set('game.js', fs.readFileSync(path.join(root, 'game.js')));
  outputs.set('game.json', packageConfig(fs.readFileSync(path.join(root, 'game.json')), subpackages));
  const files = [...outputs].map(([file, bytes]) => ({ file: file.split(path.sep).join('/'), bytes: bytes.length }));
  const inSubpackage = (file, prefix) => file.file.startsWith(`${prefix}/`);
  const models = inspectModelAssets(assets);
  const references = inspectLoaderCalls(name, Object.keys(metafile.outputs['dist/game.bundle.js'].inputs), assets);
  const errors = [...models.errors, ...references.errors];
  return {
    target: name, entry, renderer,
    resourceMode: runtimeUrl ? 'remote' : runtimeResources ? 'subpackage' : 'main',
    passed: errors.length === 0,
    main: summarize(files.filter(file => !subpackages.some(pkg => inSubpackage(file, pkg.root)))),
    subpackages: subpackages.map(({ name: id, root: prefix }) => ({
      name: id, root: prefix, ...summarize(files.filter(file => inSubpackage(file, prefix)))
    })),
    remote: runtimeUrl ? {
      baseUrl: runtimeUrl,
      ...summarize(assets.filter(({ file }) => !bundledNames.has(file)).map(({ file, bytes }) => ({
        file: file.slice(name.length + 1), bytes: bytes.length
      })))
    } : null,
    bundle: { bytes: bundle.contents.length, groups: moduleBreakdown(metafile.outputs['dist/game.bundle.js'].inputs) },
    references: { staticCount: references.checked, dynamic: references.dynamic, externalModels: models.external },
    errors
  };
}

if (require.main === module) {
  try {
    const { values, positionals: [name, ...extra] } = parseArgs({
      allowPositionals: true, options: { 'runtime-url': { type: 'string' } }
    });
    if (!name || extra.length) throw new Error('用法 npm run build:report -- <app-id> [--runtime-url <URL>]');
    const report = createBuildReport(name, values['runtime-url']);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { createBuildReport, inspectModelAssets, inspectLoaderCalls };
