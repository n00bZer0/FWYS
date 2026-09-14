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

// Create fake PluginArray
function makeFakePluginArray(plugins) {
  const arr = [];
  plugins.forEach((p, i) => {
    const plugin = {
      name: p.name,
      description: p.description,
      filename: p.filename,
      length: p.mimeTypes.length,
    };
    p.mimeTypes.forEach((mt, j) => {
      plugin[j] = mt;
    });
    arr.push(plugin);
    arr[p.name] = plugin;
  });
  arr.length = plugins.length;
  arr.item = (i) => arr[i];
  arr.namedItem = (name) => arr[name];
  arr.refresh = () => {};
  return arr;
}

try {
  Object.defineProperty(navigator, 'plugins', {
    get: () => makeFakePluginArray(fakePlugins),
    configurable: true,
  });

  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => {
      const mimes = {};
      fakePlugins.forEach(p => p.mimeTypes.forEach(mt => { mimes[mt.type] = mt; }));
      return mimes;
    },
    configurable: true,
  });
} catch (e) { /* already defined */ }
