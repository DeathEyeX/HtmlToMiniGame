import { WebGLRenderer } from 'three-platformize';

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL2 could not allocate a shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`GLSL ES 3.00 compilation failed: ${detail}`);
  }
  return shader;
}

function verifyDraw(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error('WebGL2 could not allocate a program');
  let vertex: WebGLShader | undefined;
  let fragment: WebGLShader | undefined;
  let vao: WebGLVertexArrayObject | null = null;
  try {
    vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`);
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      out vec4 color;
      void main() { color = vec4(0.0, 1.0, 0.0, 1.0); }`);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`WebGL2 program linking failed: ${gl.getProgramInfoLog(program)}`);
    }
    vao = gl.createVertexArray();
    if (!vao) throw new Error('WebGL2 could not allocate a vertex array');
    gl.bindVertexArray(vao);
    gl.useProgram(program);
    gl.viewport(0, 0, 1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const error = gl.getError();
    if (error !== gl.NO_ERROR || pixel[0] !== 0 || pixel[1] !== 255 || pixel[2] !== 0 || pixel[3] !== 255) {
      throw new Error(`WebGL2 draw/readPixels failed (GL error ${error}, pixel ${pixel.join(',')})`);
    }
    console.log('[WebGL2] Native draw verified', [...pixel]);
  } finally {
    if (vao) {
      gl.bindVertexArray(null);
      gl.deleteVertexArray(vao);
    }
    gl.useProgram(null);
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    gl.deleteProgram(program);
  }
}

function exposeContextType(context: WebGL2RenderingContext) {
  const native = globalThis.WebGL2RenderingContext;
  if (typeof native === 'function' && context instanceof native) return;

  // Three r133 uses instanceof, while the native WeChat object can lack the browser constructor.
  Object.defineProperty(globalThis, 'WebGL2RenderingContext', {
    configurable: true,
    value: class {
      static [Symbol.hasInstance](value: unknown) {
        return value === context || (typeof native === 'function' && value instanceof native);
      }
    }
  });
  console.log('[WebGL2] Three context type bridge installed');
}

export function createWebGL2Renderer(canvas: HTMLCanvasElement) {
  const { platform, system, model, SDKVersion, version } = wx.getSystemInfoSync();
  console.log('[WebGL2] Environment', { platform, system, model, SDKVersion, version });
  const attributes = { alpha: false, antialias: true, depth: true, stencil: true };
  const context = canvas.getContext('webgl2', attributes) as WebGL2RenderingContext | null;
  if (!context || typeof context.createVertexArray !== 'function') {
    throw new Error('The screen canvas did not provide a WebGL2 context with native vertex arrays');
  }
  console.log('[WebGL2] Native context', {
    version: context.getParameter(context.VERSION),
    shadingLanguage: context.getParameter(context.SHADING_LANGUAGE_VERSION),
    stencil: context.getContextAttributes()?.stencil
  });
  verifyDraw(context);
  exposeContextType(context);

  const renderer = new WebGLRenderer({ canvas, context: context as unknown as WebGLRenderingContext, ...attributes });
  if (!renderer.capabilities.isWebGL2 || renderer.getContext() !== context) {
    throw new Error('Three did not adopt the verified WebGL2 context');
  }
  console.log('[WebGL2] Three WebGL version', 2);
  return renderer;
}
