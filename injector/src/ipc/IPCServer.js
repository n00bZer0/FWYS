/**
 * FWYS — IPCServer
 * Named pipe server for communication between Qt UI and Node.js injection layer.
 * Qt UI sends JSON commands, Node.js responds with JSON results.
 *
 * Protocol:
 *   Request:  { "event": "launch_profile", "payload": { ... } }
 *   Response: { "event": "launch_result",  "payload": { ... } }
 */

'use strict';

const net = require('net');
const { EventEmitter } = require('events');
const os = require('os');

// Windows named pipe
const PIPE_NAME = os.platform() === 'win32'
  ? '\\\\.\\pipe\\fwys_ipc'
  : '/tmp/fwys_ipc.sock';

class IPCServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.clients = new Set();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        console.log(`  [IPC] Client connected`);
        this.clients.add(socket);

        let buffer = '';

        socket.on('data', (data) => {
          buffer += data.toString();
          // Messages are newline-delimited JSON
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              console.log(`  [IPC] <- ${msg.event}`, msg.payload ? JSON.stringify(msg.payload).slice(0, 80) : '');
              this.emit(msg.event, msg.payload || {});
            } catch (e) {
              console.error(`  [IPC] Parse error:`, e.message);
            }
          }
        });

        socket.on('close', () => {
          this.clients.delete(socket);
          console.log(`  [IPC] Client disconnected`);
        });

        socket.on('error', (e) => {
          console.error(`  [IPC] Socket error:`, e.message);
          this.clients.delete(socket);
        });
      });

      this.server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          // Pipe exists — try to unlink and retry (Unix only)
          if (os.platform() !== 'win32') {
            const fs = require('fs');
            try { fs.unlinkSync(PIPE_NAME); } catch {}
            this.server.listen(PIPE_NAME, resolve);
            return;
          }
        }
        reject(e);
      });

      this.server.listen(PIPE_NAME, () => {
        console.log(`  [IPC] Server listening on: ${PIPE_NAME}`);
        resolve();
      });
    });
  }

  /**
   * Send an event to all connected Qt clients.
   */
  send(event, payload = {}) {
    const msg = JSON.stringify({ event, payload }) + '\n';
    for (const client of this.clients) {
      try {
        client.write(msg);
      } catch (e) {
        this.clients.delete(client);
      }
    }
    console.log(`  [IPC] -> ${event}`, JSON.stringify(payload).slice(0, 80));
  }

  stop() {
    for (const client of this.clients) client.destroy();
    this.clients.clear();
    if (this.server) this.server.close();
  }

  static selfTest() {
    const srv = new IPCServer();
    if (typeof srv.start !== 'function') throw new Error('start not a function');
    if (typeof srv.send !== 'function') throw new Error('send not a function');
  }
}

module.exports = IPCServer;
