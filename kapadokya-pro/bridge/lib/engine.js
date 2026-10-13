'use strict';
// Olay motoru: TikTok'tan gelen HAM olaylari oyun olaylarina cevirir.
// Kurallar (Revizyon Eki v1.1):
//  - Sahneye yalnizca HEDIYE gonderenler ve YORUM yazanlar girer. Like/share/follow/member dinlenmez.
//  - Streak yapilabilen hediyede SON repeatCount kullanilir (toplanmaz); repeatEnd beklenir.
//  - Streak yapilamayan hediye hemen islenir (eskiden atiliyordu).
//  - Hiz siniri yalnizca yorumlara uygulanir; hediye ASLA dusurulmez.
const fs = require('fs');
const path = require('path');

const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't' };

function tokens(text) {
  return String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ı/g, 'i').replace(/[@4310!$57]/g, (c) => LEET[c]).split(/[^a-z]+/).filter(Boolean)
    // "f_u_c_k" gibi harf harf ayirma numarasi: ardisik tek harfli parcalar birlestirilir
    .reduce((acc, t) => { if (t.length === 1 && acc.length && acc[acc.length - 1].single) { acc[acc.length - 1].v += t; } else acc.push({ v: t, single: t.length === 1 }); return acc; }, []).map((x) => x.v);
}

function createEngine({ config, wordlist, dataDir, broadcast, log, now = () => Date.now() }) {
  const usersFile = path.join(dataDir, 'users.json');
  let users = {};
  try { users = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch (e) { users = {}; }
  const live = new Map(); // gecici (kalici olmayan) kullanici durumu
  let dirty = false;
  const words = (wordlist || []).map((w) => String(w).toLowerCase());
  const stats = { gifts: 0, joins: 0, blocked: 0, points: 0 };
  const recent = [];

  function isBanned(text) {
    const tk = tokens(text); const collapsed = tk.join('');
    for (const w of words) {
      if (w.length <= 2) { if (tk.includes(w)) return true; }
      else if (w.length <= 4) { if (tk.some((t) => t.startsWith(w))) return true; }
      else if (collapsed.includes(w)) return true;
    }
    return /https?:\/\/|www\.|\.(com|net|org|ru)\b/i.test(String(text || ''));
  }
  function cleanNick(n, fallback) {
    let s = String(n || fallback || 'Misafir').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!s) s = 'Misafir';
    return isBanned(s) ? 'Misafir' : s;
  }
  function getUser(id, raw) {
    let u = live.get(id);
    if (!u) { u = { id, total: (users[id] && users[id].total) || 0, lastJoin: 0, win: [] }; live.set(id, u); }
    u.nick = cleanNick(raw.nick, raw.uniqueId);
    if (raw.avatar) u.avatar = String(raw.avatar);
    return u;
  }
  const pub = (u) => ({ id: u.id, nick: u.nick, avatar: u.avatar || '' });
  function save() {
    if (!dirty) return; dirty = false;
    const out = {};
    for (const [id, u] of live) if (u.total > 0) out[id] = { nick: u.nick, total: u.total };
    for (const id of Object.keys(users)) if (!out[id] && users[id].total > 0) out[id] = users[id];
    users = out;
    fs.writeFile(usersFile, JSON.stringify(users), () => {});
  }
  const saveTimer = setInterval(save, 10000); if (saveTimer.unref) saveTimer.unref();

  // ---- yorum -> sahneye giris ----
  function onChat(raw) {
    const id = raw.uniqueId || raw.nick; if (!id) return;
    if (raw.comment && isBanned(raw.comment)) { stats.blocked++; return; }
    const u = getUser(id, raw); const t = now();
    u.win = u.win.filter((x) => t - x < 1000); if (u.win.length >= 5) { stats.blocked++; return; } u.win.push(t);
    if (t - u.lastJoin < config.join.cooldownSec * 1000) return;
    u.lastJoin = t; stats.joins++;
    send({ type: 'join', user: pub(u), total: u.total });
  }

  // ---- hediye ----
  const streaks = new Map(); // "kullanici:hediyeId" -> son ham olay (kumulatif repeatCount)
  function onGift(g) {
    const id = g.uniqueId || g.nick; if (!id) return;
    const key = id + ':' + (g.giftId || g.giftName);
    if (g.giftType === 1) { // streak yapilabilen
      streaks.set(key, Object.assign({}, g, { _t: now() }));
      if (!g.repeatEnd) return;
      const last = streaks.get(key); streaks.delete(key);
      finalize(last, last.repeatCount || 1);
    } else {
      finalize(g, g.repeatCount || 1);
    }
  }
  function finalize(g, count) {
    const id = g.uniqueId || g.nick; const per = Math.max(1, g.diamondPer || 1);
    const diamonds = per * count;
    let mult = 1; config.combo.thresholds.forEach((th, i) => { if (count >= th) mult = config.combo.multipliers[i]; });
    const points = Math.round(diamonds * mult);
    const u = getUser(id, g); const before = u.total; u.total = before + points; dirty = true;
    stats.gifts++; stats.points += points;
    send({ type: 'gift', user: pub(u), gift: { name: g.giftName || 'Hediye', id: g.giftId || 0, count, diamondPer: per }, diamonds, points, mult, total: u.total, totalBefore: before });
  }
  // repeatEnd hic gelmeyen streak'leri 8 sn sonra kapat (kayip olaya karsi sigorta)
  function sweep() {
    const t = now();
    for (const [key, g] of streaks) if (t - g._t > 8000) { streaks.delete(key); finalize(g, g.repeatCount || 1); }
  }
  const sweepTimer = setInterval(sweep, 2000); if (sweepTimer.unref) sweepTimer.unref();

  function send(obj) { recent.push(obj.type); if (recent.length > 20) recent.shift(); broadcast(obj); }
  return { onChat, onGift, isBanned, cleanNick, stats, recent, sweep, save, streaks };
}
module.exports = { createEngine };
