const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: "export { createBeast } from './beast'; export { createWraith } from './wraith';",
    resolveDir: 'src/game/apps/cyber-beast/three'
  },
  bundle: true,
  format: 'cjs',
  external: ['three-platformize'],
  write: false
});
const output = { exports: {} };
vm.runInNewContext(bundle.text, { module: output, require });

for (const [name, create] of [
  ['hound', output.exports.createBeast],
  ['wraith', output.exports.createWraith]
]) {
  test(`${name} lifts every foot in turn while keeping its support feet down`, () => {
    const model = create();
    const lifted = model.contacts.map(() => false);

    for (let frame = 0; frame <= 150; frame++) {
      const time = frame / 120;
      model.update(time, time, 1);
      assert.ok(model.contacts.filter(point => point.y < .001).length >= model.contacts.length / 2,
        `lost support at ${time}s`);
      model.contacts.forEach((point, index) => {
        lifted[index] ||= point.y > .25;
      });
      assert.equal(model.root.position.x, 0);
      assert.equal(model.root.position.z, 0);
    }

    assert.ok(lifted.every(Boolean));
    model.update(1.25, 1.25, 0);
    assert.ok(model.contacts.every(point => point.y < .001));
  });
}
