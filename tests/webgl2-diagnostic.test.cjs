const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const { outputFiles: [bundle] } = buildSync({
  entryPoints: ['src/diagnostics/webGL2.ts'],
  bundle: true,
  format: 'cjs',
  external: ['three-platformize'],
  define: { WebGL2RenderingContext: 'globalThis.WebGL2RenderingContext' },
  write: false
});

function fixture(pixel = [0, 255, 0, 255]) {
  const calls = [];
  const context = {
    VERSION: 1, SHADING_LANGUAGE_VERSION: 2, NO_ERROR: 0,
    COMPILE_STATUS: 3, LINK_STATUS: 4, TRIANGLES: 5, RGBA: 6, UNSIGNED_BYTE: 7,
    VERTEX_SHADER: 8, FRAGMENT_SHADER: 9,
    getParameter: (name) => name === 1 ? 'WebGL 2.0' : 'WebGL GLSL ES 3.00',
    getContextAttributes: () => ({ stencil: true }),
    createShader: (type) => ({ type }),
    shaderSource(_shader, source) { assert.match(source, /^#version 300 es/); },
    compileShader() {},
    getShaderParameter: () => true,
    createProgram: () => ({}),
    attachShader() {},
    linkProgram() {},
    getProgramParameter: () => true,
    createVertexArray: () => ({}),
    bindVertexArray() {},
    useProgram() {},
    viewport() {},
    drawArrays(mode, first, count) { calls.push(['draw', mode, first, count]); },
    readPixels(_x, _y, _width, _height, _format, _type, buffer) { buffer.set(pixel); },
    getError: () => 0,
    deleteShader(shader) { calls.push(['release shader', shader.type]); },
    deleteVertexArray() { calls.push(['release vao']); },
    deleteProgram() { calls.push(['release program']); }
  };
  const sandbox = {
    module: { exports: {} },
    wx: { getSystemInfoSync: () => ({ platform: 'devtools' }) },
    console: { log() {} }
  };
  sandbox.require = () => ({
    WebGLRenderer: class {
      constructor(options) {
        assert.equal(options.context, context);
        assert.equal(context instanceof sandbox.WebGL2RenderingContext, true);
        assert.equal({} instanceof sandbox.WebGL2RenderingContext, false);
        assert.deepEqual(calls.at(-1), ['release program']);
        calls.push(['Three']);
        this.capabilities = { isWebGL2: true };
        this.getContext = () => options.context;
      }
    }
  });
  vm.runInNewContext(bundle.text, sandbox);
  return { context, calls, createRenderer: sandbox.module.exports.createWebGL2Renderer };
}

test('the diagnostic verifies a native draw and hands Three the exact same context', () => {
  const { context, calls, createRenderer } = fixture();
  const requests = [];
  const canvas = {
    getContext(type, options) {
      requests.push(type);
      assert.equal(options.stencil, true);
      return context;
    }
  };
  assert.equal(createRenderer(canvas).getContext(), context);
  assert.deepEqual(requests, ['webgl2']);
  assert.deepEqual(calls, [
    ['draw', 5, 0, 3], ['release vao'], ['release shader', 8],
    ['release shader', 9], ['release program'], ['Three']
  ]);
});

test('a missing or non-drawing WebGL2 context stops the diagnostic before Three', () => {
  const { context, calls, createRenderer } = fixture([0, 0, 0, 0]);
  assert.throws(() => createRenderer({ getContext(type) {
    assert.equal(type, 'webgl2');
    return null;
  } }), /did not provide a WebGL2 context/);
  assert.throws(() => createRenderer({ getContext: () => context }), /draw\/readPixels failed/);
  assert.deepEqual(calls.at(-1), ['release program']);
  assert.ok(!calls.some(([action]) => action === 'Three'));
});
