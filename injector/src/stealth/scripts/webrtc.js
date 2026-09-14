// FWYS Stealth — webrtc.js
// Filters WebRTC ICE candidates to prevent IP leakage

const fp = __FWYS_FP__;
const webrtcMode = fp.webrtc_mode || 'filter_local'; // 'allow', 'filter_local', 'block'

if (webrtcMode === 'allow') return;

const isPrivateIP = (ip) => {
  if (!ip) return false;
  // IPv4 private ranges
  if (/^10\.\d+\.\d+\.\d+$/.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(ip)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(ip)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(ip)) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(ip)) return true;
  // IPv6 loopback/link-local
  if (ip === '::1') return true;
  if (/^fe80::/i.test(ip)) return true;
  // mDNS
  if (ip.endsWith('.local')) return true;
  return false;
};

const extractIP = (candidate) => {
  // Format: "candidate:... IP port ..."
  const parts = candidate.split(' ');
  return parts[4] || null; // 5th field is the IP
};

// Patch RTCPeerConnection
const origRTC = window.RTCPeerConnection;
if (!origRTC) return;

function PatchedRTCPeerConnection(config, constraints) {
  const pc = new origRTC(config, constraints);

  const origAddIceCandidate = pc.addIceCandidate.bind(pc);
  const origOnIceCandidate = Object.getOwnPropertyDescriptor(
    RTCPeerConnection.prototype, 'onicecandidate'
  );

  pc.addEventListener('icecandidate', (e) => {
    if (!e.candidate) return;
    const candidateStr = e.candidate.candidate;
    const ip = extractIP(candidateStr);

    if (webrtcMode === 'block') {
      // Block ALL candidates (disables WebRTC data channels effectively)
      e.stopImmediatePropagation();
      return;
    }

    if (webrtcMode === 'filter_local' && isPrivateIP(ip)) {
      e.stopImmediatePropagation();
      return;
    }
  }, true);

  return pc;
}

// Copy prototype
PatchedRTCPeerConnection.prototype = origRTC.prototype;
Object.defineProperty(PatchedRTCPeerConnection.prototype, 'constructor', {
  value: PatchedRTCPeerConnection,
  writable: true,
  configurable: true,
});

// Replace global
window.RTCPeerConnection = PatchedRTCPeerConnection;
PatchedRTCPeerConnection.toString = () =>
  'function RTCPeerConnection() { [native code] }';
