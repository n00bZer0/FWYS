'use strict';

/**
 * ProxyTunnel.js — Local Authenticated Proxy Forwarder
 *
 * Chromium command-line does not support inline proxy credentials (--proxy-server=http://user:pass@host:port).
 * ProxyTunnel solves this by running a local loopback proxy on 127.0.0.1:PORT:
 *   Chromium connects without auth -> ProxyTunnel authenticates upstream -> Forwarded to target.
 *
 * Dual-Protocol Support:
 *   Handles both SOCKS5 and HTTP CONNECT on the local port,
 *   forwarding to upstream SOCKS5 or HTTP/HTTPS proxies.
 */

const net = require('net');
const tls = require('tls');

class ProxyTunnel {
  static activeTunnels = new Map(); // profileId -> { server, connections, port }

  /**
   * Create and start a local proxy tunnel for a profile.
   *
   * @param {Object} config
   * @param {string} config.profileId
   * @param {number} config.localPort
   * @param {string} config.proxyType - 'socks5' | 'socks4' | 'http' | 'https'
   * @param {string} config.proxyHost
   * @param {number} config.proxyPort
   * @param {string} [config.proxyUser]
   * @param {string} [config.proxyPass]
   * @returns {Promise<number>} Bound local port
   */
  static createTunnel(config) {
    const { profileId, localPort, proxyType, proxyHost, proxyPort, proxyUser, proxyPass } = config;

    // Close any previous tunnel for this profile
    this.closeTunnel(profileId);

    return new Promise((resolve, reject) => {
      const connections = new Set();

      const server = net.createServer((clientSocket) => {
        connections.add(clientSocket);
        clientSocket.on('close', () => connections.delete(clientSocket));
        clientSocket.on('error', (err) => {
          console.warn(`  [Tunnel:${profileId}] Client socket error:`, err.message);
          connections.delete(clientSocket);
        });

        // Peek first chunk to determine protocol (SOCKS5 vs HTTP CONNECT)
        clientSocket.once('data', (firstChunk) => {
          if (firstChunk.length === 0) return;

          if (firstChunk[0] === 0x05) {
            // SOCKS5 client handshake
            this.handleSocks5Client(clientSocket, firstChunk, config);
          } else {
            // HTTP CONNECT or plain HTTP proxy request
            this.handleHttpClient(clientSocket, firstChunk, config);
          }
        });
      });

      server.on('error', (err) => {
        console.error(`  [Tunnel:${profileId}] Server error:`, err.message);
        reject(err);
      });

      server.listen(localPort, '127.0.0.1', () => {
        console.log(`  [Tunnel:${profileId}] Listening on 127.0.0.1:${localPort} -> ${proxyType}://${proxyHost}:${proxyPort}`);
        this.activeTunnels.set(profileId, { server, connections, port: localPort });
        resolve(localPort);
      });
    });
  }

  /**
   * Close tunnel for a profile.
   */
  static closeTunnel(profileId) {
    const tunnel = this.activeTunnels.get(profileId);
    if (!tunnel) return;

    for (const socket of tunnel.connections) {
      try { socket.destroy(); } catch {}
    }
    tunnel.connections.clear();

    try {
      tunnel.server.close();
      console.log(`  [Tunnel:${profileId}] Closed tunnel on port ${tunnel.port}`);
    } catch {}

    this.activeTunnels.delete(profileId);
  }

  /**
   * Close all active tunnels.
   */
  static closeAll() {
    for (const profileId of this.activeTunnels.keys()) {
      this.closeTunnel(profileId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SOCKS5 Client Handler
  // ──────────────────────────────────────────────────────────────────────────

  static handleSocks5Client(clientSocket, greetingChunk, config) {
    // 1. Respond to greeting: accept NO AUTH (0x00)
    clientSocket.write(Buffer.from([0x05, 0x00]));

    // 2. Wait for CONNECT request
    clientSocket.once('data', (reqChunk) => {
      if (reqChunk.length < 7 || reqChunk[0] !== 0x05 || reqChunk[1] !== 0x01) {
        // Not a valid CONNECT
        clientSocket.write(Buffer.from([0x05, 0x07])); // Command not supported
        clientSocket.end();
        return;
      }

      const atyp = reqChunk[3];
      let targetHost = '';
      let targetPort = 0;
      let offset = 4;

      if (atyp === 0x01) {
        // IPv4
        targetHost = `${reqChunk[offset]}.${reqChunk[offset + 1]}.${reqChunk[offset + 2]}.${reqChunk[offset + 3]}`;
        offset += 4;
      } else if (atyp === 0x03) {
        // Domain name
        const len = reqChunk[offset++];
        targetHost = reqChunk.slice(offset, offset + len).toString('ascii');
        offset += len;
      } else if (atyp === 0x04) {
        // IPv6 (simple colon formatting)
        const parts = [];
        for (let i = 0; i < 16; i += 2) {
          parts.push(reqChunk.readUInt16BE(offset + i).toString(16));
        }
        targetHost = parts.join(':');
        offset += 16;
      } else {
        clientSocket.write(Buffer.from([0x05, 0x08])); // Address type not supported
        clientSocket.end();
        return;
      }

      targetPort = reqChunk.readUInt16BE(offset);

      // Connect upstream to real proxy
      this.connectUpstream(targetHost, targetPort, config)
        .then((upstreamSocket) => {
          // Send SOCKS5 success to client: [0x05, 0x00, 0x00, 0x01, 0,0,0,0, 0,0]
          const resp = Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
          clientSocket.write(resp);

          clientSocket.pipe(upstreamSocket);
          upstreamSocket.pipe(clientSocket);
        })
        .catch((err) => {
          console.warn(`  [Tunnel:${config.profileId}] Upstream connect failed to ${targetHost}:${targetPort}:`, err.message);
          clientSocket.write(Buffer.from([0x05, 0x05])); // Connection refused
          clientSocket.end();
        });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP / HTTP CONNECT Client Handler
  // ──────────────────────────────────────────────────────────────────────────

  static handleHttpClient(clientSocket, firstChunk, config) {
    const text = firstChunk.toString('latin1');
    const firstLine = text.split('\r\n')[0] || '';

    if (firstLine.startsWith('CONNECT ')) {
      // CONNECT host:port HTTP/1.1
      const parts = firstLine.split(' ');
      const [targetHost, portStr] = parts[1].split(':');
      const targetPort = parseInt(portStr, 10) || 443;

      this.connectUpstream(targetHost, targetPort, config)
        .then((upstreamSocket) => {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          clientSocket.pipe(upstreamSocket);
          upstreamSocket.pipe(clientSocket);
        })
        .catch((err) => {
          console.warn(`  [Tunnel:${config.profileId}] HTTP CONNECT failed:`, err.message);
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.end();
        });
    } else {
      // Plain HTTP forward
      const match = text.match(/Host:\s*([^\r\n:]+)(?::(\d+))?/i);
      const targetHost = match ? match[1] : config.proxyHost;
      const targetPort = match && match[2] ? parseInt(match[2], 10) : 80;

      this.connectUpstream(targetHost, targetPort, config)
        .then((upstreamSocket) => {
          upstreamSocket.write(firstChunk);
          clientSocket.pipe(upstreamSocket);
          upstreamSocket.pipe(clientSocket);
        })
        .catch((err) => {
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.end();
        });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Connect to Upstream Proxy (with Authentication)
  // ──────────────────────────────────────────────────────────────────────────

  static connectUpstream(targetHost, targetPort, config) {
    const { proxyType, proxyHost, proxyPort, proxyUser, proxyPass } = config;
    const type = (proxyType || 'socks5').toLowerCase();

    if (type === 'socks5' || type === 'socks4') {
      return this.connectUpstreamSocks5(targetHost, targetPort, proxyHost, proxyPort, proxyUser, proxyPass);
    } else {
      return this.connectUpstreamHttp(targetHost, targetPort, proxyHost, proxyPort, proxyUser, proxyPass, type === 'https');
    }
  }

  /**
   * Connect to an upstream SOCKS5 proxy with username/password auth.
   */
  static connectUpstreamSocks5(targetHost, targetPort, proxyHost, proxyPort, user, pass) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(proxyPort, proxyHost, () => {
        // 1. Send greeting methods: 0x00 (No auth) and 0x02 (Username/Password)
        if (user) {
          socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
        } else {
          socket.write(Buffer.from([0x05, 0x01, 0x00]));
        }
      });

      socket.setTimeout(12000, () => {
        socket.destroy();
        reject(new Error('Upstream SOCKS5 timeout'));
      });

      socket.once('data', (greetingResp) => {
        if (greetingResp.length < 2 || greetingResp[0] !== 0x05) {
          socket.destroy();
          return reject(new Error('Invalid SOCKS5 greeting response'));
        }

        const authMethod = greetingResp[1];

        if (authMethod === 0x02 && user) {
          // Username/Password subnegotiation: RFC 1929
          const uBuf = Buffer.from(user, 'utf8');
          const pBuf = Buffer.from(pass || '', 'utf8');
          const authMsg = Buffer.concat([
            Buffer.from([0x01, uBuf.length]),
            uBuf,
            Buffer.from([pBuf.length]),
            pBuf
          ]);

          socket.write(authMsg);

          socket.once('data', (authResp) => {
            if (authResp.length < 2 || authResp[1] !== 0x00) {
              socket.destroy();
              return reject(new Error('SOCKS5 authentication failed'));
            }
            // Auth success -> send CONNECT
            ProxyTunnel.sendSocks5Connect(socket, targetHost, targetPort, resolve, reject);
          });
        } else if (authMethod === 0x00) {
          // No auth required
          ProxyTunnel.sendSocks5Connect(socket, targetHost, targetPort, resolve, reject);
        } else {
          socket.destroy();
          reject(new Error(`Unsupported SOCKS5 auth method: 0x${authMethod.toString(16)}`));
        }
      });

      socket.on('error', reject);
    });
  }

  static sendSocks5Connect(socket, targetHost, targetPort, resolve, reject) {
    const isIp = net.isIP(targetHost);
    let req;

    if (isIp === 4) {
      const parts = targetHost.split('.').map(Number);
      req = Buffer.from([0x05, 0x01, 0x00, 0x01, ...parts, (targetPort >> 8) & 0xff, targetPort & 0xff]);
    } else if (isIp === 6) {
      // IPv6 not common for targets, fallback to domain or reject
      const buf = Buffer.alloc(22);
      buf[0] = 0x05; buf[1] = 0x01; buf[2] = 0x00; buf[3] = 0x04;
      // write port
      buf.writeUInt16BE(targetPort, 20);
      req = buf;
    } else {
      // Domain name
      const hostBuf = Buffer.from(targetHost, 'utf8');
      req = Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
        hostBuf,
        Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff])
      ]);
    }

    socket.write(req);

    socket.once('data', (resp) => {
      if (resp.length >= 2 && resp[1] === 0x00) {
        socket.setTimeout(0); // clear connect timeout
        resolve(socket);
      } else {
        socket.destroy();
        reject(new Error(`SOCKS5 connect rejected with status: ${resp[1]}`));
      }
    });
  }

  /**
   * Connect to an upstream HTTP/HTTPS proxy with Proxy-Authorization.
   */
  static connectUpstreamHttp(targetHost, targetPort, proxyHost, proxyPort, user, pass, isTls = false) {
    return new Promise((resolve, reject) => {
      const connectFn = isTls ? tls.connect : net.connect;
      const socket = connectFn({ host: proxyHost, port: proxyPort }, () => {
        let req = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
                  `Host: ${targetHost}:${targetPort}\r\n` +
                  `Proxy-Connection: Keep-Alive\r\n`;

        if (user) {
          const auth = Buffer.from(`${user}:${pass || ''}`).toString('base64');
          req += `Proxy-Authorization: Basic ${auth}\r\n`;
        }

        req += '\r\n';
        socket.write(req);
      });

      socket.setTimeout(12000, () => {
        socket.destroy();
        reject(new Error('Upstream HTTP proxy timeout'));
      });

      socket.once('data', (data) => {
        const text = data.toString('latin1');
        if (text.includes(' 200 ') || text.startsWith('HTTP/1.1 200') || text.startsWith('HTTP/1.0 200')) {
          socket.setTimeout(0);
          resolve(socket);
        } else {
          socket.destroy();
          const firstLine = text.split('\r\n')[0];
          reject(new Error(`HTTP proxy returned: ${firstLine}`));
        }
      });

      socket.on('error', reject);
    });
  }
}

module.exports = ProxyTunnel;
