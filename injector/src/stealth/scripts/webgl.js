// FWYS Stealth — webgl.js
// P1: Complete WebGL/WebGL2 fingerprint spoofing
// Patches: getParameter (all GL_ constants), getExtension, getSupportedExtensions
// Also patches WebGL2RenderingContext

const fp = __FWYS_FP__;
const gpu = fp.gpu || {};
const webglFp = fp.webgl || {};

const vendor   = gpu.vendor   || webglFp.vendor   || 'Google Inc. (NVIDIA)';
const renderer = gpu.renderer || webglFp.renderer || 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';

if (!vendor && !renderer) return;

// ── Make function look native ─────────────────────────────────────────────
function nativize(fn, name) {
  Object.defineProperty(fn, 'toString', {
    value: () => `function ${name}() { [native code] }`,
    configurable: true,
  });
  return fn;
}

// ── GL constants for parameter spoofing ──────────────────────────────────
const GL = {
  // Standard params to pass-through (don't override)
  VENDOR:                    0x1F00,
  RENDERER:                  0x1F01,
  VERSION:                   0x1F02,
  SHADING_LANGUAGE_VERSION:  0x8B8C,

  // WEBGL_debug_renderer_info extension params (MOST IMPORTANT)
  UNMASKED_VENDOR_WEBGL:     0x9245,
  UNMASKED_RENDERER_WEBGL:   0x9246,
};

// ── Patch a WebGL context class ───────────────────────────────────────────
function patchWebGLClass(Ctx) {
  if (!Ctx || !Ctx.prototype) return;

  // ── getParameter ──────────────────────────────────────────────────────
  const origGetParameter = Ctx.prototype.getParameter;

  Ctx.prototype.getParameter = nativize(function(pname) {
    switch (pname) {
      // Spoofed: UNMASKED (most important — used by ALL fingerprinters)
      case GL.UNMASKED_VENDOR_WEBGL:   return vendor;
      case GL.UNMASKED_RENDERER_WEBGL: return renderer;

      // Pass-through: basic version strings (already controlled by C++ patch)
      case GL.VENDOR:   return 'WebKit';
      case GL.RENDERER: return 'WebKit WebGL';
      case GL.VERSION:
        return webglFp.version || 'WebGL 2.0 (OpenGL ES 3.0 Chromium)';
      case GL.SHADING_LANGUAGE_VERSION:
        return webglFp.glslVersion || 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)';

      default:
        return origGetParameter.call(this, pname);
    }
  }, 'getParameter');

  // ── getExtension ──────────────────────────────────────────────────────
  const origGetExtension = Ctx.prototype.getExtension;

  Ctx.prototype.getExtension = nativize(function(name) {
    if (name === 'WEBGL_debug_renderer_info') {
      // Return fake extension object — getParameter above handles the values
      return {
        UNMASKED_VENDOR_WEBGL:   GL.UNMASKED_VENDOR_WEBGL,
        UNMASKED_RENDERER_WEBGL: GL.UNMASKED_RENDERER_WEBGL,
      };
    }
    return origGetExtension.call(this, name);
  }, 'getExtension');

  // ── getSupportedExtensions ────────────────────────────────────────────
  const origGetSupportedExtensions = Ctx.prototype.getSupportedExtensions;

  Ctx.prototype.getSupportedExtensions = nativize(function() {
    const real = origGetSupportedExtensions.call(this) || [];

    // Ensure debug_renderer_info is in the list (it's always there in Chrome)
    if (!real.includes('WEBGL_debug_renderer_info')) {
      return [...real, 'WEBGL_debug_renderer_info'];
    }
    return real;
  }, 'getSupportedExtensions');

  // ── getShaderPrecisionFormat ──────────────────────────────────────────
  // Different GPUs return different precision formats — fingerprinting vector
  const origGetShaderPrecisionFormat = Ctx.prototype.getShaderPrecisionFormat;
  if (origGetShaderPrecisionFormat) {
    Ctx.prototype.getShaderPrecisionFormat = nativize(function(shaderType, precisionType) {
      const result = origGetShaderPrecisionFormat.call(this, shaderType, precisionType);
      // Normalize to common values (prevent GPU-specific leaks)
      if (result) {
        // Most desktop Chrome/NVIDIA returns rangeMin=127, rangeMax=127, precision=23
        return {
          rangeMin:  127,
          rangeMax:  127,
          precision: 23,
        };
      }
      return result;
    }, 'getShaderPrecisionFormat');
  }
}

// Patch both WebGL versions
patchWebGLClass(WebGLRenderingContext);
patchWebGLClass(WebGL2RenderingContext);

// ── Also patch OffscreenCanvas WebGL context if available ─────────────────
if (typeof OffscreenCanvas !== 'undefined') {
  const offscreen = new OffscreenCanvas(1, 1);
  try {
    const ctx1 = offscreen.getContext('webgl');
    const ctx2 = offscreen.getContext('webgl2');
    if (ctx1) patchWebGLClass(ctx1.constructor);
    if (ctx2) patchWebGLClass(ctx2.constructor);
  } catch { /* OffscreenCanvas may not support WebGL in all contexts */ }
}
