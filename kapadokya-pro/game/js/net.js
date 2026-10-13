// Koprü (bridge) ile WebSocket baglantisi; otomatik yeniden baglanir. Sahte olay URETMEZ.
export class Net {
  constructor(onMsg, onStatus) { this.onMsg = onMsg; this.onStatus = onStatus; this.ws = null; this.open = false; this.connect(); }
  url() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + (location.host || '127.0.0.1:8787'); }
  connect() {
    let ws; try { ws = new WebSocket(this.url()); } catch (e) { setTimeout(() => this.connect(), 2000); return; }
    this.ws = ws;
    ws.onopen = () => { this.open = true; this.onStatus(true); };
    ws.onmessage = (e) => { try { this.onMsg(JSON.parse(e.data)); } catch (err) { /* bozuk mesaj */ } };
    ws.onclose = () => { this.open = false; this.onStatus(false); setTimeout(() => this.connect(), 2000); };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* */ } };
  }
  send(o) { if (this.open) this.ws.send(JSON.stringify(o)); }
}
