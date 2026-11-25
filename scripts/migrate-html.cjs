const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { buildSync } = require('esbuild');
const ts = require('typescript');
const { typecheck, entryBuildOptions } = require('./build.cjs');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const extensions = ['.ts', '.js', '.mjs'];
const browserBindings = new Set([
  'document', 'window', 'localStorage', 'sessionStorage', 'XMLHttpRequest', 'fetch',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setAnimationLoop'
]);

function resolvedInside(base, name) {
  if (!name || path.isAbsolute(name) || /[:?#\\]/u.test(name)) throw new Error(`需要本地相对路径，收到 ${name}`);
  const absolute = fs.realpathSync(path.resolve(base, name));
  const relative = path.relative(base, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`路径超出原型目录 ${name}`);
  }
  return relative.split(path.sep).join('/');
}

function modulePath(directory, specifier, from = '') {
  const joined = path.posix.join(path.posix.dirname(from), specifier);
  const extension = path.extname(joined);
  const candidates = !extension
    ? extensions.flatMap(ext => [joined + ext, `${joined}/index${ext}`])
    : extension === '.js' ? [joined, joined.slice(0, -3) + '.ts'] : [joined];
  for (const candidate of candidates) {
    if (extensions.includes(path.extname(candidate)) && fs.existsSync(path.join(directory, candidate))) {
      const resolved = resolvedInside(directory, candidate);
      if (fs.statSync(path.join(directory, resolved)).isFile()) return resolved;
    }
  }
  throw new Error(`找不到本地 JS / TS 模块 ${specifier}`);
}

async function scanPrototype(entryFile, config = {}) {
  const { parse } = await import('parse5');
  const input = fs.realpathSync(entryFile);
  const directory = path.dirname(input);
  const htmlName = path.basename(input);
  const html = fs.readFileSync(input, 'utf8');
  const issues = [];
  const references = [];
  const scripts = [];
  const modules = new Map();
  const defaultId = (/^index\.html?$/iu.test(htmlName) ? path.basename(directory) : path.parse(htmlName).name)
    .toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
  const id = config.id ?? defaultId;
  const renderer = config.renderer ?? 'webgl1';

  function issue(code, message, file = htmlName, line = 1, column = 1, severity = 'error') {
    issues.push({ severity, code, file, line, column, message });
  }

  function inspectMarkup(node, inBody = false) {
    const tag = node.tagName;
    const at = node.sourceCodeLocation;
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    const warn = (code, message, severity) => issue(code, message, htmlName, at?.startLine, at?.startCol, severity);
    if (tag === 'script' && at && !['application/json', 'application/ld+json'].includes(attrs.type)) {
      scripts.push({ src: attrs.src, module: attrs.type === 'module', at });
    } else if (at && inBody && tag && tag !== 'canvas') {
      warn('HTML_HUD', `<${tag}> 需要迁移到 Pixi HUD 或场景代码。`);
    }
    if (at && (tag === 'style' || (tag === 'link' && attrs.rel === 'stylesheet') || 'style' in attrs)) {
      warn('CSS_LAYOUT', '原型样式需在框架中按视口重新实现或核对。', 'warning');
    }
    if (at && (tag === 'base' || Object.keys(attrs).some(name => name.startsWith('on')))) {
      warn('HTML_BEHAVIOR', 'HTML 基础地址或内联事件需要显式迁移。');
    }
    for (const name of ['src', 'href', 'poster']) {
      if (at && attrs[name]) references.push({ tag, attribute: name, value: attrs[name], line: at.startLine });
    }
    for (const child of node.childNodes ?? []) inspectMarkup(child, inBody || tag === 'body');
  }

  inspectMarkup(parse(html, { sourceCodeLocationInfo: true }));
  if (typeof id !== 'string' || id.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(id)) {
    issue('APP_ID', '请在配置中设置以字母开头的小写 App ID，可用连字符分词。');
  }
  if (!['webgl1', 'webgl2'].includes(renderer)) issue('RENDERER', 'renderer 必须为 webgl1 或 webgl2。');
  if (scripts.length !== 1 || !scripts[0]?.module) {
    issue('SCRIPT_ENTRY', '生成需要一个 <script type="module"> 入口。');
  }

  function scanModule(name, text, location = {}) {
    if (modules.has(name)) return modules.get(name);
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    const edits = [];
    const renderers = new Set(['WebGLRenderer', 'WebGL1Renderer']);
    const record = { exportsScene: false, text };
    modules.set(name, record);
    const at = (code, message, offset) => {
      const { line, character } = source.getLineAndCharacterOfPosition(offset);
      issue(code, message, location.file ?? name, (location.line ?? 1) + line, character + 1 + (line ? 0 : (location.column ?? 0)));
    };
    for (const error of source.parseDiagnostics) {
      at('JS_SYNTAX', ts.flattenDiagnosticMessageText(error.messageText, ' '), error.start ?? 0);
    }
    record.exportsScene = source.statements.some(node =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'createScene'
      && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
      && !node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
    function visit(node) {
      if (ts.isImportSpecifier(node) && renderers.has(node.propertyName?.text)) renderers.add(node.name.text);
      const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
      if (specifier) {
        const offset = specifier.getStart(source);
        if (!ts.isStringLiteralLike(specifier)) {
          at('DYNAMIC_IMPORT', '需要明确的本地模块路径。', offset);
        } else {
          const value = specifier.text;
          if (value === 'three' || value.startsWith('three/addons/') || value.startsWith('three/examples/jsm/')) {
            const replacement = value === 'three' ? 'three-platformize'
              : value.replace(/^three\/(?:addons\/|examples\/jsm\/)/u, 'three-platformize/examples/jsm/');
            edits.push({ start: offset, end: specifier.end, value: JSON.stringify(replacement) });
          } else if (value.startsWith('./') || value.startsWith('../')) {
            try {
              const dependency = modulePath(directory, value, name);
              scanModule(dependency, fs.readFileSync(path.join(directory, dependency), 'utf8'));
            } catch (error) {
              at('MODULE_PATH', error.message, offset);
            }
          } else if (value !== 'three-platformize' && !value.startsWith('three-platformize/examples/jsm/')) {
            at('EXTERNAL_MODULE', `${value} 需要单独适配。`, offset);
          }
        }
      }
      if (ts.isIdentifier(node) && browserBindings.has(node.text)) {
        at('PLATFORM_API', `${node.text} 需要改用框架提供的渲染、输入或资源接口。`, node.getStart(source));
      }
      if (ts.isNewExpression(node)) {
        const constructor = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
        if (ts.isIdentifier(constructor) && renderers.has(constructor.text)) {
          at('RENDERER_OWNER', '请使用 startGame 传入的渲染器。', node.getStart(source));
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    // 保留原型其余代码和相对导入，只改已知 Three.js 模块名。
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      record.text = record.text.slice(0, edit.start) + edit.value + record.text.slice(edit.end);
    }
    return record;
  }

  let entry;
  for (const [index, script] of scripts.entries()) {
    try {
      let record;
      if (script.src !== undefined) {
        entry = modulePath(directory, resolvedInside(directory, script.src));
        record = scanModule(entry, fs.readFileSync(path.join(directory, entry), 'utf8'));
      } else if (script.at.endTag) {
        const { startTag, endTag } = script.at;
        entry = `__html_scene_${index + 1}.js`;
        if (fs.existsSync(path.join(directory, entry))) throw new Error(`内联脚本临时模块名冲突 ${entry}`);
        record = scanModule(entry, html.slice(startTag.endOffset, endTag.startOffset), {
          file: htmlName, line: startTag.endLine, column: startTag.endCol - 1
        });
      }
      if (!record?.exportsScene) {
        issue('SCENE_FACTORY', '入口模块应以 export function createScene 声明场景工厂。', htmlName, script.at.startLine, script.at.startCol);
      }
    } catch (error) {
      issue('SCRIPT_PATH', error.message, htmlName, script.at.startLine, script.at.startCol);
    }
  }

  const resources = {};
  for (const [key, kind] of [['packagedResources', 'packaged'], ['runtimeResources', 'runtime']]) {
    if (config[key] === undefined) continue;
    try {
      const relative = resolvedInside(directory, config[key]);
      const source = path.join(directory, relative);
      if (!relative) throw new Error('请指定单独的素材目录。');
      const entries = fs.readdirSync(source, { withFileTypes: true, recursive: true });
      if (entries.some(item => !item.isDirectory() && !item.isFile())) throw new Error('素材目录仅支持常规文件和目录。');
      if (!entries.some(item => item.isFile())) throw new Error('素材目录为空。');
      resources[kind] = source;
    } catch (error) {
      issue('ASSET_PATH', `${key} · ${error.message}`);
    }
  }

  return { id, renderer, entry, directory, modules, resources, issues, references };
}

function appEntry(plan) {
  const { id, entry, resources } = plan;
  const hasAssets = Object.keys(resources).length > 0;
  const lines = [
    "import { startGame, type CreateLocalScene } from '../../../framework/runtime/startGame';",
    "import { reportStartupError } from '../../common/ui/reportStartupError';",
    `import { createScene } from ${JSON.stringify('./three/' + entry.replace(/\.ts$/u, ''))};`,
    ''
  ];
  if (hasAssets) {
    lines.unshift("import { createResourceLoader } from '../../../framework/assets/createResourceLoader';");
    if (resources.runtime) lines.push("declare const GAME_RUNTIME_ASSET_URL: string | undefined;", '');
    lines.push('const resources = {');
    if (resources.packaged) lines.push(`  packaged: createResourceLoader({ kind: 'package', root: 'dist/resources/packaged/${id}' }),`);
    if (resources.runtime) lines.push(
      '  runtime: createResourceLoader(typeof GAME_RUNTIME_ASSET_URL !== \'undefined\' && GAME_RUNTIME_ASSET_URL',
      "    ? { kind: 'remote', baseUrl: GAME_RUNTIME_ASSET_URL }",
      `    : { kind: 'subpackage', name: '${id}', root: 'dist/resources/${id}' }),`
    );
    lines.push('};',
      'const createImportedScene: (...args: [...Parameters<CreateLocalScene>, typeof resources]) => ReturnType<typeof createScene> = createScene;',
      '');
  } else {
    lines[0] = "import { startGame } from '../../../framework/runtime/startGame';";
  }
  const factory = hasAssets ? '(...args) => createImportedScene(...args, resources)' : 'createScene';
  lines.push(
    `void startGame(${factory}, {`,
    `  tag: '[${id}]', hudReadyMessage: 'HUD ready', showHudErrorModal: true`,
    `}).catch((error: unknown) => reportStartupError('[${id}]', '原型启动失败', error));`,
    ''
  );
  return lines.join('\n');
}

function applyMigration(plan) {
  if (plan.issues.some(({ severity }) => severity === 'error')) throw new Error('请先处理迁移报告中的错误。');
  const { id, renderer, modules, resources } = plan;
  const targetsFile = path.join(root, 'scripts', 'targets.json');
  const app = path.join(root, 'src', 'game', 'apps', id);
  const media = path.join(root, 'media', id);
  const buildRoot = path.join(root, '.build');
  fs.mkdirSync(buildRoot, { recursive: true });
  for (const directory of [buildRoot, path.dirname(app), path.dirname(media)]) {
    if (fs.realpathSync(directory) !== directory) throw new Error(`迁移目录须位于当前仓库 ${directory}`);
  }
  const lock = path.join(buildRoot, 'migrate-html.lock');
  fs.mkdirSync(lock);
  const committed = [];
  let stage;
  try {
    const original = fs.readFileSync(targetsFile, 'utf8');
    const targets = JSON.parse(original);
    if (Object.hasOwn(targets, id) || fs.existsSync(app) || fs.existsSync(media)) {
      throw new Error(`目标或目录 ${id} 已存在，请使用另一 App ID。`);
    }
    stage = fs.mkdtempSync(path.join(buildRoot, 'migrate-html-'));
    const appStage = path.join(stage, 'app');
    for (const [name, { text }] of modules) {
      const dest = path.join(appStage, 'three', name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, text);
    }
    fs.writeFileSync(path.join(appStage, 'main.ts'), appEntry(plan));
    const entry = `src/game/apps/${id}/main.ts`;
    const target = { entry, renderer };
    for (const [kind, source] of Object.entries(resources)) {
      fs.cpSync(source, path.join(stage, 'media', kind), { recursive: true });
      target[`${kind}Resources`] = `${id}/${kind}`;
    }
    const targetsStage = path.join(stage, 'targets.json');
    // 提交清单前用现有构建选项检查生成入口。打包在内存中完成，失败时回收本次目录。
    fs.renameSync(appStage, app);
    committed.push(app);
    if (Object.keys(resources).length) {
      fs.renameSync(path.join(stage, 'media'), media);
      committed.push(media);
    }
    typecheck(entry);
    buildSync({ ...entryBuildOptions(entry, renderer), logLevel: 'silent' });
    if (fs.readFileSync(targetsFile, 'utf8') !== original) throw new Error('目标清单已被修改，请重新运行迁移。');
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const targetText = JSON.stringify({ [id]: target }, null, 2).slice(1, -1).trimEnd().replaceAll('\n', newline);
    const close = original.lastIndexOf('}');
    const prefix = original.slice(0, close).trimEnd();
    fs.writeFileSync(targetsStage, `${prefix}${Object.keys(targets).length ? ',' : ''}${targetText}${newline}${original.slice(close)}`);
    fs.renameSync(targetsStage, targetsFile);
    return target;
  } catch (error) {
    for (const dir of committed.reverse()) fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  } finally {
    if (stage) fs.rmSync(stage, { recursive: true, force: true });
    fs.rmdirSync(lock);
  }
}

async function main() {
  const { values, positionals: [file, ...extra] } = parseArgs({
    allowPositionals: true,
    options: { config: { type: 'string' }, apply: { type: 'boolean' } }
  });
  if (!file || extra.length) throw new Error('用法 npm run migrate:html -- <原型.html> [--config <迁移配置.json>] [--apply]');
  const config = values.config ? JSON.parse(fs.readFileSync(values.config, 'utf8')) : {};
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || Object.keys(config).some(key => !['id', 'renderer', 'packagedResources', 'runtimeResources'].includes(key))) {
    throw new Error('迁移配置只支持 id、renderer、packagedResources 和 runtimeResources。');
  }
  const plan = await scanPrototype(file, config);
  const { id, renderer, entry, modules, resources, issues, references } = plan;
  const canApply = !issues.some(({ severity }) => severity === 'error');
  const report = { id, renderer, entry, canApply, modules: [...modules.keys()], resources, references, issues };
  if (values.apply && canApply) report.target = applyMigration(plan);
  console.log(JSON.stringify(report, null, 2));
  if (!canApply) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { scanPrototype };
