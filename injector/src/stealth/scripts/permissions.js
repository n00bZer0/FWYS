// FWYS Stealth — permissions.js
// Spoofs Permissions API to look like a real browser (not automation)

const origQuery = Permissions.prototype.query;
Permissions.prototype.query = function(parameters) {
  // Always return 'granted' for camera/microphone/notifications
  // to look like a normal browser that has been interacted with
  const granted = ['notifications', 'push', 'midi', 'camera', 'microphone',
                   'background-sync', 'ambient-light-sensor', 'accelerometer',
                   'gyroscope', 'magnetometer', 'clipboard-read', 'clipboard-write'];
  const denied  = []; // nothing denied by default

  if (granted.includes(parameters.name)) {
    return Promise.resolve({ state: 'granted', onchange: null });
  }
  if (denied.includes(parameters.name)) {
    return Promise.resolve({ state: 'denied', onchange: null });
  }
  return origQuery.call(this, parameters);
};

Permissions.prototype.query.toString = () =>
  'function query() { [native code] }';
