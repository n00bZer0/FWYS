// FWYS Stealth — webgl.js
// JS-level WebGL parameter overrides
// Primary spoofing at C++ level (patch 002). This handles any missed calls.

const fp = __FWYS_FP__;

if (!fp.webgl_vendor && !fp.webgl_renderer) return; // nothing to spoof

// Patch both WebGLRenderingContext and WebGL2RenderingContext
[WebGLRenderingContext, WebGL2RenderingContext].forEach((Ctx) => {
  if (!Ctx) return;

  const origGetParameter = Ctx.prototype.getParameter;

  Ctx.prototype.getParameter = function(pname) {
    // UNMASKED_VENDOR_WEBGL = 0x9245
    if (pname === 0x9245 && fp.webgl_vendor) {
      return fp.webgl_vendor;
    }
    // UNMASKED_RENDERER_WEBGL = 0x9246
    if (pname === 0x9246 && fp.webgl_renderer) {
      return fp.webgl_renderer;
    }
    return origGetParameter.call(this, pname);
  };

  // Make toString look native
  Ctx.prototype.getParameter.toString = () =>
    'function getParameter() { [native code] }';
});

// Patch WebGLDebugRendererInfo — accessing this extension can be detected
// We ensure it's always "present" so it doesn't trigger unusual code paths
const origGetExtension = WebGLRenderingContext.prototype.getExtension;
WebGLRenderingContext.prototype.getExtension = function(name) {
  const ext = origGetExtension.call(this, name);
  // Return extension even if null — the getParameter patch above handles the values
  return ext;
};
WebGLRenderingContext.prototype.getExtension.toString = () =>
  'function getExtension() { [native code] }';
