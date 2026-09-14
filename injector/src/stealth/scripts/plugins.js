// FWYS Stealth — plugins.js
// Spoofs navigator.plugins and navigator.mimeTypes to look like real Chrome

// Real Chrome desktop has these plugins
const fakePlugins = [
  {
    name: 'PDF Viewer',
    description: 'Portable Document Format',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: '' },
      { type: 'text/pdf', suffixes: 'pdf', description: '' },
    ],
  },
  {
    name: 'Chrome PDF Viewer',
    description: '',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: '' },
    ],
  },
  {
    name: 'Chromium PDF Viewer',
    description: '',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: '' },
    ],
  },
  {
    name: 'Microsoft Edge PDF Viewer',
    description: '',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: '' },
    ],
  },
  {
    name: 'WebKit built-in PDF',
    description: '',
    filename: 'internal-pdf-viewer',
    mimeTypes: [
      { type: 'application/pdf', suffixes: 'pdf', description: '' },
    ],
  },
];

// Create realistic PluginArray and MimeTypeArray with proper prototype chaining
function buildPluginsAndMimes() {
  const pluginProto      = (typeof Plugin !== 'undefined') ? Plugin.prototype : Object.prototype;
  const pluginArrayProto = (typeof PluginArray !== 'undefined') ? PluginArray.prototype : Object.prototype;
  const mimeProto        = (typeof MimeType !== 'undefined') ? MimeType.prototype : Object.prototype;
  const mimeArrayProto   = (typeof MimeTypeArray !== 'undefined') ? MimeTypeArray.prototype : Object.prototype;

  const plugins = Object.create(pluginArrayProto);
  const mimeTypes = Object.create(mimeArrayProto);
  const allMimes = [];

  fakePlugins.forEach((pData, pIdx) => {
    const plugin = Object.create(pluginProto);
    plugin.name = pData.name;
    plugin.filename = pData.filename;
    plugin.description = pData.description;
    plugin.length = pData.mimeTypes.length;

    pData.mimeTypes.forEach((mData, mIdx) => {
      const mime = Object.create(mimeProto);
      mime.type = mData.type;
      mime.suffixes = mData.suffixes;
      mime.description = mData.description;
      mime.enabledPlugin = plugin;

      plugin[mIdx] = mime;
      allMimes.push(mime);
      if (!mimeTypes[mData.type]) {
        mimeTypes[mData.type] = mime;
      }
    });

    plugin.item = function(index) { return this[index] || null; };
    plugin.namedItem = function(name) {
      for (let i = 0; i < this.length; i++) {
        if (this[i] && this[i].type === name) return this[i];
      }
      return null;
    };

    plugins[pIdx] = plugin;
    plugins[pData.name] = plugin;
  });

  Object.defineProperty(plugins, 'length', {
    value: fakePlugins.length,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  plugins.item = function(index) { return this[index] || null; };
  plugins.namedItem = function(name) { return this[name] || null; };
  plugins.refresh = function() {};

  allMimes.forEach((m, idx) => {
    mimeTypes[idx] = m;
  });

  Object.defineProperty(mimeTypes, 'length', {
    value: allMimes.length,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  mimeTypes.item = function(index) { return this[index] || null; };
  mimeTypes.namedItem = function(name) { return this[name] || null; };

  return { plugins, mimeTypes };
}

try {
  const { plugins, mimeTypes } = buildPluginsAndMimes();

  Object.defineProperty(navigator, 'plugins', {
    get: () => plugins,
    configurable: true,
  });

  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => mimeTypes,
    configurable: true,
  });
} catch (e) { /* already defined */ }

