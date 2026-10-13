import { clamp } from './util.js';
const $ = (id) => document.getElementById(id);
export class UI {
  toast(nick, text, color) {
    const el = document.createElement('div'); el.className = 'toast'; el.style.borderColor = color || '#fff';
    const b = document.createElement('b'); b.textContent = nick; const s = document.createElement('span'); s.textContent = text;
    el.append(b, s); const box = $('toasts'); box.prepend(el);
    while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 4500); setTimeout(() => el.remove(), 5200);
  }
  hype(v) { $('hypeFill').style.height = clamp(v, 0, 100) + '%'; $('hypeNum').textContent = Math.round(v); }
  board(list) {
    const b = $('board'); b.textContent = ''; if (!list.length) { b.style.display = 'none'; return; }
    b.style.display = 'block'; const h = document.createElement('h4'); h.textContent = 'TOP HEDİYECİLER'; b.append(h);
    list.forEach((e, i) => { const d = document.createElement('div'); const a = document.createElement('span'); a.textContent = (i + 1) + '. ' + e.nick; const c = document.createElement('span'); c.textContent = e.points; d.append(a, c); b.append(d); });
  }
  restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  banner(text, color) { const b = $('banner'); b.textContent = text; b.style.color = color || '#fff'; this.restart(b, 'show'); }
  combo(text, color) { const c = $('combo'); c.textContent = text; c.style.color = color || '#ffb300'; this.restart(c, 'show'); }
  tierup(nick, tierName, color) {
    const t = $('tierup'); t.textContent = ''; t.style.borderColor = color; t.style.color = color;
    const a = document.createElement('div'); a.textContent = nick; const s = document.createElement('small'); s.textContent = 'yeni rütbe: ' + tierName; t.append(a, s); this.restart(t, 'show');
  }
  dropCount(n) { const d = $('dropcount'); if (n == null) { d.classList.remove('show'); return; } d.textContent = n; this.restart(d, 'show'); }
  flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  status(txt) { $('status').textContent = txt || ''; }
  tts(ok) { const e = $('ttsDot'); if (e) { e.className = ok ? 'on' : 'off'; e.title = ok ? 'Chatterbox TTS bağlı' : 'TTS bekleniyor'; } }
}
