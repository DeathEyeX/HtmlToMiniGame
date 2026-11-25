const path = require('node:path');
const { build } = require('esbuild');
const { webBuildOptions } = require('./dev-web.cjs');
const { typecheck } = require('./build.cjs');
const { writeRelease } = require('./release-output.cjs');

async function main() {
  const [name, ...extra] = process.argv.slice(2);
  if (!name || extra.length) throw new Error('用法 npm run build:web -- <目标名>');
  const options = webBuildOptions(name, { release: true });
  typecheck(options.entryPoints[0].in);
  const { outputFiles } = await build(options);
  const outputRoot = path.resolve(options.absWorkingDir, options.outdir);
  const files = new Map(outputFiles.map(file => [path.relative(outputRoot, file.path), Buffer.from(file.contents)]));
  const destination = writeRelease(name, 'web', files);
  console.log(`${name} · Web 产物 ${destination} · ${files.size} 个文件`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
