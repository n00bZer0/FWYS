// FWYS Stealth — webgl.js
// Complete WebGL/WebGL2 & WebGPU fingerprint spoofing
// Patches getParameter, getExtension, getSupportedExtensions, and GPUAdapter

const fp = __FWYS_FP__;
const gpu = fp.gpu || {};
const webglFp = fp.webgl || {};

const vendor   = gpu.vendor   || webglFp.vendor   || 'Google Inc. (NVIDIA)';
const renderer = gpu.renderer || webglFp.renderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

if (!vendor && !renderer) return;

// Check if native WebGL already matches requested vendor and renderer
try {
  const _testCanvas = document.createElement('canvas');
  const _testGl = _testCanvas.getContext('webgl');
  if (_testGl) {
    const _ext = _testGl.getExtension('WEBGL_debug_renderer_info');
    if (_ext) {
      const _nativeRend = _testGl.getParameter(_ext.UNMASKED_RENDERER_WEBGL);
      const _nativeVend = _testGl.getParameter(_ext.UNMASKED_VENDOR_WEBGL);
      if (_nativeRend === renderer && _nativeVend === vendor) {
        // Native GPU already matches! Preserving native C++ getParameter ensures
        // Function.prototype.toString returns [native code] and Worker WebGL agrees 100%.
        return;
      }
    }
  }
} catch (e) {}

// ── Helper: create native-like built-in method without a .prototype property ──
function makeNativeMethod(name, fn) {
  // Methods defined with ES6 shorthand on objects have NO .prototype property
  const wrapperObj = {
    [name](...args) {
      return fn.apply(this, args);
    }
  };
  const wrapped = wrapperObj[name];
  try { delete wrapped.prototype; } catch (e) {}

  Object.defineProperty(wrapped, 'name', { value: name, configurable: true });
  Object.defineProperty(wrapped, 'toString', {
    value: () => `function ${name}() { [native code] }`,
    configurable: true,
  });
  return wrapped;
}

// ── GL constants ──────────────────────────────────────────────────────────
const GL = {
  VENDOR:                    0x1F00,
  RENDERER:                  0x1F01,
  VERSION:                   0x1F02,
  SHADING_LANGUAGE_VERSION:  0x8B8C,
  UNMASKED_VENDOR_WEBGL:     0x9245,
  UNMASKED_RENDERER_WEBGL:   0x9246,
};

// ── Patch a WebGL context class ───────────────────────────────────────────
function patchWebGLClass(Ctx) {
  if (!Ctx || !Ctx.prototype) return;

  const origGetParameter = Ctx.prototype.getParameter;
  if (origGetParameter) {
    Ctx.prototype.getParameter = makeNativeMethod('getParameter', function(pname) {
      // Receiver brand check: real WebGL C++ requires this instanceof Ctx
      if (!(this instanceof Ctx)) {
        throw new TypeError(`Failed to execute 'getParameter' on '${Ctx.name}': Illegal invocation`);
      }

      switch (pname) {
        case GL.UNMASKED_VENDOR_WEBGL:   return vendor;
        case GL.UNMASKED_RENDERER_WEBGL: return renderer;
        case GL.VENDOR:   return 'WebKit';
        case GL.RENDERER: return 'WebKit WebGL';
        case GL.VERSION:
          return webglFp.version || 'WebGL 2.0 (OpenGL ES 3.0 Chromium)';
        case GL.SHADING_LANGUAGE_VERSION:
          return webglFp.glslVersion || 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)';
        default:
          return origGetParameter.call(this, pname);
      }
    });
  }

  const origGetExtension = Ctx.prototype.getExtension;
  if (origGetExtension) {
    Ctx.prototype.getExtension = makeNativeMethod('getExtension', function(name) {
      if (!(this instanceof Ctx)) {
        throw new TypeError(`Failed to execute 'getExtension' on '${Ctx.name}': Illegal invocation`);
      }
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_VENDOR_WEBGL:   GL.UNMASKED_VENDOR_WEBGL,
          UNMASKED_RENDERER_WEBGL: GL.UNMASKED_RENDERER_WEBGL,
        };
      }
      return origGetExtension.call(this, name);
    });
  }

  const origGetSupportedExtensions = Ctx.prototype.getSupportedExtensions;
  if (origGetSupportedExtensions) {
    Ctx.prototype.getSupportedExtensions = makeNativeMethod('getSupportedExtensions', function() {
      if (!(this instanceof Ctx)) {
        throw new TypeError(`Failed to execute 'getSupportedExtensions' on '${Ctx.name}': Illegal invocation`);
      }
      const real = origGetSupportedExtensions.call(this) || [];
      if (!real.includes('WEBGL_debug_renderer_info')) {
        return [...real, 'WEBGL_debug_renderer_info'];
      }
      return real;
    });
  }

  const origGetShaderPrecisionFormat = Ctx.prototype.getShaderPrecisionFormat;
  if (origGetShaderPrecisionFormat) {
    Ctx.prototype.getShaderPrecisionFormat = makeNativeMethod('getShaderPrecisionFormat', function(shaderType, precisionType) {
      if (!(this instanceof Ctx)) {
        throw new TypeError(`Failed to execute 'getShaderPrecisionFormat' on '${Ctx.name}': Illegal invocation`);
      }
      return origGetShaderPrecisionFormat.call(this, shaderType, precisionType);
    });
  }
}

// Patch WebGL and WebGL2
if (typeof WebGLRenderingContext !== 'undefined') patchWebGLClass(WebGLRenderingContext);
if (typeof WebGL2RenderingContext !== 'undefined') patchWebGLClass(WebGL2RenderingContext);

// ── WebGPU: Coherence with WebGL Vendor ───────────────────────────────────
// Detectors (like Clearcote) check: WebGPU vendor must match WebGL vendor
try {
  if (typeof GPUAdapter !== 'undefined' && GPUAdapter.prototype) {
    const targetVendor = vendor.toLowerCase().includes('nvidia') ? 'nvidia' : (vendor.toLowerCase().includes('amd') ? 'amd' : 'intel');
    const targetArch   = vendor.toLowerCase().includes('nvidia') ? 'ampere' : 'gen-12';

    // requestAdapterInfo (classic WebGPU spec)
    if (GPUAdapter.prototype.requestAdapterInfo) {
      const origReqInfo = GPUAdapter.prototype.requestAdapterInfo;
      GPUAdapter.prototype.requestAdapterInfo = makeNativeMethod('requestAdapterInfo', async function(...args) {
        if (!(this instanceof GPUAdapter)) {
          throw new TypeError("Failed to execute 'requestAdapterInfo' on 'GPUAdapter': Illegal invocation");
        }
        const info = await origReqInfo.apply(this, args);
        return {
          vendor: targetVendor,
          architecture: targetArch,
          device: 'Direct3D11',
          description: renderer,
          __proto__: Object.getPrototypeOf(info || {}),
        };
      });
    }

    // info getter (modern WebGPU spec)
    const infoDesc = Object.getOwnPropertyDescriptor(GPUAdapter.prototype, 'info');
    if (infoDesc && infoDesc.get) {
      const origInfoGetter = infoDesc.get;
      const nativeInfoGetter = function() {
        if (!(this instanceof GPUAdapter)) {
          throw new TypeError("Failed to execute 'get info' on 'GPUAdapter': Illegal invocation");
        }
        const real = origInfoGetter.call(this);
        return new Proxy(real || {}, {
          get(target, prop) {
            if (prop === 'vendor') return targetVendor;
            if (prop === 'architecture') return targetArch;
            if (prop === 'description') return renderer;
            return target[prop];
          }
        });
      };
      Object.defineProperty(nativeInfoGetter, 'name', { value: 'get info', configurable: true });
      Object.defineProperty(nativeInfoGetter, 'toString', {
        value: () => 'function get info() { [native code] }',
        configurable: true,
      });
      Object.defineProperty(GPUAdapter.prototype, 'info', {
        get: nativeInfoGetter,
        configurable: true,
        enumerable: true,
      });
    }
  }
} catch (e) {}
