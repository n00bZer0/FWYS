// FWYS Stealth — webrtc.js
// WebRTC leak protection & Proxy IP spoofing
// Mode: 'allow' | 'filter_local' | 'block'

const fp = __FWYS_FP__;
const webrtcMode = fp.webrtc_mode || fp.webrtc?.mode || 'filter_local';
const proxyPublicIp = fp.publicIp || fp.webrtc?.publicIp || fp.meta?.ipSource || (fp.geo && fp.geo.ip) || '';

if (webrtcMode === 'allow') return;

if (webrtcMode === 'block') {
  const fakeRTC = function() {
    throw new DOMException('WebRTC is disabled by profile settings.', 'NotAllowedError');
  };
  fakeRTC.prototype = window.RTCPeerConnection?.prototype || {};
  Object.defineProperty(fakeRTC, 'toString', {
    value: () => 'function RTCPeerConnection() { [native code] }',
    configurable: true,
  });
  window.RTCPeerConnection = fakeRTC;
  return;
}

// IPv4 private / loopback / link-local
const PRIVATE_RE = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
];

const isPrivateIP = (ip) => {
  if (!ip) return false;
  if (ip === '::1') return true;
  if (/^fe80::/i.test(ip)) return true;
  return PRIVATE_RE.some(re => re.test(ip));
};

const extractIP = (candidate) => {
  if (!candidate) return null;
  const parts = candidate.split(' ');
  return parts[4] || null;
};

const isMdns = (ip) => ip && ip.endsWith('.local');

const origRTC = window.RTCPeerConnection;
if (!origRTC) return;

function PatchedRTCPeerConnection(config, constraints) {
  const pc = new origRTC(config || {}, constraints);
  let hasEmittedPublic = false;
  let customOnIceCandidate = null;
  const iceListeners = new Set();

  const sanitizeCandidate = (origCand) => {
    if (!origCand || !origCand.candidate) return origCand;
    let candStr = origCand.candidate;
    const ip = extractIP(candStr);

    if (isMdns(ip)) {
      // mDNS candidates (.local) hide local IP but still reveal local network presence.
      // If we have a proxy public IP, suppress the mDNS candidate entirely — we'll
      // emit the proxy IP candidate instead via the fallback synthesizer.
      // If no proxy IP, suppress too (fail-safe — better silent than leaking).
      return null;
    }

    if (isPrivateIP(ip)) {
      if (proxyPublicIp) {
        // Replace private IP with proxy public IP so it doesn't leak and shows exit IP
        candStr = candStr.replace(ip, proxyPublicIp);
        hasEmittedPublic = true;
        try {
          return new RTCIceCandidate({
            candidate: candStr,
            sdpMid: origCand.sdpMid,
            sdpMLineIndex: origCand.sdpMLineIndex,
            usernameFragment: origCand.usernameFragment,
          });
        } catch (e) {
          return origCand;
        }
      }
      // No proxy IP — drop private candidate (fail-safe)
      return null;
    }

    // Public IP candidate (e.g. real ISP IP from STUN server)
    if (proxyPublicIp && ip && ip !== proxyPublicIp) {
      // Replace non-matching public IP with proxy exit IP
      candStr = candStr.replace(ip, proxyPublicIp);
      hasEmittedPublic = true;
      try {
        return new RTCIceCandidate({
          candidate: candStr,
          sdpMid: origCand.sdpMid,
          sdpMLineIndex: origCand.sdpMLineIndex,
          usernameFragment: origCand.usernameFragment,
        });
      } catch (e) {
        return origCand;
      }
    }

    if (!proxyPublicIp && ip) {
      // Fail-safe: proxy IP unknown — block ALL IP-exposing candidates
      // to avoid any leak. The synthesizer will emit a null-candidate to
      // signal gathering is complete without revealing real IPs.
      return null;
    }

    if (ip === proxyPublicIp) {
      hasEmittedPublic = true;
    }
    return origCand;
  };

  const dispatchToHandlers = (event) => {
    if (typeof customOnIceCandidate === 'function') {
      try { customOnIceCandidate.call(pc, event); } catch (e) {}
    }
    for (const listener of iceListeners) {
      try { listener.call(pc, event); } catch (e) {}
    }
  };

  // Intercept native icecandidate event
  origRTC.prototype.addEventListener.call(pc, 'icecandidate', (e) => {
    e.stopImmediatePropagation();

    if (!e.candidate) {
      // Candidate gathering finished
      if (proxyPublicIp && !hasEmittedPublic) {
        hasEmittedPublic = true;
        // Synthesize proxy public IP candidate for browserleaks / iphey
        const fakeCandidateStr = `candidate:1 1 UDP 2122260223 ${proxyPublicIp} 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0`;
        let fakeCand = null;
        try {
          fakeCand = new RTCIceCandidate({
            candidate: fakeCandidateStr,
            sdpMid: '0',
            sdpMLineIndex: 0,
          });
        } catch (err) {
          fakeCand = { candidate: fakeCandidateStr, sdpMid: '0', sdpMLineIndex: 0 };
        }
        dispatchToHandlers(new RTCPeerConnectionIceEvent('icecandidate', { candidate: fakeCand }));
      }
      dispatchToHandlers(new RTCPeerConnectionIceEvent('icecandidate', { candidate: null }));
      return;
    }

    const cleanCandidate = sanitizeCandidate(e.candidate);
    if (cleanCandidate) {
      dispatchToHandlers(new RTCPeerConnectionIceEvent('icecandidate', { candidate: cleanCandidate }));
    }
  }, true);

  // Property setter/getter for pc.onicecandidate
  Object.defineProperty(pc, 'onicecandidate', {
    get: () => customOnIceCandidate,
    set: (fn) => {
      customOnIceCandidate = fn;
    },
    enumerable: true,
    configurable: true,
  });

  // addEventListener for 'icecandidate'
  const origAddEventListener = pc.addEventListener;
  pc.addEventListener = function(type, listener, options) {
    if (type === 'icecandidate') {
      if (typeof listener === 'function') iceListeners.add(listener);
      return;
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  const origRemoveEventListener = pc.removeEventListener;
  pc.removeEventListener = function(type, listener, options) {
    if (type === 'icecandidate') {
      iceListeners.delete(listener);
      return;
    }
    return origRemoveEventListener.call(this, type, listener, options);
  };

  // Fallback timer when setLocalDescription is called, in case proxy doesn't route UDP at all
  const origSetLocalDescription = pc.setLocalDescription;
  pc.setLocalDescription = function(desc) {
    if (proxyPublicIp) {
      setTimeout(() => {
        if (!hasEmittedPublic) {
          hasEmittedPublic = true;
          const fakeCandidateStr = `candidate:1 1 UDP 2122260223 ${proxyPublicIp} 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0`;
          let fakeCand = null;
          try {
            fakeCand = new RTCIceCandidate({
              candidate: fakeCandidateStr,
              sdpMid: '0',
              sdpMLineIndex: 0,
            });
          } catch (err) {
            fakeCand = { candidate: fakeCandidateStr, sdpMid: '0', sdpMLineIndex: 0 };
          }
          dispatchToHandlers(new RTCPeerConnectionIceEvent('icecandidate', { candidate: fakeCand }));
        }
      }, 150);
    }
    return origSetLocalDescription.apply(this, arguments);
  };

  return pc;
}

Object.setPrototypeOf(PatchedRTCPeerConnection, origRTC);
PatchedRTCPeerConnection.prototype = origRTC.prototype;
Object.defineProperty(PatchedRTCPeerConnection.prototype, 'constructor', {
  value: PatchedRTCPeerConnection,
  writable: true,
  configurable: true,
});

window.RTCPeerConnection = PatchedRTCPeerConnection;
Object.defineProperty(PatchedRTCPeerConnection, 'toString', {
  value: () => 'function RTCPeerConnection() { [native code] }',
  configurable: true,
});
