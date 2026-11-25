const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { chromium } = require('playwright-core');
const { serveWebPreview } = require('./dev-web.cjs');
const { inspectHud } = require('./inspect-hud.cjs');

const root = path.resolve(__dirname, '..');
const devices = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  compact: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, hasTouch: false }
};

async function launchBrowser(channel) {
  const failures = [];
  for (const choice of channel ? [channel] : ['msedge', 'chrome', 'chromium']) {
    try {
      const browser = await chromium.launch({ channel: choice, headless: true, args: ['--enable-unsafe-swiftshader'] });
      return { browser, channel: choice };
    } catch (error) {
      failures.push(`${choice} · ${error.message.split('\n')[0]}`);
    }
  }
  throw new Error(`启动无头浏览器失败，请安装 Edge 或 Chrome，也可用 npx playwright-core install chromium。\n${failures.join('\n')}`);
}

async function checkDevice(browser, url, name, dir, checkHud) {
  const device = devices[name];
  const report = { device: name, viewport: device.viewport, errors: [], warnings: [] };
  const context = await browser.newContext(device);
  try {
    const page = await context.newPage();
    page.on('console', message => {
      if (message.type() === 'error') report.errors.push(message.text());
      if (message.type() === 'warning') report.warnings.push(message.text());
    });
    page.on('pageerror', error => report.errors.push(error.stack ?? error.message));
    page.on('requestfailed', request => report.errors.push(`${request.failure()?.errorText} ${request.url()}`));
    page.on('response', response => {
      if (response.status() >= 400) report.errors.push(`HTTP ${response.status()} ${response.url()}`);
    });
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      // 软件 WebGL 加载大型场景需要更多时间。轮询就绪状态可以避开帧回调。
      await page.waitForFunction(() => Boolean(globalThis.__miniGameBrowserCheck), undefined, { polling: 100, timeout: 45000 });
      report.webGLVersion = await page.evaluate(() => globalThis.__miniGameBrowserCheck.webGLVersion);
      if (checkHud) {
        const controls = await page.evaluate(() => globalThis.__miniGameBrowserCheck.inspectControls());
        if (!controls) throw new Error('该 App 尚未通过 HudView.inspectControls 提供触摸区域。');
        // 固定测试矩形用于发现遮挡，实际胶囊位置依微信设备而定。
        const capsule = device.hasTouch ? { x: device.viewport.width - 99, y: 18, width: 89, height: 32 } : undefined;
        const issues = inspectHud(controls, device.viewport, capsule);
        report.hud = { controls, ...(capsule && { capsule }), issues };
        for (const { id, message, severity, other } of issues) {
          const log = severity === 'error' ? report.errors : report.warnings;
          log.push(`${id}${other ? ' / ' + other : ''} · ${message}`);
        }
      }
    } catch (error) {
      const status = await page.locator('#status').textContent({ timeout: 500 }).catch(() => '');
      report.errors.push(`${status ? status + '\n' : ''}${error.message}`);
    }
    const screenshot = path.join(dir, `${name}.png`);
    try {
      await page.screenshot({ path: screenshot, timeout: 5000 });
      report.screenshot = screenshot;
    } catch (error) {
      report.errors.push(`截图失败 · ${error.message}`);
    }
  } finally {
    await context.close();
  }
  return report;
}

async function main() {
  const { values, positionals: [app, ...extra] } = parseArgs({
    allowPositionals: true,
    options: { browser: { type: 'string' }, device: { type: 'string', multiple: true }, hud: { type: 'boolean' } }
  });
  if (!app || extra.length) throw new Error('用法 npm run test:browser -- <app-id> [--device phone|compact|desktop] [--browser msedge|chrome|chromium] [--hud]');
  const selected = [...new Set(values.device ?? ['phone', 'desktop'])];
  if (selected.some(name => !Object.hasOwn(devices, name))) throw new Error('设备须为 phone、compact 或 desktop。');
  if (values.browser && !['msedge', 'chrome', 'chromium'].includes(values.browser)) throw new Error('浏览器须为 msedge、chrome 或 chromium。');

  const preview = await serveWebPreview(app, { watch: false, browserCheck: true });
  try {
    const destination = path.join(root, '.build', 'browser-check');
    fs.mkdirSync(destination, { recursive: true });
    const dir = fs.mkdtempSync(path.join(destination, `${app}-`));
    const { browser, channel } = await launchBrowser(values.browser);
    const results = [];
    try {
      for (const device of selected) results.push(await checkDevice(browser, preview.url, device, dir, values.hud));
    } finally {
      await browser.close();
    }
    const report = { app, browser: channel, passed: results.every(result => result.errors.length === 0), results };
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    for (const result of results) {
      console.log(`${result.device} · ${result.errors.length ? '失败' : `WebGL ${result.webGLVersion} 就绪`}`);
    }
    console.log(`报告 · ${path.join(dir, 'report.json')}`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    await preview.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
