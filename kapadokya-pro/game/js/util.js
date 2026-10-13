export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export function hash(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export function tierOf(total, tiers) { let t = 0; for (let i = 0; i < tiers.length; i++) if (total >= tiers[i].min) t = i; return t; }
export const PALETTES = [['#ff2d95', '#19d3ff', '#ffb300'], ['#7c4dff', '#00e5a8', '#ff6e40'], ['#ff3d00', '#ffd600', '#00b0ff'], ['#00e676', '#e040fb', '#ffea00']];
