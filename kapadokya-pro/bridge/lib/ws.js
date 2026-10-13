'use strict';
// Bagimlilik gerektirmeyen minimal WebSocket sunucusu (RFC 6455, metin cercevesi).
const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(str) {
  const p = Buffer.from(str, 'utf8'); const len = p.length; let h;
  if (len < 126) h = Buffer.from([0x81, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([h, p]);
}

function attach(server, { onConnect, onMessage } = {}) {
  const clients = new Set();
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    const origin = req.headers.origin;
    const okOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !okOrigin) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    socket.setNoDelay(true);
    const client = { socket, send(str) { if (socket.writable) socket.write(frame(str)); } };
    clients.add(client);
    let buf = Buffer.alloc(0);
    socket.on('error', () => {});
    socket.on('close', () => clients.delete(client));
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const op = buf[0] & 0x0f; let len = buf[1] & 0x7f; let off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (len > 1 << 20) { socket.destroy(); return; }
        const masked = (buf[1] & 0x80) !== 0; if (masked) off += 4;
        if (buf.length < off + len) return;
        let payload = Buffer.from(buf.subarray(off, off + len));
        if (masked) { const m = buf.subarray(off - 4, off); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i % 4]; }
        buf = buf.subarray(off + len);
        if (op === 8) { socket.end(); return; }
        if (op === 9) socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
        else if (op === 1 && onMessage) { try { onMessage(payload.toString('utf8'), client); } catch (e) { /* bozuk mesaj */ } }
      }
    });
    if (onConnect) onConnect(client);
  });
  return {
    broadcast(str) { for (const c of clients) c.send(str); },
    count() { return clients.size; },
  };
}
module.exports = { attach, frame };
