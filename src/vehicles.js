'use strict';
// ============================================================
// VEHICLES — lofted, smooth-shaded bodies (VAJRA-S1, Indian road
// traffic), passenger + freight trains and level crossings
// ============================================================

// ---------- geometry helpers ----------
Geo.prototype.smooth = function (from, to, deg = 45) {
  const P = this.p, Nn = this.n, cosT = Math.cos(deg * Math.PI / 180), groups = new Map();
  const key = i => Math.round(P[i * 3] * 400) + ',' + Math.round(P[i * 3 + 1] * 400) + ',' + Math.round(P[i * 3 + 2] * 400);
  for (let i = from; i < to; i++) { const k = key(i); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(i); }
  const out = new Float32Array((to - from) * 3);
  for (let i = from; i < to; i++) {
    const g = groups.get(key(i)), a = i * 3; let sx = 0, sy = 0, sz = 0;
    for (const j of g) { const b = j * 3; if (Nn[a] * Nn[b] + Nn[a + 1] * Nn[b + 1] + Nn[a + 2] * Nn[b + 2] >= cosT) { sx += Nn[b]; sy += Nn[b + 1]; sz += Nn[b + 2]; } }
    const l = Math.hypot(sx, sy, sz) || 1, o = (i - from) * 3; out[o] = sx / l; out[o + 1] = sy / l; out[o + 2] = sz / l;
  }
  for (let i = from; i < to; i++) { const o = (i - from) * 3; Nn[i * 3] = out[o]; Nn[i * 3 + 1] = out[o + 1]; Nn[i * 3 + 2] = out[o + 2]; }
};
// rounded-rectangle cross-sections along Z (w = width, tw = top width for tumblehome, r = corner radius, dz = curvature along X)
function loftRing(s, n) {
  const hw = s.w / 2, h = s.y1 - s.y0;
  // Enhanced curvature: eliminate sharp blocky edges with smooth corner fillets
  const minR = Math.min(0.09, hw * 0.35, h * 0.35);
  const rawR = s.r == null ? 0.24 : Math.max(minR, s.r * 1.45);
  const r = Math.max(0.015, Math.min(rawR, hw * 0.94, h * 0.48)), tw = (s.tw == null ? s.w : s.tw) / s.w, cx = s.cx || 0, pts = [];
  const C = [[hw - r, s.y0 + r, -Math.PI / 2, 0], [hw - r, s.y1 - r, 0, Math.PI / 2], [-hw + r, s.y1 - r, Math.PI / 2, Math.PI], [-hw + r, s.y0 + r, Math.PI, Math.PI * 1.5]];
  for (const [ax, ay, a0, a1] of C) for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n;
    let x = ax + Math.cos(a) * r;
    const y = ay + Math.sin(a) * r;
    x *= lerp(1, tw, clamp((y - s.y0) / (h || 1), 0, 1));
    const zOff = typeof s.dz === 'function' ? s.dz(x, y) : (s.dz || 0);
    pts.push([cx + x, y, s.z + zOff]);
  }
  return pts;
}
Geo.prototype.loft = function (st, col, mat = 0, em = 0, o = {}) {
  const n = Math.max(6, o.n || 6), start = this.count, R = st.map(s => loftRing(s, n)), m = R[0].length;
  for (let k = 0; k < R.length - 1; k++) {
    const A = R[k], B = R[k + 1], ctr = [((st[k].cx || 0) + (st[k + 1].cx || 0)) / 2, (st[k].y0 + st[k].y1 + st[k + 1].y0 + st[k + 1].y1) / 4, (st[k].z + st[k + 1].z) / 2];
    for (let j = 0; j < m; j++) { const j2 = (j + 1) % m; this.quad(A[j], A[j2], B[j2], B[j], col, mat, em, ctr); }
  }
  if (o.smooth !== false) this.smooth(start, this.count, o.deg || 65);
  if (o.caps !== false) for (const [k, dir] of [[0, -1], [R.length - 1, 1]]) {
    const Rg = R[k], s = st[k];
    const czOff = typeof s.dz === 'function' ? s.dz(0, (s.y0 + s.y1) / 2) : (s.dz || 0);
    const cz = s.z + czOff + (s.capDome || 0) * dir;
    const c = [s.cx || 0, (s.y0 + s.y1) / 2, cz];
    for (let j = 0; j < m; j++) this.tri(Rg[j], Rg[(j + 1) % m], c, o.capCol || col, mat, em, [0, 0, dir]);
  }
};
// surface of revolution around the X axis (tyres, lamps); profile = [[dx, radius], ...]
Geo.prototype.latheX = function (cx, cy, cz, prof, seg, col, mat = 0, em = 0, deg = 60) {
  const start = this.count, R = prof.map(([dx, r]) => { const a = []; for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2; a.push([cx + dx, cy + Math.cos(t) * r, cz + Math.sin(t) * r]); } return a; });
  for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.quad(R[k][i], R[k][j], R[k + 1][j], R[k + 1][i], col, mat, em, [cx, cy, cz]); }
  this.smooth(start, this.count, deg);
};
// flat ring in the YZ plane (wheel arches, rim lips); a0..a1 around X from +Y
Geo.prototype.ringX = function (x, cy, cz, r0, r1, seg, col, mat = 0, em = 0, a0 = 0, a1 = Math.PI * 2, out = 1) {
  for (let i = 0; i < seg; i++) { const t0 = a0 + (a1 - a0) * i / seg, t1 = a0 + (a1 - a0) * (i + 1) / seg, P = (r, t) => [x, cy + Math.cos(t) * r, cz + Math.sin(t) * r]; this.quad(P(r0, t0), P(r1, t0), P(r1, t1), P(r0, t1), col, mat, em, [x - out, cy, cz]); }
};
const interp = (st, key, z) => { for (let i = 0; i < st.length - 1; i++) if (z <= st[i + 1].z) { const t = clamp((z - st[i].z) / (st[i + 1].z - st[i].z), 0, 1); return lerp(st[i][key], st[i + 1][key], t); } return st[st.length - 1][key]; };
// x of a loft's side surface at (z, y) — for stripes, decals and arches
function loftSideX(st, z, y) { const w = interp(st, 'w', z), tw = interp(st, 'tw', z), y0 = interp(st, 'y0', z), y1 = interp(st, 'y1', z); return w / 2 * lerp(1, tw / w, clamp((y - y0) / (y1 - y0), 0, 1)); }

// ---------- wheels ----------
function addTyre(G, x, y, z, r, w, side, o = {}) {
  const k = r / 0.36, hw = w / 2, s = side;
  G.latheX(x, y, z, [[-hw, 0.66 * r], [-hw * 1.02, 0.82 * r], [-hw * 0.95, 0.93 * r], [-hw * 0.78, 0.99 * r], [-hw * 0.5, r], [hw * 0.5, r], [hw * 0.78, 0.99 * r], [hw * 0.95, 0.93 * r], [hw * 1.02, 0.82 * r], [hw, 0.66 * r]], o.seg || 22, hex('#1b1b1d'), 12, 0, 65);
  const face = x + s * hw * 0.98, rimR = 0.66 * r;
  G.ringX(face + s * 0.004, y, z, rimR * 0.94, rimR * 1.02, o.seg || 22, o.lip || hex('#b9bec4'), o.lipMat == null ? 11 : o.lipMat, 0, 0, Math.PI * 2, -s);
  G.cylX(x + s * hw * 0.55, y, z, rimR * 0.95, hw * 0.6, o.seg || 22, o.barrel || hex('#2a2c30'), 5);
  const spokes = o.spokes == null ? 5 : o.spokes;
  if (spokes) for (let i = 0; i < spokes; i++) for (const d of (o.twin ? [-0.09, 0.09] : [0])) { const a = i / spokes * Math.PI * 2 + d; G.beam([face - s * 0.02, y, z], [face - s * 0.005, y + Math.cos(a) * rimR * 0.93, z + Math.sin(a) * rimR * 0.93], (o.twin ? 0.035 : 0.07) * k, o.spoke || hex('#c8ccd1'), o.spokeMat == null ? 11 : o.spokeMat, 0, 0.045 * k); }
  else G.ringX(face, y, z, 0.001, rimR * 0.94, o.seg || 22, o.disc || hex('#8d9196'), 5, 0, 0, Math.PI * 2, -s);
  G.cylX(face + s * 0.004, y, z, 0.2 * rimR, 0.03, 12, o.hub || hex('#9aa0a6'), 11);
}

// ---------- VAJRA-S1 ----------
let VAJRA_DECAL = { x: 1.0, y: 0.4, z: -0.35 };
// ---------- seated human NPC helper (drivers & passengers) ----------
function addSeatedHuman(G, x, y, z, colShirt, colSkin = hex('#8d5e3e'), colHair = hex('#141210'), isDriver = true, driverHandX = 0, opts = {}) {
  const headwear = opts.headwear || 'hair';
  const headwearCol = opts.headwearCol || hex('#f59e0b');
  const mustache = !!opts.mustache;
  const bindi = !!opts.bindi;
  const armPose = opts.armPose || (isDriver ? 'steering' : 'lap');

  // 1. Torso / Shirt with sculpted shoulder definition
  G.box(x, y + 0.34, z, 0.34, 0.38, 0.22, colShirt);
  G.box(x, y + 0.51, z - 0.08, 0.12, 0.04, 0.06, colShirt); // Collar

  // 2. Sculpted Neck
  G.prism(x, y + 0.54, z, 0.048, 0.048, 0.06, 6, colSkin);

  // 3. Head & Facial Structure
  G.prism(x, y + 0.62, z, 0.088, 0.08, 0.13, 8, colSkin);
  G.box(x, y + 0.625, z - 0.092, 0.024, 0.038, 0.028, colSkin); // Nose
  for (const s of [-1, 1]) {
    G.box(x + s * 0.095, y + 0.62, z, 0.016, 0.036, 0.024, colSkin); // Ears
  }

  // 4. Expressive Eyes & Facial Details (High contrast so they are visible from outside the car)
  if (headwear === 'sunglasses') {
    G.box(x, y + 0.635, z - 0.088, 0.115, 0.030, 0.018, hex('#0f172a'), 11); // Dark aviator lenses
    G.beam([x - 0.05, y + 0.638, z - 0.088], [x + 0.05, y + 0.638, z - 0.088], 0.008, hex('#fbbf24'), 11); // Gold wire bridge
  } else {
    for (const s of [-1, 1]) {
      G.box(x + s * 0.036, y + 0.635, z - 0.086, 0.022, 0.014, 0.008, hex('#ffffff')); // Sclera white
      G.box(x + s * 0.036, y + 0.635, z - 0.090, 0.012, 0.012, 0.004, hex('#111827')); // Pupil
    }
  }

  if (mustache) {
    G.box(x, y + 0.595, z - 0.092, 0.062, 0.014, 0.012, colHair);
  }
  if (bindi) {
    G.box(x, y + 0.66, z - 0.088, 0.012, 0.014, 0.006, hex('#dc2626'));
  }

  // 5. Headwear: Hair, Turban, or Driver Cap
  if (headwear === 'turban') {
    G.box(x, y + 0.70, z + 0.01, 0.21, 0.11, 0.21, headwearCol);
    G.prism(x, y + 0.73, z + 0.01, 0.09, 0.09, 0.08, 8, headwearCol);
    G.box(x, y + 0.74, z - 0.09, 0.028, 0.045, 0.02, hex('#f59e0b'), 11);
  } else if (headwear === 'cap') {
    G.box(x, y + 0.68, z + 0.01, 0.19, 0.065, 0.20, headwearCol);
    G.box(x, y + 0.66, z - 0.10, 0.16, 0.018, 0.06, hex('#1e293b'), 12);
  } else {
    G.box(x, y + 0.69, z + 0.02, 0.18, 0.07, 0.18, colHair);
  }

  // 6. Arms & Hands
  if (isDriver) {
    const hx = driverHandX || x;
    if (armPose === 'window_elbow') {
      // Iconic Indian driving pose: right arm rests on window sill
      G.beam([x + 0.15, y + 0.46, z], [x + 0.28, y + 0.50, z - 0.06], 0.062, colShirt);
      G.beam([x + 0.28, y + 0.50, z - 0.06], [x + 0.29, y + 0.50, z - 0.24], 0.058, colShirt);
      G.box(x + 0.29, y + 0.50, z - 0.26, 0.048, 0.045, 0.045, colSkin);
      // Left arm reaches steering wheel
      G.beam([x - 0.15, y + 0.46, z + 0.02], [hx, y + 0.43, z - 0.22], 0.062, colShirt);
      G.box(hx, y + 0.43, z - 0.24, 0.048, 0.048, 0.048, colSkin);
    } else {
      G.beam([x - 0.15, y + 0.46, z + 0.02], [hx - 0.11, y + 0.42, z - 0.22], 0.062, colShirt);
      G.beam([x + 0.15, y + 0.46, z + 0.02], [hx + 0.11, y + 0.42, z - 0.22], 0.062, colShirt);
      G.box(hx - 0.11, y + 0.42, z - 0.24, 0.048, 0.048, 0.048, colSkin);
      G.box(hx + 0.11, y + 0.42, z - 0.24, 0.048, 0.048, 0.048, colSkin);
    }
  } else {
    if (armPose === 'phone') {
      G.beam([x + 0.15, y + 0.46, z], [x + 0.08, y + 0.40, z - 0.18], 0.058, colShirt);
      G.box(x + 0.08, y + 0.40, z - 0.20, 0.045, 0.045, 0.045, colSkin);
      G.box(x + 0.08, y + 0.42, z - 0.22, 0.038, 0.068, 0.012, hex('#00F0FF'), 1, 2.0); // Phone
      G.beam([x - 0.15, y + 0.46, z], [x - 0.11, y + 0.26, z - 0.12], 0.058, colShirt);
      G.box(x - 0.11, y + 0.26, z - 0.14, 0.045, 0.045, 0.045, colSkin);
    } else {
      G.beam([x - 0.15, y + 0.46, z], [x - 0.11, y + 0.26, z - 0.12], 0.058, colShirt);
      G.beam([x + 0.15, y + 0.46, z], [x + 0.11, y + 0.26, z - 0.12], 0.058, colShirt);
      G.box(x - 0.11, y + 0.26, z - 0.14, 0.045, 0.045, 0.045, colSkin);
      G.box(x + 0.11, y + 0.26, z - 0.14, 0.045, 0.045, 0.045, colSkin);
    }
  }

  // 7. Seated Thighs & Lap (Trousers / Dhoti)
  G.box(x, y + 0.16, z - 0.12, 0.32, 0.14, 0.26, hex('#1e2430'));
}

// Aerodynamic bumper curvature functions for VAJRA-S1
// Front bumper: sweeps smoothly forward along -Z at center (x=0), tangent to Z at apex
const frontCurve = (x, hw) => -0.28 * Math.cos(clamp(x / hw, -1, 1) * Math.PI * 0.5);
// Rear bumper: bulges convexly out along +Z at center, wraps smoothly into rear quarter panels
const rearCurve = (x, hw) => 0.20 * Math.cos(clamp(x / hw, -1, 1) * Math.PI * 0.5);

function buildVajra() {
  const G = new Geo(), B = hex('#0B5FC2'), C = hex('#17181C'), O = hex('#F0902A'), GL = hex('#0b1320'), R = hex('#FF3A2E'), HL = hex('#EAF6FF'), BK = hex('#0c0c0e');
  const ST = [
    { z: -2.36, w: 1.44, tw: 1.28, y0: 0.20, y1: 0.38, r: 0.16, dz: x => frontCurve(x, 0.72), capDome: 0.10 },
    { z: -2.26, w: 1.70, tw: 1.48, y0: 0.17, y1: 0.44, r: 0.20, dz: x => frontCurve(x, 0.85) * 0.65 },
    { z: -1.95, w: 1.88, tw: 1.62, y0: 0.15, y1: 0.53, r: 0.24, dz: x => frontCurve(x, 0.94) * 0.25 },
    { z: -1.50, w: 1.95, tw: 1.70, y0: 0.15, y1: 0.61, r: 0.26 },
    { z: -1.00, w: 1.95, tw: 1.72, y0: 0.15, y1: 0.64, r: 0.26 },
    { z: -0.45, w: 1.92, tw: 1.70, y0: 0.15, y1: 0.66, r: 0.28 },
    { z: 0.20, w: 1.97, tw: 1.72, y0: 0.15, y1: 0.71, r: 0.28 },
    { z: 0.90, w: 2.05, tw: 1.78, y0: 0.15, y1: 0.79, r: 0.30 },
    { z: 1.50, w: 2.06, tw: 1.80, y0: 0.16, y1: 0.83, r: 0.30 },
    { z: 2.05, w: 2.00, tw: 1.76, y0: 0.22, y1: 0.83, r: 0.26, dz: x => rearCurve(x, 1.00) * 0.35 },
    { z: 2.34, w: 1.86, tw: 1.66, y0: 0.28, y1: 0.77, r: 0.18, dz: x => rearCurve(x, 0.93), capDome: 0.08 }
  ];
  G.loft(ST, B, 4, 0, { n: 7, deg: 68 });
  const sideX = (z, y) => loftSideX(ST, z, y), topY = z => interp(ST, 'y1', z);

  // Front fender bulges over the wheels
  for (const s of [-1, 1]) G.loft([{ z: -2.0, cx: s * 0.79, w: 0.36, y0: 0.42, y1: 0.55, r: 0.16 }, { z: -1.78, cx: s * 0.79, w: 0.40, y0: 0.42, y1: 0.7, r: 0.20 }, { z: -1.45, cx: s * 0.8, w: 0.42, y0: 0.42, y1: 0.78, r: 0.22 }, { z: -1.12, cx: s * 0.8, w: 0.40, y0: 0.42, y1: 0.72, r: 0.20 }, { z: -0.88, cx: s * 0.79, w: 0.34, y0: 0.42, y1: 0.6, r: 0.16 }], B, 4, 0, { n: 6, deg: 68 });

  // Cabin glass, carbon roof, fastback deck
  G.loft([{ z: -1.02, w: 1.30, tw: 1.22, y0: 0.60, y1: 0.66, r: 0.12 }, { z: -0.62, w: 1.40, tw: 1.1, y0: 0.62, y1: 0.9, r: 0.20 }, { z: -0.12, w: 1.44, tw: 1.0, y0: 0.64, y1: 1.1, r: 0.24 }, { z: 0.42, w: 1.46, tw: 1.0, y0: 0.68, y1: 1.14, r: 0.24 }, { z: 0.88, w: 1.42, tw: 0.98, y0: 0.72, y1: 1.1, r: 0.22 }, { z: 1.32, w: 1.24, tw: 0.9, y0: 0.76, y1: 0.96, r: 0.18 }, { z: 1.7, w: 0.95, tw: 0.8, y0: 0.8, y1: 0.86, r: 0.10 }], GL, 6, 0, { n: 7, deg: 68 });
  G.loft([{ z: -0.02, w: 0.94, y0: 1.085, y1: 1.12, r: 0.12 }, { z: 0.35, w: 0.98, y0: 1.12, y1: 1.155, r: 0.14 }, { z: 0.82, w: 0.92, y0: 1.085, y1: 1.12, r: 0.12 }], C, 5, 0, { n: 6, deg: 65 });
  G.loft([{ z: 1.2, w: 0.9, y0: 0.8, y1: 0.99, r: 0.12 }, { z: 1.7, w: 0.88, y0: 0.8, y1: 0.93, r: 0.12 }, { z: 2.12, w: 0.8, y0: 0.8, y1: 0.87, r: 0.10 }], C, 5, 0, { n: 6, deg: 65 });

  for (let i = 0; i < 6; i++) { const z = 1.3 + i * 0.13; G.box(0, lerp(0.99, 0.87, (z - 1.2) / 0.92) + 0.004, z, 0.66, 0.012, 0.045, BK, 12); }
  for (const s of [-1, 1]) {
    // wheel arches (dark gap around the tyres)
    G.ringX(s * 1.012, 0.36, -1.45, 0.37, 0.43, 14, BK, 12, 0, -Math.PI / 2, Math.PI / 2, -s);
    G.ringX(s * (sideX(1.35, 0.55) + 0.006), 0.36, 1.35, 0.37, 0.43, 14, BK, 12, 0, -Math.PI / 2, Math.PI / 2, -s);
    // side intake ahead of the rear wheel
    const ix0 = sideX(0.35, 0.45), ix1 = sideX(0.95, 0.45);
    G.hexa([[s * ix0 - s * 0.05, 0.3, 0.35], [s * ix0 + s * 0.012, 0.3, 0.35], [s * ix0 - s * 0.05, 0.6, 0.35], [s * ix0 + s * 0.012, 0.6, 0.35], [s * ix1 - s * 0.05, 0.32, 0.98], [s * ix1 + s * 0.012, 0.32, 0.98], [s * ix1 - s * 0.05, 0.64, 0.98], [s * ix1 + s * 0.012, 0.64, 0.98]], BK, 12);
    // door shut lines + handle
    for (const z of [-0.95, 0.3]) G.beam([s * (sideX(z, 0.24) + 0.004), 0.24, z], [s * (sideX(z, 0.62) + 0.004), 0.62, z + (z > 0 ? -0.08 : 0.05)], 0.008, BK, 12, 0, 0.012);
    G.box(s * (sideX(0.1, 0.6) + 0.006), 0.6, 0.1, 0.012, 0.03, 0.16, C, 5);
    // lightning-bolt stripe
    const pts = [[-1.25, 0.52], [0.3, 0.56], [0.62, 0.38], [0.85, 0.38]], X = (z, y) => s * (sideX(z, y) + 0.008);
    for (let i = 0; i < pts.length - 1; i++) G.beam([X(pts[i][0], pts[i][1]), pts[i][1], pts[i][0]], [X(pts[i + 1][0], pts[i + 1][1]), pts[i + 1][1], pts[i + 1][0]], 0.012, O, 4, 0, 0.045);
    // carbon side skirt, mirror
    G.loft([{ z: -1.05, cx: s * 0.98, w: 0.12, y0: 0.12, y1: 0.24, r: 0.04 }, { z: 1.0, cx: s * 1.02, w: 0.12, y0: 0.12, y1: 0.24, r: 0.04 }], C, 5, 0, { n: 2 });
    G.loft([{ z: -0.66, cx: s * 1.0, w: 0.1, y0: 0.82, y1: 0.9, r: 0.04 }, { z: -0.5, cx: s * 1.03, w: 0.16, y0: 0.8, y1: 0.92, r: 0.06 }, { z: -0.4, cx: s * 1.02, w: 0.14, y0: 0.81, y1: 0.9, r: 0.05 }], C, 5, 0, { n: 2 });
    G.beam([s * 0.72, 0.74, -0.52], [s * 0.96, 0.85, -0.52], 0.04, C, 5);
    // headlight: dark housing, LED slit, lens curved with the front nose
    const zInner = -2.20 + frontCurve(0.40, 0.72) * 0.45;
    G.beam([s * 0.40, 0.44, zInner], [s * 0.80, 0.53, -1.90], 0.10, BK, 12, 0, 0.07);
    G.beam([s * 0.42, 0.47, zInner - 0.015], [s * 0.78, 0.54, -1.915], 0.05, HL, 1, 2.6, 0.03);
    // tail-light wrap + wing end plates
    G.box(s * 1.08, 1.24, 2.1, 0.035, 0.44, 0.62, O, 4);
    G.beam([s * 0.42, 0.84, 2.0], [s * 0.42, 1.27, 2.12], 0.05, C, 5, 0, 0.2);
    G.box(s * 0.6, 1.386, 2.12, 0.08, 0.008, 0.46, O, 4);
    G.box(s * 0.36, topY(-1.2) + 0.005, -1.18, 0.26, 0.012, 0.34, BK, 12);
  }

  // hood pinstripes follow the curved bonnet
  for (const x of [-0.33, -0.11, 0.11, 0.33]) {
    const zs = [-2.22 + frontCurve(x, 0.72) * 0.35, -1.95, -1.5, -0.98];
    for (let i = 0; i < zs.length - 1; i++) G.beam([x, topY(zs[i]) + 0.006, zs[i]], [x, topY(zs[i + 1]) + 0.006, zs[i + 1]], 0.035, O, 4, 0, 0.008);
  }

  // Curved aerodynamic carbon front splitter
  const N_SPLIT = 18;
  for (let i = 0; i < N_SPLIT; i++) {
    const u0 = -1 + 2 * (i / N_SPLIT), u1 = -1 + 2 * ((i + 1) / N_SPLIT);
    const x0 = u0 * 1.04, x1 = u1 * 1.04;
    const zf0 = -2.32 + frontCurve(x0, 1.04) * 1.15;
    const zf1 = -2.32 + frontCurve(x1, 1.04) * 1.15;
    const zb0 = zf0 + 0.32, zb1 = zf1 + 0.32;
    const yTop = 0.135, yBot = 0.09;
    // Top surface
    G.quad([x0, yTop, zb0], [x1, yTop, zb1], [x1, yTop, zf1], [x0, yTop, zf0], C, 5);
    // Bottom surface
    G.quad([x0, yBot, zf0], [x1, yBot, zf1], [x1, yBot, zb1], [x0, yBot, zb0], C, 5);
    // Front curved leading edge
    G.quad([x0, yBot, zf0], [x0, yTop, zf0], [x1, yTop, zf1], [x1, yBot, zf1], C, 5);
  }
  // Curved aerodynamic splitter endplate winglets
  for (const s of [-1, 1]) {
    const xBase = s * 1.04, zf = -2.32, zb = -2.05;
    G.quad([xBase, 0.09, zb], [xBase, 0.28, zb + 0.08], [xBase, 0.28, zf + 0.06], [xBase, 0.09, zf], C, 5);
    G.beam([xBase, 0.28, zb + 0.08], [xBase, 0.28, zf + 0.06], 0.02, O, 4);
  }

  // Curved front lower intake grille
  const N_INTAKE = 14;
  for (let i = 0; i < N_INTAKE; i++) {
    const u0 = -1 + 2 * (i / N_INTAKE), u1 = -1 + 2 * ((i + 1) / N_INTAKE);
    const x0 = u0 * 0.60, x1 = u1 * 0.60;
    const z0 = -2.30 + frontCurve(x0, 0.68) * 0.95;
    const z1 = -2.30 + frontCurve(x1, 0.68) * 0.95;
    G.quad([x0, 0.16, z0], [x1, 0.16, z1], [x1, 0.32, z1], [x0, 0.32, z0], BK, 12);
    G.beam([x0, 0.33, z0], [x1, 0.33, z1], 0.035, C, 5);
    G.beam([x0, 0.16, z0], [x1, 0.16, z1], 0.035, C, 5);
  }

  // Curved carbon aerodynamic rear diffuser (Venturi channels)
  const N_DIFF = 18;
  for (let i = 0; i < N_DIFF; i++) {
    const u0 = -1 + 2 * (i / N_DIFF), u1 = -1 + 2 * ((i + 1) / N_DIFF);
    const x0 = u0 * 0.90, x1 = u1 * 0.90;
    const zt0 = 2.32 + rearCurve(x0, 0.92) * 1.05;
    const zt1 = 2.32 + rearCurve(x1, 0.92) * 1.05;
    const zl0 = 2.05, zl1 = 2.05;
    const yLo = 0.12, yHi = 0.28;
    // Underbody diffuser upsweep
    G.quad([x0, yLo, zl0], [x1, yLo, zl1], [x1, yHi, zt1], [x0, yHi, zt0], C, 5);
    // Trailing curved edge
    G.beam([x0, yHi, zt0], [x1, yHi, zt1], 0.035, C, 5);
  }
  // 5 Curved / fanned vertical diffuser strakes
  const finConfigs = [
    { x: 0, z0: 2.02, z1: 2.32 + rearCurve(0, 0.92) * 1.05, yaw: 0 },
    { x: -0.28, z0: 2.04, z1: 2.32 + rearCurve(-0.28, 0.92) * 1.05, yaw: -0.05 },
    { x: 0.28, z0: 2.04, z1: 2.32 + rearCurve(0.28, 0.92) * 1.05, yaw: 0.05 },
    { x: -0.60, z0: 2.08, z1: 2.32 + rearCurve(-0.60, 0.92) * 1.05, yaw: -0.10 },
    { x: 0.60, z0: 2.08, z1: 2.32 + rearCurve(0.60, 0.92) * 1.05, yaw: 0.10 }
  ];
  for (const fin of finConfigs) {
    const cz = (fin.z0 + fin.z1) / 2, len = fin.z1 - fin.z0;
    G.box(fin.x, 0.20, cz, 0.024, 0.16, len, BK, 5, 0, fin.yaw);
    // Orange accent stripe on fin tips
    G.beam([fin.x, 0.12, fin.z1 - 0.10], [fin.x, 0.26, fin.z1], 0.015, O, 4);
  }

  // Curved dark rear bumper fascia (between diffuser and upper deck)
  const N_FASCIA = 18;
  for (let i = 0; i < N_FASCIA; i++) {
    const u0 = -1 + 2 * (i / N_FASCIA), u1 = -1 + 2 * ((i + 1) / N_FASCIA);
    const x0 = u0 * 0.94, x1 = u1 * 0.94;
    const z0 = 2.33 + rearCurve(x0, 0.93);
    const z1 = 2.33 + rearCurve(x1, 0.93);
    G.quad([x0, 0.62, z0], [x1, 0.62, z1], [x1, 0.72, z1], [x0, 0.72, z0], BK, 12);
  }

  // Dual central titanium exhausts flush on the curved rear contour
  for (const x of [-0.14, 0.14]) {
    const zEx = 2.32 + rearCurve(x, 0.93) + 0.02;
    G.T = M4.model(x, 0.38, zEx, 0, Math.PI / 2, 0);
    // Outer titanium exhaust tip
    G.prism(0, 0, 0, 0.09, 0.09, 0.18, 16, hex('#c9cdd2'), 11);
    // Anodized blue/gold heat discoloration ring
    G.prism(0, 0.14, 0, 0.091, 0.091, 0.03, 16, hex('#3b82f6'), 11);
    // Dark hollow inner core
    G.prism(0, 0.181, 0, 0.068, 0.068, 0.004, 16, hex('#100c0a'), 12);
    G.T = null;
  }

  // High-downforce carbon rear wing with subtle curved trailing edge
  G.loft([
    { z: 1.84, w: 2.12, y0: 1.24, y1: 1.30, r: 0.02 },
    { z: 2.10, w: 2.14, y0: 1.27, y1: 1.36, r: 0.03, dz: x => rearCurve(x, 1.07) * 0.2 },
    { z: 2.36, w: 2.12, y0: 1.32, y1: 1.38, r: 0.02, dz: x => rearCurve(x, 1.06) * 0.45 }
  ], C, 5, 0, { n: 2, deg: 30 });

  VAJRA_DECAL = { x: sideX(-0.35, 0.4) + 0.008, y: 0.4, z: -0.35 };
  return G;
}
function buildVajraLights() {
  const W_ = hex('#F4F8FF'), R = hex('#FF2A1E'), A = hex('#FFA11A'), WR = hex('#FFFFFF');
  const head = new Geo(), tail = new Geo(), rev = new Geo(), indL = new Geo(), indR = new Geo();

  // Headlights positioned on curved front contour
  for (const s of [-1, 1]) {
    for (const t of [0.28, 0.66]) {
      const x = s * (0.40 + 0.40 * t);
      const zCurv = (-2.20 + frontCurve(0.40, 0.72) * 0.45) * (1 - t) + (-1.90) * t;
      head.T = M4.model(x, 0.455 + 0.09 * t, zCurv - 0.045, 0, Math.PI / 2, 0);
      head.prism(0, -0.012, 0, 0.052, 0.052, 0.024, 14, W_, 1, 3.0);
      head.T = null;
    }
  }

  // Curved full-width LED light ribbon following the rear bumper curvature
  const N_LIGHTS = 20;
  for (let i = 0; i < N_LIGHTS; i++) {
    const u0 = -1 + 2 * (i / N_LIGHTS), u1 = -1 + 2 * ((i + 1) / N_LIGHTS);
    const x0 = u0 * 0.92, x1 = u1 * 0.92;
    const z0 = 2.34 + rearCurve(x0, 0.93) + 0.008;
    const z1 = 2.34 + rearCurve(x1, 0.93) + 0.008;
    tail.beam([x0, 0.668, z0], [x1, 0.668, z1], 0.045, R, 1, 3.6, 0.035);
  }
  // Wrap-around ends into rear quarter panels
  for (const s of [-1, 1]) {
    const xEdge = s * 0.92, zEdge = 2.34 + rearCurve(xEdge, 0.93) + 0.008;
    tail.beam([xEdge, 0.668, zEdge], [s * 1.01, 0.70, 2.05], 0.045, R, 1, 3.6, 0.035);
    const zRev = 2.33 + rearCurve(s * 0.36, 0.93) + 0.015;
    rev.box(s * 0.36, 0.33, zRev, 0.16, 0.05, 0.012, WR, 1, 3.0);
    const I = s < 0 ? indL : indR;
    I.box(s * 0.86, 0.535, -1.93, 0.15, 0.045, 0.08, A, 1, 3.6);
    I.box(s * 0.975, 0.585, 2.24, 0.07, 0.065, 0.24, A, 1, 3.6);
    const zInd = 2.33 + rearCurve(s * 0.90, 0.93) + 0.012;
    I.box(s * 0.90, 0.585, zInd, 0.14, 0.05, 0.012, A, 1, 3.6);
    I.box(s * 1.02, 0.56, -1.2, 0.014, 0.03, 0.11, A, 1, 3.6);
  }
  return { head, tail, rev, indL, indR };
}
function beamVerts(len, rad, seg) {
  const v = [], rings = [[0, 0.0, 0.26], [0.18, 0.18, 0.2], [0.45, 0.45, 0.11], [1, 1, 0.0]];
  for (let k = 0; k < rings.length - 1; k++) { const [t0, s0, a0] = rings[k], [t1, s1, a1] = rings[k + 1];
    for (let i = 0; i < seg; i++) { const q0 = i / seg * 6.2832, q1 = (i + 1) / seg * 6.2832, P = (t, s, q) => [Math.cos(q) * rad * s, Math.sin(q) * rad * s * 0.55, -len * t];
      const quad = [[P(t0, s0, q0), a0], [P(t1, s1, q0), a1], [P(t1, s1, q1), a1], [P(t0, s0, q0), a0], [P(t1, s1, q1), a1], [P(t0, s0, q1), a0]];
      for (const [p, a] of quad) v.push(p[0], p[1], p[2], 1, 0.96, 0.86, a); } }
  return new Float32Array(v);
}

// ---------- NITRO SUPERSONIC EXHAUST FLAME MESH ----------
function buildNitroFlame() {
  const G = new Geo();
  // 1. Supersonic Mach diamond electric cyan core needle (extruding along Y)
  G.prism(0, 0, 0, 0.055, 0.012, 0.75, 10, hex('#00f0ff'), 1, 5.0);
  // Mach diamond shock rings
  G.prism(0, 0.15, 0, 0.075, 0.045, 0.09, 10, hex('#38bdf8'), 1, 4.5);
  G.prism(0, 0.35, 0, 0.065, 0.035, 0.09, 10, hex('#38bdf8'), 1, 4.2);
  G.prism(0, 0.55, 0, 0.055, 0.025, 0.08, 10, hex('#818cf8'), 1, 4.0);

  // 2. High-heat inner yellow-white core plume
  G.prism(0, 0, 0, 0.075, 0.025, 0.95, 10, hex('#fef08a'), 1, 4.2);

  // 3. Middle roaring fiery orange flame sheath
  G.prism(0, 0.05, 0, 0.115, 0.035, 1.35, 10, hex('#f97316'), 1, 3.5);

  // 4. Outer turbulent crimson exhaust fire plume with flickering tongues
  G.prism(0, 0.25, 0, 0.135, 0.010, 1.75, 10, hex('#dc2626'), 1, 3.0);
  G.prism(0, 0.65, 0, 0.105, 0.005, 1.45, 10, hex('#b91c1c'), 1, 2.5);
  return G;
}

// ---------- SOARING SKY BIRD MESH ----------
// ---------- REALISTIC AVIAN SPECIES & ANATOMY ----------
const BIRD_PALETTES = {
  gull: {
    body: hex('#f8fafc'), belly: hex('#ffffff'), mantle: hex('#94a3b8'), wingMid: hex('#cbd5e1'), wingTips: hex('#0f172a'),
    beak: hex('#f59e0b'), beakTip: hex('#dc2626'), eye: hex('#0f172a'), tail: hex('#ffffff'), tailBorder: hex('#64748b')
  },
  eagle: {
    body: hex('#452814'), belly: hex('#331d0e'), mantle: hex('#663d1e'), wingMid: hex('#523016'), wingTips: hex('#180d06'),
    beak: hex('#eab308'), beakTip: hex('#18181b'), eye: hex('#facc15'), tail: hex('#f1ede8'), tailBorder: hex('#26150a')
  },
  parrot: {
    body: hex('#10b981'), belly: hex('#34d399'), mantle: hex('#059669'), wingMid: hex('#0d9488'), wingTips: hex('#0284c7'),
    beak: hex('#f43f5e'), beakTip: hex('#e11d48'), eye: hex('#0f172a'), tail: hex('#047857'), tailBorder: hex('#0284c7')
  },
  dove: {
    body: hex('#94a3b8'), belly: hex('#cbd5e1'), mantle: hex('#64748b'), wingMid: hex('#475569'), wingTips: hex('#1e293b'),
    beak: hex('#fda4af'), beakTip: hex('#334155'), eye: hex('#be185d'), tail: hex('#64748b'), tailBorder: hex('#0f172a')
  },
  swallow: {
    body: hex('#1e293b'), belly: hex('#f8fafc'), mantle: hex('#0f172a'), wingMid: hex('#1e293b'), wingTips: hex('#020617'),
    beak: hex('#475569'), beakTip: hex('#0f172a'), eye: hex('#020617'), tail: hex('#0f172a'), tailBorder: hex('#020617')
  }
};

function buildBird(variant = 'gull') {
  const P = BIRD_PALETTES[variant] || BIRD_PALETTES.gull;
  const G = new Geo();

  // 1. Aerodynamic contoured avian body (streamlined keel breast + lumbar taper) (Material 15: Plumage)
  G.prism(0, 0, 0, 0.15, 0.13, 0.58, 8, P.body, 15);
  // Soft contoured underbelly & breast
  G.box(0, -0.065, 0.04, 0.19, 0.085, 0.44, P.belly, 15);
  // Throat and collar band
  G.prism(0, 0.04, -0.20, 0.13, 0.11, 0.22, 8, P.mantle, 15);

  // 2. Sculpted avian head, eyes and beak
  G.prism(0, 0.09, -0.32, 0.095, 0.082, 0.18, 8, P.body, 15);
  // Curved hunting or seed beak with glossy finish
  G.prism(0, 0.065, -0.46, 0.042, 0.012, 0.16, 4, P.beak, 1, 0.5);
  if (P.beakTip) {
    G.prism(0, 0.055, -0.52, 0.025, 0.006, 0.08, 4, P.beakTip, 1, 0.7);
  }
  // Detailed eyes with corneal catchlights
  for (const s of [-1, 1]) {
    G.box(s * 0.082, 0.105, -0.32, 0.020, 0.020, 0.022, P.eye, 1, 1.4);
    G.box(s * 0.085, 0.110, -0.32, 0.006, 0.006, 0.006, hex('#ffffff'), 1, 4.0);
  }

  // 3. Fanned layered tail with individual feather silhouettes (Material 15)
  if (variant === 'swallow') {
    // Deeply forked scissor swallow tail streamers
    G.tri([0, 0.02, 0.28], [-0.26, 0.02, 0.76], [-0.08, 0.02, 0.54], P.tail, 15);
    G.tri([0, 0.02, 0.28], [0.08, 0.02, 0.54], [0.26, 0.02, 0.76], P.tail, 15);
    G.tri([0, 0.02, 0.28], [-0.08, 0.02, 0.54], [0.08, 0.02, 0.54], P.tailBorder, 15);
  } else if (variant === 'parrot') {
    // Long elegant tapered parakeet tail
    G.tri([0, 0.02, 0.28], [-0.09, 0.02, 0.85], [0, 0.02, 0.95], P.tail, 15);
    G.tri([0, 0.02, 0.28], [0, 0.02, 0.95], [0.09, 0.02, 0.85], P.tail, 15);
  } else {
    // Broad fanned wedge tail (eagles, gulls, doves)
    G.tri([0, 0.02, 0.28], [-0.22, 0.02, 0.62], [0, 0.02, 0.56], P.tail, 15);
    G.tri([0, 0.02, 0.28], [0, 0.02, 0.56], [0.22, 0.02, 0.62], P.tail, 15);
    G.box(0, 0.022, 0.50, 0.36, 0.012, 0.12, P.tailBorder, 15);
  }
  return G;
}

function buildBirdWing(side, variant = 'gull') {
  const P = BIRD_PALETTES[variant] || BIRD_PALETTES.gull;
  const G = new Geo(), s = side;
  // 4. Multi-layered anatomical wings with plumage normals & SSS translucency (Material 15)
  // Inner wing arm & shoulder coverts
  G.quad([0, 0.045, -0.16], [s * 0.50, 0.065, -0.02], [s * 0.46, 0.025, 0.28], [0, 0.015, 0.22], P.mantle, 15);
  // Secondary mid-wing flight feathers
  G.quad([s * 0.46, 0.055, -0.04], [s * 0.92, 0.075, 0.12], [s * 0.82, 0.035, 0.34], [s * 0.46, 0.025, 0.28], P.wingMid, 15);
  // Outer wing with dark primary flight feathers & slotted wingtips
  G.quad([s * 0.92, 0.075, 0.12], [s * 1.40, 0.095, 0.28], [s * 1.28, 0.050, 0.44], [s * 0.82, 0.035, 0.34], P.wingTips, 15);
  // Individual fanned slotted wingtip feather fingers
  G.tri([s * 1.28, 0.050, 0.44], [s * 1.48, 0.095, 0.36], [s * 1.40, 0.095, 0.28], P.wingTips, 15);
  G.tri([s * 1.18, 0.045, 0.46], [s * 1.38, 0.085, 0.48], [s * 1.28, 0.050, 0.44], P.wingTips, 15);
  return G;
}

// ---------- 4 SIGNATURE MAJESTIC DRAGONS (Ice Dragons: Dark Blue | Fire Dragons: Red) ----------
const DRAGON_PALETTES = {
  // 1. Midnight Dark Blue Ice Dragon (Ice emitting: deep midnight navy blue scales, ice frost belly, glowing cyan eyes)
  obsidian: {
    sc: hex('#1e3a8a'), scDark: hex('#0f172a'), scHi: hex('#3b82f6'),
    belly: hex('#93c5fd'), bellyDark: hex('#60a5fa'), bellyEmis: 2.0,
    hn: hex('#172554'), hnDark: hex('#0a0f1d'),
    ey: hex('#38bdf8'), eyeEmis: 6.0, throat: hex('#0284c7'), throatEmis: 5.0,
    wingTop: hex('#172554'), wingTopEmis: 0.0,
    wingUnder: hex('#1d4ed8'), wingUnderEmis: 2.8,
    wingBone: hex('#0f172a'), wingRib: hex('#60a5fa'), wingRibEmis: 3.0,
    claw: hex('#0a0f1d')
  },
  // 2. Crimson Red Fire Dragon (Fire emitting: deep blood-red scales, fiery glowing red belly & throat, crimson wing membrane)
  volcanic: {
    sc: hex('#991b1b'), scDark: hex('#580808'), scHi: hex('#dc2626'),
    belly: hex('#ef4444'), bellyDark: hex('#991b1b'), bellyEmis: 5.8,
    hn: hex('#450a0a'), hnDark: hex('#250505'),
    ey: hex('#ff2200'), eyeEmis: 6.0, throat: hex('#ff1100'), throatEmis: 6.5,
    wingTop: hex('#7f1d1d'), wingTopEmis: 0.0,
    wingUnder: hex('#dc2626'), wingUnderEmis: 5.2,
    wingBone: hex('#450a0a'), wingRib: hex('#ef4444'), wingRibEmis: 5.0,
    claw: hex('#250505')
  },
  // 3. Deep Sapphire Dark Blue Ice Dragon (Ice emitting: rich cobalt dark blue scales, pale ice belly, frost throat & eyes)
  jade: {
    sc: hex('#1e40af'), scDark: hex('#021438'), scHi: hex('#2563eb'),
    belly: hex('#bfdbfe'), bellyDark: hex('#3b82f6'), bellyEmis: 2.2,
    hn: hex('#1e293b'), hnDark: hex('#0f172a'),
    ey: hex('#67e8f9'), eyeEmis: 6.0, throat: hex('#0369a1'), throatEmis: 5.2,
    wingTop: hex('#1e3a8a'), wingTopEmis: 0.0,
    wingUnder: hex('#2563eb'), wingUnderEmis: 3.0,
    wingBone: hex('#0f172a'), wingRib: hex('#93c5fd'), wingRibEmis: 3.2,
    claw: hex('#0f172a')
  },
  // 4. Scarlet Red Fire Dragon (Fire emitting: intense scarlet red scales, molten red belly, blazing ruby red underwing)
  gold: {
    sc: hex('#b91c1c'), scDark: hex('#7f1d1d'), scHi: hex('#f87171'),
    belly: hex('#ff3333'), bellyDark: hex('#b91c1c'), bellyEmis: 5.5,
    hn: hex('#550a0a'), hnDark: hex('#300505'),
    ey: hex('#ff3b00'), eyeEmis: 5.8, throat: hex('#ff2200'), throatEmis: 6.2,
    wingTop: hex('#881337'), wingTopEmis: 0.0,
    wingUnder: hex('#ef4444'), wingUnderEmis: 5.0,
    wingBone: hex('#550a0a'), wingRib: hex('#f87171'), wingRibEmis: 4.8,
    claw: hex('#300505')
  }
};
DRAGON_PALETTES.darkblue = DRAGON_PALETTES.obsidian;
DRAGON_PALETTES.sapphire = DRAGON_PALETTES.jade;
DRAGON_PALETTES.red = DRAGON_PALETTES.volcanic;
DRAGON_PALETTES.crimson = DRAGON_PALETTES.gold;

function buildDragonBody(variant = 'obsidian') {
  const P = DRAGON_PALETTES[variant] || DRAGON_PALETTES.obsidian;
  const isVolcanic = variant === 'volcanic' || variant === 'gold' || variant === 'red' || variant === 'crimson';
  const G = new Geo();

  // 1. Muscular segmented draconic torso with overlapping diamond scales (Material 14)
  G.cylZ(0, 0, 0, 0.74, 0.60, 4.2, 8, P.sc, 14);
  // Pectoral flight chest ridge
  G.cylZ(0, -0.22, -0.6, 0.60, 0.42, 1.8, 6, P.scHi, 14);

  // Front neck socket collar and rear pelvis collar for seamless articulation
  G.cylZ(0, 0.28, -2.0, 0.54, 0.48, 0.5, 6, P.sc, 14);
  G.cylZ(0, 0.08, 2.05, 0.48, 0.38, 0.5, 6, P.sc, 14);

  // Flank lateral diamond scale plates (alternating scale texture)
  for (let z = -1.8; z <= 1.8; z += 0.45) {
    for (const s of [-1, 1]) {
      G.box(s * 0.62, 0.06, z, 0.16, 0.34, 0.40, P.scHi, 14, 0, s * 0.12);
      G.box(s * 0.56, -0.24, z + 0.18, 0.14, 0.26, 0.36, P.scDark, 14);
    }
  }

  // 2. Segmented transverse gastrosteges (ribbed abdominal underbelly plates)
  for (let z = -1.8; z <= 1.8; z += 0.28) {
    G.box(0, -0.56, z, 0.88, 0.20, 0.22, P.belly, 14, P.bellyEmis || 0);
    G.box(0, -0.57, z + 0.13, 0.90, 0.10, 0.04, P.bellyDark, 14, (P.bellyEmis ? P.bellyEmis * 0.75 : 0));
    if (isVolcanic) {
      // Hot glowing magma fissure glowing between scutes
      G.box(0, -0.55, z, 0.46, 0.06, 0.14, hex('#ff2200'), 1, 5.5);
    }
  }

  // 3. Dorsal razor spine crests with textured webbing & magma cracks
  for (let z = -1.8; z <= 1.8; z += 0.36) {
    const spH = 0.58 + Math.sin((z + 1.8) * 0.8) * 0.38;
    G.tri([0, 0.78, z], [0, 0.78 + spH, z + 0.14], [0, 0.78, z + 0.28], P.hn, 14);
    G.tri([0, 0.78, z], [0, 0.78 + spH * 0.75, z + 0.08], [0, 0.78, z + 0.28], P.scHi, 14);
    if (isVolcanic) {
      // Molten magma fissure along dorsal base
      G.box(0, 0.79, z + 0.14, 0.11, 0.06, 0.26, hex('#ef4444'), 1, 4.8);
    }
  }

  // 4. Muscular hind legs and textured talons tucked in flight
  for (const s of [-1, 1]) {
    G.beam([s * 0.58, -0.08, 0.8], [s * 0.82, -0.64, 2.2], 0.26, P.sc, 14);
    G.box(s * 0.82, -0.60, 2.2, 0.28, 0.22, 0.35, P.scDark, 14); // Knee armor
    // 3 Front curved talons + 1 rear thumb claw
    for (let tc = -0.09; tc <= 0.09; tc += 0.09) {
      G.prism(s * 0.82 + tc, -0.70, 2.40, 0.040, 0.008, 0.34, 4, P.claw, 14);
    }
    G.prism(s * 0.82, -0.64, 2.05, 0.034, 0.008, 0.24, 4, P.claw, 14);

    // Anatomical muscular shoulder sockets & overlapping scapular armor cowls (NO WING GAPS!)
    G.prism(s * 0.60, 0.35, 0.0, 0.40, 0.34, 0.78, 8, P.sc, 14);
    G.curvBoxZ(s * 0.58, 0.46, 0.05, 0.42, 0.24, 0.90, 0.10, P.scHi, 14, 0, { colTop: P.scDark });
    G.beam([0, -0.15, -0.8], [s * 0.60, 0.35, 0.0], 0.24, P.sc, 14); // Clavicular strut
    // Flank shelf scute along body for seamless wing membrane integration
    G.box(s * 0.62, 0.08, 1.2, 0.24, 0.18, 1.8, P.scDark, 14);
  }

  return G;
}

function buildDragonHead(variant = 'obsidian') {
  const P = DRAGON_PALETTES[variant] || DRAGON_PALETTES.obsidian;
  const isVolcanic = variant === 'volcanic' || variant === 'gold' || variant === 'red' || variant === 'crimson';
  const G = new Geo();

  // Neck base sleeve collar slips inside torso front socket
  G.cylZ(0, 0, 0.05, 0.52, 0.46, 0.35, 6, P.sc, 14);

  // S-curved muscular neck from pivot (0,0,0) to skull base (0, 0.90, -1.4)
  G.beam([0, 0, 0], [0, 0.90, -1.4], 0.58, P.sc, 14);
  for (let t = 0; t <= 1; t += 0.22) {
    const ny = lerp(0.04, 0.87, t), nz = lerp(-0.1, -1.3, t);
    G.box(0, ny - 0.26, nz, 0.48, 0.14, 0.22, P.belly, 14, P.bellyEmis || 0);
    G.tri([0, ny + 0.32, nz], [0, ny + 0.68, nz + 0.08], [0, ny + 0.30, nz + 0.18], P.hn, 14);
    if (isVolcanic) {
      G.box(0, ny - 0.28, nz, 0.24, 0.08, 0.18, hex('#ff2200'), 1, 5.8);
    }
  }

  // Armored draconic skull with nostrils, brow horns, and serrated jaws - curved-edge cuboidal cylinder
  G.curvBoxZ(0, 1.02, -1.85, 0.96, 0.64, 1.15, 0.18, P.sc, 14, 0, { scaleFrontX: 0.80, scaleFrontY: 0.86, colTop: P.scHi });
  // Snout & jaws: curved-edge cuboidal cylinders tapering toward nose
  G.curvBoxZ(0, 0.98, -2.62, 0.60, 0.26, 1.10, 0.08, P.sc, 14, 0, { scaleFrontX: 0.72, scaleFrontY: 0.82, offFrontY: -0.05, colTop: P.scHi });
  G.curvBoxZ(0, 0.76, -2.54, 0.52, 0.18, 0.96, 0.06, P.belly, 14, P.bellyEmis || 0, { scaleFrontX: 0.70, scaleFrontY: 0.84 });
  G.box(0, 0.85, -2.52, 0.44, 0.08, 0.88, hex('#2d0808'), 0); // Mouth cavity
  // Glowing fire/ice throat duct
  G.box(0, 0.88, -2.18, 0.28, 0.16, 0.38, P.throat, 1, P.throatEmis);
  // Nostrils
  G.box(-0.13, 1.00, -3.12, 0.05, 0.04, 0.08, P.scDark, 14);
  G.box(0.13, 1.00, -3.12, 0.05, 0.04, 0.08, P.scDark, 14);

  // Razor fangs, glowing eyes with slit pupils & grand swept horns
  for (const s of [-1, 1]) {
    G.prism(s * 0.19, 0.76, -2.82, 0.042, 0.008, 0.20, 4, hex('#ffffff'), 1, 1.4);
    G.prism(s * 0.16, 0.77, -2.58, 0.038, 0.007, 0.15, 4, hex('#ffffff'), 1, 1.4);
    G.prism(s * 0.18, 0.92, -2.70, 0.038, 0.007, 0.15, 4, hex('#ffffff'), 1, 1.4);

    G.box(s * 0.29, 1.14, -2.08, 0.09, 0.11, 0.13, P.ey, 1, P.eyeEmis);
    G.box(s * 0.30, 1.15, -2.08, 0.02, 0.08, 0.06, hex('#080d12'), 0);
    G.box(s * 0.30, 1.22, -2.08, 0.10, 0.04, 0.16, P.scDark, 14);

    G.beam([s * 0.22, 1.28, -1.62], [s * 0.74, 2.32, -0.65], 0.14, P.hn, 14);
    G.beam([s * 0.74, 2.32, -0.65], [s * 0.98, 2.87, -0.05], 0.095, P.hnDark, 14);
    if (isVolcanic) {
      G.prism(s * 0.98, 2.87, -0.05, 0.085, 0.014, 0.20, 4, hex('#ff3300'), 1, 4.8);
    }
    for (let hf = 0.2; hf <= 0.8; hf += 0.25) {
      const hpx = lerp(s * 0.22, s * 0.74, hf), hpy = lerp(1.28, 2.32, hf), hpz = lerp(-1.62, -0.65, hf);
      G.prism(hpx, hpy, hpz, 0.15, 0.15, 0.06, 6, P.scHi, 14);
    }
    G.beam([s * 0.28, 0.88, -1.82], [s * 0.62, 0.78, -1.40], 0.085, P.hn, 14);
  }

  return G;
}

function buildDragonTail1(variant = 'obsidian') {
  const P = DRAGON_PALETTES[variant] || DRAGON_PALETTES.obsidian;
  const isVolcanic = variant === 'volcanic' || variant === 'gold' || variant === 'red' || variant === 'crimson';
  const G = new Geo();

  // Tapered proximal tail segment from pivot (0,0,0) to mid-tail (0,0,2.8)
  G.cylZ(0, 0, 0, 0.48, 0.38, 0.35, 6, P.sc, 14); // Overlap collar
  G.cylZ(0, 0, 1.4, 0.44, 0.35, 2.8, 6, P.sc, 14, 0, { scaleFront: 0.68 });
  for (let tz = 0.3; tz <= 2.5; tz += 0.38) {
    const tspH = lerp(0.42, 0.22, tz / 2.8);
    G.tri([0, 0.18, tz], [0, 0.18 + tspH, tz + 0.12], [0, 0.18, tz + 0.24], P.hn, 14);
    if (isVolcanic) {
      G.box(0, 0.18, tz + 0.12, 0.08, 0.05, 0.22, hex('#ff3300'), 14, 4.0);
    }
  }

  return G;
}

function buildDragonTail2(variant = 'obsidian') {
  const P = DRAGON_PALETTES[variant] || DRAGON_PALETTES.obsidian;
  const isVolcanic = variant === 'volcanic' || variant === 'gold' || variant === 'red' || variant === 'crimson';
  const G = new Geo();

  G.cylZ(0, 0, 0.1, 0.28, 0.22, 0.3, 6, P.sc, 14); // Overlap collar

  if (isVolcanic) {
    // Volcanic Magma Dragon: Heavy barbed spiked tail club with glowing magma tips
    G.cylZ(0, 0, 0.8, 0.24, 0.18, 1.6, 6, P.sc, 14);
    G.prism(0, 0, 1.8, 0.38, 0.38, 0.88, 8, P.sc, 14);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 0.75]) {
      const sx = Math.cos(a) * 0.70, sy = Math.sin(a) * 0.70;
      G.tri([0, 0, 1.6], [sx, sy, 2.2], [0, 0, 2.0], P.hn, 14);
      G.prism(sx * 1.15, sy * 1.15, 2.3, 0.07, 0.014, 0.26, 4, hex('#ff2200'), 1, 5.0);
    }
  } else {
    // Ice Dragons: Long spined whip tail with dual-blade caudal rudder fin
    for (let tz = 0.2; tz <= 1.8; tz += 0.32) {
      G.prism(0, 0, tz, 0.16, 0.12, 0.38, 6, P.sc, 14);
      G.tri([0, 0.08, tz], [0, 0.30, tz + 0.10], [0, 0.08, tz + 0.20], P.hn, 14);
    }
    // Dual-blade aerodynamic caudal rudder fin
    G.tri([0, 0, 1.0], [-1.05, 0, 2.5], [0, 0, 1.9], P.wingUnder, 14, 2.2);
    G.tri([0, 0, 1.0], [1.05, 0, 2.5], [0, 0, 1.9], P.wingUnder, 14, 2.2);
    G.beam([0, 0, 1.0], [-1.05, 0, 2.5], 0.060, P.wingBone, 14);
    G.beam([0, 0, 1.0], [1.05, 0, 2.5], 0.060, P.wingBone, 14);
  }

  return G;
}

function buildDragon(variant = 'obsidian') {
  // Legacy complete assembled dragon mesh fallback
  const G = buildDragonBody(variant);
  // Add head at static pose
  const H = buildDragonHead(variant);
  for (let i = 0; i < H.p.length; i += 3) {
    G.p.push(H.p[i], H.p[i + 1] + 0.28, H.p[i + 2] - 1.8);
    G.n.push(H.n[i], H.n[i + 1], H.n[i + 2]);
    G.c.push(H.c[i], H.c[i + 1], H.c[i + 2]);
    const mi = (i / 3) * 2;
    G.m.push(H.m[mi], H.m[mi + 1]);
  }
  // Add tail1
  const T1 = buildDragonTail1(variant);
  for (let i = 0; i < T1.p.length; i += 3) {
    G.p.push(T1.p[i], T1.p[i + 1] + 0.08, T1.p[i + 2] + 1.9);
    G.n.push(T1.n[i], T1.n[i + 1], T1.n[i + 2]);
    G.c.push(T1.c[i], T1.c[i + 1], T1.c[i + 2]);
    const mi = (i / 3) * 2;
    G.m.push(T1.m[mi], T1.m[mi + 1]);
  }
  // Add tail2
  const T2 = buildDragonTail2(variant);
  for (let i = 0; i < T2.p.length; i += 3) {
    G.p.push(T2.p[i], T2.p[i + 1] + 0.08, T2.p[i + 2] + 4.7);
    G.n.push(T2.n[i], T2.n[i + 1], T2.n[i + 2]);
    G.c.push(T2.c[i], T2.c[i + 1], T2.c[i + 2]);
    const mi = (i / 3) * 2;
    G.m.push(T2.m[mi], T2.m[mi + 1]);
  }
  return G;
}

function buildDragonWing(side, variant = 'obsidian') {
  const P = DRAGON_PALETTES[variant] || DRAGON_PALETTES.obsidian;
  const isVolcanic = variant === 'volcanic' || variant === 'gold' || variant === 'red' || variant === 'crimson';
  const G = new Geo(), s = side;

  // 1. Scaled-down muscular wing arm with deep internal anchor inside torso (NO GAPS!)
  const armRoot = [-s * 0.35, -0.06, 0.0];
  const elbow = [s * 2.5, 0.60, -0.35];
  const wrist = [s * 5.4, 1.12, -0.70];

  G.beam(armRoot, elbow, 0.24, P.wingBone, 14);
  G.box(s * 1.25, 0.30, -0.18, 0.26, 0.18, 0.22, P.scDark, 14); // Arm scale armor
  G.beam(elbow, wrist, 0.17, P.wingBone, 14); // Forearm
  // Wing elbow joint & sharp thumb claw
  G.prism(elbow[0], elbow[1] + 0.20, elbow[2], 0.080, 0.016, 0.28, 4, P.claw, 14);
  G.prism(wrist[0], wrist[1] + 0.14, wrist[2], 0.065, 0.012, 0.22, 4, P.claw, 14);

  // 2. 5 Skeletal Wing Finger Spars (proportional, agile span)
  const F1 = [s * 7.0, 0.42, 0.65];
  const F2 = [s * 8.2, -0.15, 2.20];
  const F3 = [s * 6.5, -0.68, 3.45];
  const F4 = [s * 4.2, -0.84, 4.20];
  const F5 = [s * 2.1, -0.65, 3.45];

  // Scalloped trailing edge midpoints (gives iconic curved bat-wing scallops between finger claws)
  const M12 = [s * 7.3, 0.08, 1.55];
  const M23 = [s * 7.0, -0.46, 2.95];
  const M34 = [s * 5.2, -0.78, 3.90];
  const M45 = [s * 3.1, -0.76, 3.75];
  const M5R = [s * 0.9, -0.55, 3.20];

  // Structural skeletal bone spars
  G.beam(wrist, F1, 0.095, P.wingBone, 14);
  G.beam(wrist, F2, 0.088, P.wingBone, 14);
  G.beam(wrist, F3, 0.080, P.wingBone, 14);
  G.beam(wrist, F4, 0.072, P.wingBone, 14);
  G.beam(elbow, F5, 0.065, P.wingBone, 14);

  // 3. Continuous 100% gapless double-sided patagium membrane (EVERY WEB COMPLETELY FILLED!)
  const yT = 0.015, yB = -0.015;
  const pT = (v) => [v[0], v[1] + yT, v[2]];
  const pB = (v) => [v[0], v[1] + yB, v[2]];

  // Deep internal root anchors inside body torso (anchored along dragon's flank)
  const R0 = [-s * 0.38, -0.05, -0.20]; // Shoulder anchor
  const R1 = [-s * 0.38, -0.02, 0.70];  // Mid-flank anchor
  const R2 = [-s * 0.38, -0.04, 1.70];  // Rear-flank anchor
  const R3 = [-s * 0.38, -0.06, 2.60];  // Hip/pelvis anchor

  const topEm = P.wingTopEmis || 0;
  const undEm = P.wingUnderEmis || 0;

  // Helper to add a double-sided quad with correct normals
  const addQuad = (p1, p2, p3, p4) => {
    // Top surface
    G.quad(pT(p1), pT(p2), pT(p3), pT(p4), P.wingTop, 14, topEm, [0, -2, 0]);
    // Bottom surface (reversed winding order for downward normal)
    G.quad(pB(p4), pB(p3), pB(p2), pB(p1), P.wingUnder, 14, undEm, [0, 2, 0]);
  };

  // Helper to add a double-sided triangle with correct normals
  const addTri = (p1, p2, p3) => {
    G.tri(pT(p1), pT(p2), pT(p3), P.wingTop, 14, topEm, [0, 1, 0]);
    G.tri(pB(p1), pB(p3), pB(p2), P.wingUnder, 14, undEm, [0, -1, 0]);
  };

  // --- REGION A: Propatagium & Flank Patagium (100% GAPLESS FLANK ATTACHMENT) ---
  addQuad(R0, armRoot, elbow, R1);       // Shoulder to elbow
  addQuad(R1, elbow, F5, R2);            // Elbow & Finger 5 to mid-torso
  addTri(R2, F5, M5R);                   // Trailing edge scallop to hip
  addTri(R2, M5R, R3);

  // --- REGION B: Forearm to Finger 1 Web ---
  addTri(elbow, wrist, F1);

  // --- REGION C: Web between Finger 1 and Finger 2 (Solid from Wrist to Tips!) ---
  addTri(wrist, F1, M12);
  addTri(wrist, M12, F2);

  // --- REGION D: Web between Finger 2 and Finger 3 (Solid from Wrist to Tips!) ---
  addTri(wrist, F2, M23);
  addTri(wrist, M23, F3);

  // --- REGION E: Web between Finger 3 and Finger 4 (Solid from Wrist to Tips!) ---
  addTri(wrist, F3, M34);
  addTri(wrist, M34, F4);

  // --- REGION F: Web between Forearm, Finger 4 and Finger 5 ---
  addQuad(elbow, wrist, F4, M45);
  addTri(elbow, M45, F5);

  // Radiating tension ribs / veins along all web panels
  G.beam(wrist, M12, 0.026, P.wingRib, 14, P.wingRibEmis || 0);
  G.beam(wrist, M23, 0.026, P.wingRib, 14, P.wingRibEmis || 0);
  G.beam(wrist, M34, 0.026, P.wingRib, 14, P.wingRibEmis || 0);
  G.beam(elbow, M45, 0.026, P.wingRib, 14, P.wingRibEmis || 0);
  G.beam(elbow, M5R, 0.026, P.wingRib, 14, P.wingRibEmis || 0);

  if (isVolcanic) {
    // Molten glowing radiant veins across underwing
    G.beam(wrist, M23, 0.022, hex('#ff3300'), 1, 4.8);
    G.beam(elbow, M45, 0.022, hex('#ef4444'), 1, 4.5);
    G.beam(elbow, M5R, 0.020, hex('#ff5500'), 1, 4.2);
  }

  return G;
}

// ---------- MYTHICAL WATER SERPENT (LEVIATHAN - ORTHOGRAPHIC REFERENCE) ----------
function buildSerpentHead() {
  const G = new Geo();
  const SC = hex('#0a3748'), SCD = hex('#051e27'), SCHI = hex('#155e75');
  const BELLY = hex('#8da4af'), BELLY_D = hex('#3b4d57');
  const BL = hex('#22d3ee'), EYE = hex('#38bdf8');
  const FIN_MEM = hex('#0891b2'), FIN_RAY = hex('#155e75'), HORN = hex('#083344');

  // 1. Sleek hydrodynamic aquatic skull & face - curved-edge cuboidal cylinder (Material 14)
  G.curvBoxZ(0, 0, -0.3, 1.40, 1.10, 2.6, 0.32, SC, 14, 0, { scaleFrontX: 0.74, scaleFrontY: 0.82, colTop: SCHI });
  // Supraorbital crests and tapered aquatic snout - curved-edge cuboidal cylinder
  G.curvBoxZ(0, 0.18, -1.55, 0.80, 0.34, 1.55, 0.12, SC, 14, 0, { scaleFrontX: 0.58, scaleFrontY: 0.74, offFrontY: -0.04, colTop: SCHI });
  G.curvBoxZ(0, 0.33, -1.42, 0.46, 0.12, 1.25, 0.04, SCD, 14, 0, { scaleFrontX: 0.65, scaleFrontY: 0.80 });
  // Ventral jaw & throat scutes - curved-edge cuboidal cylinder
  G.curvBoxZ(0, -0.18, -1.52, 0.74, 0.28, 1.48, 0.08, BELLY, 14, 0, { scaleFrontX: 0.58, scaleFrontY: 0.74 });
  G.box(0, 0.0, -1.48, 0.56, 0.08, 1.38, hex('#11202b'), 0); // Mouth cavity

  // 2. Ivory needle sea-fangs
  for (const s of [-1, 1]) {
    G.prism(s * 0.25, -0.04, -1.95, 0.042, 0.008, 0.24, 4, hex('#f0f9ff'), 1, 1.5);
    G.prism(s * 0.21, -0.15, -1.72, 0.038, 0.008, 0.19, 4, hex('#f0f9ff'), 1, 1.5);
    G.prism(s * 0.23, 0.08, -1.82, 0.035, 0.006, 0.17, 4, hex('#f0f9ff'), 1, 1.5);

    // Glowing cyan-blue eyes with dark slit pupil
    G.box(s * 0.42, 0.30, -0.80, 0.095, 0.13, 0.15, EYE, 1, 5.5);
    G.box(s * 0.44, 0.31, -0.80, 0.032, 0.09, 0.05, hex('#031d28'), 0); // Slit pupil

    // Brow armor plate
    G.box(s * 0.40, 0.40, -0.80, 0.13, 0.06, 0.19, SCHI, 14);

    // Backward-swept aquatic crown horns ("HEAD (DETAIL)")
    G.beam([s * 0.24, 0.46, -0.3], [s * 0.60, 1.30, 0.68], 0.095, HORN, 14);
    G.beam([s * 0.60, 1.30, 0.68], [s * 0.75, 1.72, 1.30], 0.065, HORN, 14);
    // Secondary lateral cheek horns
    G.beam([s * 0.40, 0.16, -0.4], [s * 0.78, 0.48, 0.28], 0.070, HORN, 14);

    // "GILLS FOR UNDERWATER BREATHING" with bioluminescent edges
    for (let gi = 0; gi < 3; gi++) {
      const gz = 0.26 + gi * 0.39;
      G.box(s * 0.46, 0.02, gz, 0.05, 0.34, 0.08, SCD, 14);
      G.box(s * 0.48, 0.02, gz + 0.04, 0.025, 0.30, 0.03, BL, 1, 4.8); // Glowing gill margin
    }

    // Sensory whisker barbel on chin
    G.beam([s * 0.15, -0.32, -1.4], [s * 0.25, -0.65, -0.9], 0.028, BL, 1, 3.8);

    // "BIOLUMINESCENT DOTS" (Photophores along jawline, temples, and neck)
    G.box(s * 0.38, -0.16, -1.20, 0.048, 0.048, 0.048, BL, 1, 5.0);
    G.box(s * 0.40, -0.14, -0.72, 0.048, 0.048, 0.048, BL, 1, 5.0);
    G.box(s * 0.43, -0.10, -0.25, 0.048, 0.048, 0.048, BL, 1, 5.0);
    G.box(s * 0.45, -0.06, 0.22, 0.048, 0.048, 0.048, BL, 1, 5.0);
    G.box(s * 0.45, -0.04, 0.68, 0.048, 0.048, 0.048, BL, 1, 5.0);
    G.box(s * 0.44, -0.02, 1.15, 0.048, 0.048, 0.048, BL, 1, 5.0);
  }

  // 3. Central spinous dorsal crest fin on head/neck
  G.tri([0, 0.68, -0.68], [0, 1.72, 0.48], [0, 0.58, 1.20], FIN_MEM, 14, 2.2);
  G.beam([0, 0.68, -0.68], [0, 1.72, 0.48], 0.048, FIN_RAY, 14);
  G.beam([0, 0.58, 1.20], [0, 1.72, 0.48], 0.038, FIN_RAY, 14);
  return G;
}

function buildSerpentBody(isChest = false) {
  const G = new Geo();
  const SC = hex('#0a3748'), SCD = hex('#051e27'), SCHI = hex('#155e75');
  const BELLY = hex('#8da4af'), BELLY_D = hex('#3b4d57');
  const BL = hex('#22d3ee');
  const FIN_MEM = hex('#0891b2'), FIN_RAY = hex('#155e75');

  // 1. Hydrodynamic cylindrical body segment with overlapping aquatic diamond scales (Length 3.4m for seamless gapless wave)
  G.cylZ(0, 0, 0, 0.76, 0.58, 3.4, 8, SC, 14);
  // Anterior sleeve collar (overlaps adjacent segment)
  G.cylZ(0, 0, -1.45, 0.80, 0.62, 0.50, 8, SCHI, 14);

  // Lateral keel scale plates for swimming stability
  for (const s of [-1, 1]) {
    G.box(s * 0.64, 0.06, 0, 0.12, 0.30, 2.4, SCHI, 14);
    // "BIOLUMINESCENT DOTS" running down each lateral flank
    G.box(s * 0.68, 0.02, -0.85, 0.052, 0.052, 0.065, BL, 1, 5.0);
    G.box(s * 0.68, 0.02, 0.0, 0.052, 0.052, 0.065, BL, 1, 5.0);
    G.box(s * 0.68, 0.02, 0.85, 0.052, 0.052, 0.065, BL, 1, 5.0);
  }

  // 2. "VENTRAL SCALES FOR WAVE MOVEMENT" (Segmented transverse silvery-seafoam scutes)
  for (let z = -1.1; z <= 1.1; z += 0.55) {
    G.box(0, -0.50, z, 0.96, 0.22, 0.46, BELLY, 14);
    G.box(0, -0.51, z + 0.24, 0.98, 0.10, 0.07, BELLY_D, 14); // Inter-scute dark groove
    // "BIOLUMINESCENT PATTERNS ON UNDERSIDE": dual glowing photophore lines
    G.box(-0.30, -0.52, z, 0.045, 0.045, 0.12, BL, 1, 4.5);
    G.box(0.30, -0.52, z, 0.045, 0.045, 0.12, BL, 1, 4.5);
  }

  // 3. "SPINOUS DORSAL FIN": Continuous dorsal fin with sharp needle spine rays
  G.tri([0, 0.72, -1.3], [0, 1.72, 0.1], [0, 0.70, 1.3], FIN_MEM, 14, 2.4);
  G.beam([0, 0.72, -1.3], [0, 1.72, 0.1], 0.045, FIN_RAY, 14);
  G.beam([0, 0.70, 1.3], [0, 1.72, 0.1], 0.040, FIN_RAY, 14);

  // Needle fin spine tip
  G.prism(0, 1.76, 0.1, 0.028, 0.007, 0.16, 4, hex('#e0f2fe'), 1, 3.8);
  return G;
}

// "TRANSFUSED WEBBING FOR SWIMMING": Pair of fan-shaped pectoral flipper fins
function buildSerpentFlipper(side) {
  const G = new Geo(), s = side;
  const FIN_MEM = hex('#0891b2'), FIN_RAY = hex('#155e75'), RAY_TIP = hex('#22d3ee');

  // Muscular fin shoulder base
  G.box(s * 0.20, 0, 0, 0.36, 0.22, 0.42, hex('#0a3748'), 14);

  // 4 Radiating curved fin rays
  const R1 = [s * 1.5, -0.30, 0.8], R2 = [s * 2.2, -0.50, 1.8], R3 = [s * 1.9, -0.60, 2.8], R4 = [s * 1.1, -0.55, 3.3];
  G.beam([s * 0.2, 0, 0], R1, 0.068, FIN_RAY, 14);
  G.beam([s * 0.2, 0, 0], R2, 0.058, FIN_RAY, 14);
  G.beam([s * 0.2, 0, 0.2], R3, 0.052, FIN_RAY, 14);
  G.beam([s * 0.2, 0, 0.4], R4, 0.048, FIN_RAY, 14);

  // Translucent scalloped webbing between rays (Material 14)
  G.tri([s * 0.2, 0, 0], R1, R2, FIN_MEM, 14, 2.2);
  G.tri([s * 0.2, 0, 0.2], R2, R3, FIN_MEM, 14, 2.2);
  G.tri([s * 0.2, 0, 0.4], R3, R4, FIN_MEM, 14, 2.2);

  // Glowing tips on swimming fins
  G.prism(R1[0], R1[1], R1[2], 0.034, 0.012, 0.16, 4, RAY_TIP, 1, 4.5);
  G.prism(R2[0], R2[1], R2[2], 0.034, 0.012, 0.16, 4, RAY_TIP, 1, 4.5);
  G.prism(R3[0], R3[1], R3[2], 0.034, 0.012, 0.16, 4, RAY_TIP, 1, 4.5);
  G.prism(R4[0], R4[1], R4[2], 0.034, 0.012, 0.16, 4, RAY_TIP, 1, 4.5);
  return G;
}

// "PADDLE-LIKE CAUDAL FIN": Flowing aquatic fluke fin with curved lobes
function buildSerpentTail() {
  const G = new Geo();
  const SC = hex('#0a3748'), SCD = hex('#051e27');
  const BELLY = hex('#8da4af');
  const BL = hex('#22d3ee');
  const FIN_MEM = hex('#0891b2'), FIN_RAY = hex('#155e75');

  // 1. Tapered posterior caudal segment (Material 14)
  G.cylZ(0, 0, 1.8, 0.50, 0.38, 3.6, 6, SC, 14, 0, { scaleFront: 0.4 });
  G.box(0, -0.26, 0, 0.58, 0.15, 3.0, BELLY, 14);

  // Bioluminescent tail spots
  G.box(-0.32, 0, 0.8, 0.045, 0.045, 0.09, BL, 1, 4.8);
  G.box(0.32, 0, 0.8, 0.045, 0.045, 0.09, BL, 1, 4.8);
  G.box(-0.25, 0, 1.9, 0.038, 0.038, 0.09, BL, 1, 4.8);
  G.box(0.25, 0, 1.9, 0.038, 0.038, 0.09, BL, 1, 4.8);

  // 2. Large sweeping paddle-like caudal fluke fin ("PADDLE-LIKE CAUDAL FIN")
  // Upper dorsal lobe
  G.tri([0, 0.32, 1.6], [0, 2.45, 3.9], [0, 0.08, 3.3], FIN_MEM, 14, 2.6);
  G.beam([0, 0.32, 1.6], [0, 2.45, 3.9], 0.055, FIN_RAY, 14);
  G.beam([0, 0.08, 3.3], [0, 2.45, 3.9], 0.045, FIN_RAY, 14);

  // Caudal fan lobes (broad aquatic propulsion paddle)
  G.tri([0, 0, 2.0], [-1.95, 0.14, 4.3], [0, 0.04, 3.7], FIN_MEM, 14, 2.6);
  G.tri([0, 0, 2.0], [1.95, 0.14, 4.3], [0, 0.04, 3.7], FIN_MEM, 14, 2.6);
  G.beam([0, 0, 2.0], [-1.95, 0.14, 4.3], 0.060, FIN_RAY, 14);
  G.beam([0, 0, 2.0], [1.95, 0.14, 4.3], 0.060, FIN_RAY, 14);

  // Trailing curved fin tips
  G.tri([-1.95, 0.14, 4.3], [-0.90, 0.06, 5.3], [0, 0.04, 3.7], FIN_MEM, 14, 2.4);
  G.tri([1.95, 0.14, 4.3], [0.90, 0.06, 5.3], [0, 0.04, 3.7], FIN_MEM, 14, 2.4);
  G.beam([-1.95, 0.14, 4.3], [-0.90, 0.06, 5.3], 0.045, FIN_RAY, 14);
  G.beam([1.95, 0.14, 4.3], [0.90, 0.06, 5.3], 0.045, FIN_RAY, 14);

  // Bioluminescent margin rim on fluke
  G.prism(-0.90, 0.06, 5.3, 0.042, 0.016, 0.22, 4, BL, 1, 4.8);
  G.prism(0.90, 0.06, 5.3, 0.042, 0.016, 0.22, 4, BL, 1, 4.8);
  G.prism(0, 2.45, 3.9, 0.042, 0.016, 0.22, 4, BL, 1, 4.8);
  return G;
}

function buildWheel() {
  const G = new Geo();
  addTyre(G, 0, 0, 0, 0.36, 0.3, 1, { twin: true, spokes: 5, spoke: hex('#d3d7dc'), barrel: hex('#26282c'), seg: 26 });
  return G;
}

// ---------- road traffic vehicles (hatch, sedan, suv, taxi, neon) ----------
const PAINTS = {
  white: '#f1f3f7',
  red: '#c0272d',
  silver: '#bcc2ca',
  black: '#16181b',
  blue: '#1d4ed8',
  maroon: '#6e1d24',
  grey: '#4f5561',
  taxi: '#f59e0b'
};

const VEH = {
  hatch: { L: 3.85, W: 1.70, sill: 0.24, belt: 0.95, roof: 1.50, noseH: 0.74, tailH: 0.98, hood: -0.9, ws: -0.1, rw: 1.15, rb: 1.72, wz: [-1.25, 1.22], wr: 0.3, r: 0.2 },
  sedan: { L: 4.45, W: 1.72, sill: 0.24, belt: 0.93, roof: 1.46, noseH: 0.74, tailH: 0.93, hood: -0.9, ws: -0.05, rw: 0.85, rb: 1.42, wz: [-1.38, 1.32], wr: 0.31, r: 0.2 },
  suv: { L: 4.5, W: 1.86, sill: 0.4, belt: 1.2, roof: 1.9, noseH: 1.05, tailH: 1.18, hood: -1.05, ws: -0.42, rw: 1.95, rb: 2.2, wz: [-1.42, 1.42], wr: 0.38, r: 0.16, rails: true },
  amb: { L: 4.33, W: 1.66, sill: 0.3, belt: 1.0, roof: 1.6, noseH: 0.94, tailH: 0.94, hood: -0.62, ws: -0.18, rw: 0.95, rb: 1.36, wz: [-1.3, 1.25], wr: 0.34, r: 0.3, chrome: true },
  neon: { L: 4.5, W: 1.86, sill: 0.18, belt: 0.72, roof: 1.2, noseH: 0.52, tailH: 0.8, hood: -0.75, ws: 0.05, rw: 0.95, rb: 1.75, wz: [-1.4, 1.35], wr: 0.34, r: 0.22, neon: true }
};
function buildRoadCar(kind, paint) {
  const S = VEH[kind], G = new Geo(), col = hex(paint), L2 = S.L / 2, BK = hex('#111214'), GL = hex('#162029'), CH = hex('#c9ced3'), HL = hex('#FFF6DE'), RL = hex('#E0231B'), AM = hex('#FF9A1F');
  const w = S.W;

  // Aerodynamic curved bumper contours for road cars
  const frontCurveR = (x, hw) => -0.16 * Math.cos(clamp(x / hw, -1, 1) * Math.PI * 0.5);
  const rearCurveR = (x, hw) => 0.14 * Math.cos(clamp(x / hw, -1, 1) * Math.PI * 0.5);

  const st = [
    { z: -L2, w: w * 0.90, tw: w * 0.80, y0: S.sill + 0.05, y1: S.noseH - 0.05, r: S.r * 1.35, dz: x => frontCurveR(x, w * 0.45), capDome: 0.06 },
    { z: -L2 + 0.16, w: w * 0.98, tw: w * 0.88, y0: S.sill, y1: S.noseH, r: S.r * 1.35, dz: x => frontCurveR(x, w * 0.49) * 0.55 },
    { z: S.hood - 0.5, w, tw: w * 0.92, y0: S.sill, y1: lerp(S.noseH, S.belt, 0.7), r: S.r * 1.35 },
    { z: S.hood, w, tw: w * 0.92, y0: S.sill, y1: S.belt, r: S.r * 1.35 },
    { z: (S.hood + S.rb) / 2, w: w * 1.01, tw: w * 0.92, y0: S.sill, y1: S.belt + 0.02, r: S.r * 1.35 },
    { z: S.rb, w: w * 0.99, tw: w * 0.92, y0: S.sill, y1: S.belt + 0.03, r: S.r * 1.35 },
    { z: L2 - 0.16, w: w * 0.98, tw: w * 0.88, y0: S.sill, y1: S.tailH, r: S.r * 1.35, dz: x => rearCurveR(x, w * 0.49) * 0.55 },
    { z: L2, w: w * 0.90, tw: w * 0.80, y0: S.sill + 0.06, y1: S.tailH - 0.05, r: S.r * 1.35, dz: x => rearCurveR(x, w * 0.45), capDome: 0.05 }
  ];
  if (S.rb > L2 - 0.3) st.splice(5, 1);
  G.loft(st, col, 4, 0, { n: 7, deg: 68 });

  const gw = w * 0.9, gtw = w * (kind === 'suv' ? 0.78 : 0.7), yb = S.belt + 0.01;
  const cab = [
    { z: S.hood + 0.02, w: gw, tw: gw * 0.97, y0: yb - 0.04, y1: yb + 0.03, r: 0.14 },
    { z: lerp(S.hood, S.ws, 0.55), w: gw, tw: lerp(gw, gtw, 0.6), y0: yb - 0.04, y1: lerp(yb, S.roof, 0.62), r: 0.22 },
    { z: S.ws, w: gw, tw: gtw, y0: yb - 0.04, y1: S.roof, r: 0.26 },
    { z: S.rw, w: gw, tw: gtw, y0: yb - 0.04, y1: S.roof, r: 0.26 },
    { z: lerp(S.rw, S.rb, 0.5), w: gw, tw: lerp(gtw, gw, 0.4), y0: yb - 0.04, y1: lerp(S.roof, yb, kind === 'hatch' || kind === 'suv' ? 0.35 : 0.5), r: 0.22 },
    { z: S.rb, w: gw, tw: gw * 0.96, y0: yb - 0.04, y1: yb + 0.03, r: 0.14 }
  ];
  G.loft(cab, GL, 6, 0, { n: 7, deg: 68 });

  // Interior Cockpit & Seated NPCs (Driver & Passengers)
  const isTaxi = (kind === 'amb' && paint === PAINTS.taxi);
  const drvX = w * 0.22; // Right-hand drive in India
  // Dashboard & steering wheel
  G.box(0, S.belt - 0.04, S.hood + 0.22, w * 0.82, 0.16, 0.32, BK, 5);
  G.ringX(drvX, S.belt + 0.06, S.ws + 0.06, 0.12, 0.15, 14, BK, 5);
  // Seats
  G.box(drvX, S.sill + 0.16, S.ws + 0.38, 0.38, 0.14, 0.42, hex('#20232a'), 5);
  G.box(-drvX, S.sill + 0.16, S.ws + 0.38, 0.38, 0.14, 0.42, hex('#20232a'), 5);
  G.box(0, S.sill + 0.18, S.rw - 0.15, w * 0.76, 0.14, 0.40, hex('#20232a'), 5);
  // Driver NPC
  const drvShirt = isTaxi ? hex('#9c7a48') : (kind === 'neon' ? hex('#00F0FF') : hex('#3b82f6'));
  addSeatedHuman(G, drvX, S.sill + 0.18, S.ws + 0.38, drvShirt, hex('#8d5e3e'), hex('#121212'), true, drvX);
  // Passenger in rear of Taxi or front of SUV
  if (isTaxi) {
    addSeatedHuman(G, -w * 0.20, S.sill + 0.20, S.rw - 0.15, hex('#10B981'), hex('#926242'), hex('#141210'), false);
  } else if (kind === 'suv') {
    addSeatedHuman(G, -drvX, S.sill + 0.18, S.ws + 0.38, hex('#EC4899'), hex('#926242'), hex('#121212'), false);
  }

  const rt = gtw * 0.97;
  G.loft([
    { z: S.ws + 0.1, w: rt, y0: S.roof - 0.04, y1: S.roof + 0.018, r: 0.08 },
    { z: (S.ws + S.rw) / 2, w: rt + 0.02, y0: S.roof - 0.04, y1: S.roof + 0.028, r: 0.10 },
    { z: S.rw - 0.08, w: rt, y0: S.roof - 0.04, y1: S.roof + 0.018, r: 0.08 }
  ], S.neon ? hex('#101320') : col, 4, 0, { n: 4, deg: 40 });

  if (S.rails) for (const s of [-1, 1]) G.box(s * rt * 0.42, S.roof + 0.07, (S.ws + S.rw) / 2, 0.05, 0.05, S.rw - S.ws - 0.1, BK, 5);
  const side = z => loftSideX(st, z, (S.sill + S.belt) / 2) + 0.006;
  for (const s of [-1, 1]) {
    const bz = lerp(S.ws, S.rw, kind === 'hatch' ? 0.55 : 0.5); G.box(s * (gw * 0.5 * lerp(1, gtw / gw, 0.5) + 0.002), lerp(yb, S.roof, 0.5), bz, 0.02, S.roof - yb - 0.05, 0.12, BK, 12);
    for (const z of [S.hood + 0.1, bz, kind === 'hatch' ? null : S.rb - 0.12]) if (z != null) G.beam([s * side(z), S.sill + 0.12, z], [s * side(z), S.belt - 0.04, z], 0.006, BK, 12, 0, 0.012);
    for (const z of [bz - 0.35, bz + 0.62]) if (z < S.rb) G.box(s * (side(z) + 0.01), S.belt - 0.14, z, 0.02, 0.04, 0.16, S.chrome ? CH : hex('#2a2b2f'), S.chrome ? 11 : 5);
    G.loft([{ z: S.hood + 0.14, cx: s * (w / 2 + 0.02), w: 0.08, y0: S.belt + 0.02, y1: S.belt + 0.14, r: 0.04 }, { z: S.hood + 0.3, cx: s * (w / 2 + 0.07), w: 0.16, y0: S.belt + 0.0, y1: S.belt + 0.16, r: 0.06 }], S.chrome ? CH : BK, S.chrome ? 11 : 5, 0, { n: 3 });
    for (const z of S.wz) {
      G.ringX(s * (side(z) + 0.004), S.wr, z, S.wr + 0.01, S.wr + 0.07, 14, BK, 12, 0, -Math.PI / 2, Math.PI / 2, -s);
      addTyre(G, s * (w / 2 - 0.1), S.wr, z, S.wr, 0.2, s, S.chrome ? { spokes: 0, disc: hex('#d5d8dc'), lip: CH } : kind === 'suv' ? { spokes: 6, spoke: hex('#9ea3a9'), spokeMat: 5 } : { spokes: 5 });
    }
    const hy = lerp(S.sill, S.noseH, 0.72), ty = lerp(S.sill, S.tailH, 0.72);
    const zfHead = -L2 + frontCurveR(s * w * 0.33, w * 0.45);
    const zrTail = L2 + rearCurveR(s * w * 0.37, w * 0.45);
    if (S.chrome) {
      G.T = M4.model(s * w * 0.34, hy, zfHead - 0.01, 0, Math.PI / 2, 0);
      G.prism(0, 0, 0, 0.12, 0.12, 0.05, 14, CH, 11);
      G.prism(0, 0.05, 0, 0.1, 0.09, 0.02, 14, HL, 1, 1.9);
      G.T = null;
    } else if (S.neon) {
      G.box(s * w * 0.3, hy + 0.03, zfHead + 0.02, w * 0.3, 0.03, 0.03, hex('#CFF6FF'), 1, 2.6);
    } else {
      G.box(s * w * 0.33, hy, zfHead + 0.03, w * 0.26, 0.12, 0.06, BK, 12);
      G.box(s * w * 0.33, hy, zfHead, w * 0.22, 0.08, 0.02, HL, 1, 1.7);
      G.box(s * w * 0.46, hy - 0.08, zfHead + 0.02, 0.1, 0.035, 0.03, AM, 1, 1.2);
    }
    G.box(s * w * (S.neon ? 0.28 : 0.37), ty, zrTail, w * (S.neon ? 0.34 : 0.18), S.neon ? 0.03 : 0.12, 0.03, RL, 1, S.neon ? 3 : 2.2);
  }
  const gy = lerp(S.sill, S.noseH, 0.55);
  const zfBumper = -L2 + frontCurveR(0, w * 0.45);
  const zrBumper = L2 + rearCurveR(0, w * 0.45);
  if (S.chrome) {
    G.box(0, gy, zfBumper - 0.01, w * 0.42, S.noseH * 0.28, 0.03, CH, 11);
    for (let i = 0; i < 6; i++) G.box(0, gy - S.noseH * 0.11 + i * S.noseH * 0.045, zfBumper - 0.03, w * 0.4, 0.012, 0.012, hex('#2b2c30'), 5);
    G.box(0, S.sill + 0.08, zfBumper - 0.05, w * 1.02, 0.1, 0.1, CH, 11);
    G.box(0, S.sill + 0.08, zrBumper + 0.05, w * 1.02, 0.1, 0.1, CH, 11);
  } else if (!S.neon) {
    G.box(0, gy, zfBumper + 0.005, w * 0.46, S.noseH * 0.2, 0.03, BK, 5);
    G.box(0, S.sill + 0.1, zfBumper - 0.02, w * 0.98, 0.16, 0.08, hex('#1d1e21'), 12);
    G.box(0, S.sill + 0.12, zrBumper + 0.02, w * 0.98, 0.18, 0.08, hex('#1d1e21'), 12);
  }
  const plate = isTaxi ? hex('#F2C230') : hex('#F2F2EE');
  G.box(0, S.sill + 0.24, zfBumper - 0.05, 0.52, 0.12, 0.012, plate, 0);
  G.box(0, lerp(S.sill, S.tailH, 0.45), zrBumper + 0.05, 0.52, 0.12, 0.012, plate, 0);
  if (isTaxi) {
    G.box(0, S.roof + 0.1, (S.ws + S.rw) / 2, 0.5, 0.14, 0.16, hex('#F2F2EE'), 1, 0.6);
    G.box(0, S.sill + 0.32, 0, w * 1.005, 0.08, S.L * 0.8, hex('#1B1C20'), 4);
  }
  if (S.neon) {
    G.box(0, 0.1, 0, w * 0.9, 0.02, S.L * 0.85, hex('#61F1F6'), 1, 2.2);
    for (const s of [-1, 1]) G.box(s * (w / 2 + 0.005), S.belt - 0.05, 0.2, 0.012, 0.02, S.L * 0.7, hex('#61F1F6'), 1, 2.4);
  }
  return G;
}

// ---------- AUTO RICKSHAW ----------
function buildAuto() {
  const G = new Geo(), GR = hex('#2E7D32'), YE = hex('#F2C230'), BK = hex('#141414'), CH = hex('#c9ced3');
  // Lower body (classic green)
  G.loft([{ z: -1.25, w: 0.5, y0: 0.35, y1: 0.95, r: 0.12 }, { z: -1.05, w: 0.9, y0: 0.3, y1: 1.02, r: 0.16 }, { z: -0.6, w: 1.28, y0: 0.3, y1: 0.92, r: 0.18 }, { z: 0.9, w: 1.34, y0: 0.3, y1: 0.95, r: 0.16 }, { z: 1.3, w: 1.3, y0: 0.34, y1: 0.9, r: 0.12 }], GR, 4, 0, { n: 3 });
  // Upper canopy (classic yellow)
  G.loft([{ z: -0.95, w: 1.2, tw: 1.1, y0: 1.72, y1: 1.8, r: 0.04 }, { z: -0.6, w: 1.34, tw: 1.2, y0: 1.7, y1: 1.9, r: 0.1 }, { z: 0.6, w: 1.36, tw: 1.2, y0: 1.7, y1: 1.93, r: 0.12 }, { z: 1.35, w: 1.34, tw: 1.2, y0: 1.66, y1: 1.86, r: 0.1 }], YE, 4, 0, { n: 3 });
  G.loft([{ z: 1.2, w: 1.3, y0: 0.95, y1: 1.7, r: 0.1 }, { z: 1.36, w: 1.3, y0: 0.95, y1: 1.68, r: 0.1 }], BK, 12, 0, { n: 2 });
  // Pillars & front windshield
  G.beam([-0.5, 1.0, -0.95], [-0.55, 1.72, -0.9], 0.05, BK, 5); G.beam([0.5, 1.0, -0.95], [0.55, 1.72, -0.9], 0.05, BK, 5);
  G.hexa([[-0.5, 1.02, -1.0], [0.5, 1.02, -1.0], [-0.52, 1.7, -0.92], [0.52, 1.7, -0.92], [-0.5, 1.02, -0.97], [0.5, 1.02, -0.97], [-0.52, 1.7, -0.89], [0.52, 1.7, -0.89]], hex('#1c2530'), 6);
  for (const s of [-1, 1]) G.beam([s * 0.64, 0.95, 0.2], [s * 0.66, 1.7, 0.2], 0.05, BK, 5);

  // Steering handlebar column & speedometer dial
  G.beam([0, 0.52, -0.72], [0, 0.88, -0.48], 0.045, CH, 11);
  G.box(0, 0.88, -0.48, 0.52, 0.038, 0.038, BK, 5);
  G.prism(0, 0.91, -0.47, 0.045, 0.045, 0.03, 10, hex('#00F0FF'), 1, 1.5); // Speedo
  // Driver bench seat
  G.box(0, 0.48, -0.15, 0.85, 0.12, 0.38, hex('#28221c'), 5);
  // Auto Driver NPC in Khaki uniform
  addSeatedHuman(G, 0, 0.48, -0.15, hex('#9c7a48'), hex('#8d5e3e'), hex('#121212'), true, 0);

  // Rear passenger cushioned bench & backrest
  G.box(0, 0.54, 0.72, 1.15, 0.14, 0.48, hex('#3a2a1e'), 5);
  G.box(0, 0.85, 0.96, 1.15, 0.48, 0.12, hex('#3a2a1e'), 5);
  // Passenger NPC in rear
  addSeatedHuman(G, 0.28, 0.54, 0.72, hex('#0ea5e9'), hex('#926242'), hex('#141210'), false);

  // Classic chrome mirrors & meter
  for (const s of [-1, 1]) G.beam([s * 0.52, 1.25, -0.94], [s * 0.68, 1.35, -1.02], 0.02, CH, 11);
  G.box(0.55, 1.15, -0.85, 0.08, 0.12, 0.08, BK, 5); // Fare meter
  G.box(0.55, 1.15, -0.89, 0.06, 0.08, 0.01, hex('#FBBF24'), 1, 1.6); // Meter display

  // Front headlight & rear lamps
  G.T = M4.model(0, 0.98, -1.27, 0, Math.PI / 2, 0); G.prism(0, 0, 0, 0.09, 0.09, 0.06, 12, CH, 11); G.prism(0, 0.06, 0, 0.075, 0.07, 0.01, 12, hex('#FFF6DE'), 1, 1.8); G.T = null;
  for (const s of [-1, 1]) G.box(s * 0.5, 0.72, 1.31, 0.14, 0.08, 0.02, hex('#E0231B'), 1, 2.2);
  G.box(0, 0.5, 1.31, 0.36, 0.1, 0.012, hex('#F2C230'));
  addTyre(G, 0, 0.26, -1.0, 0.26, 0.14, 1, { spokes: 0, disc: hex('#8a8f95') });
  for (const s of [-1, 1]) addTyre(G, s * 0.6, 0.26, 0.95, 0.26, 0.14, s, { spokes: 0, disc: hex('#8a8f95') });
  return G;
}

// ---------- REALISTIC CITY PUBLIC BUS ----------
function buildBus() {
  const G = new Geo(), RD = hex('#9B1C1C'), CR = hex('#F3EFE6'), GL = hex('#121b24'), BK = hex('#111315'), CH = hex('#c9ced3');
  // Lower body chassis (Deep Indian bus red)
  G.loft([{ z: -5.55, w: 2.45, y0: 0.35, y1: 1.35, r: 0.14 }, { z: -5.35, w: 2.52, y0: 0.32, y1: 1.36, r: 0.16 }, { z: 5.35, w: 2.52, y0: 0.32, y1: 1.36, r: 0.16 }, { z: 5.55, w: 2.45, y0: 0.36, y1: 1.32, r: 0.12 }], RD, 4, 0, { n: 2 });
  // Panoramic window glass
  G.loft([{ z: -5.48, w: 2.46, y0: 1.35, y1: 2.62, r: 0.06 }, { z: 5.48, w: 2.46, y0: 1.35, y1: 2.62, r: 0.06 }], GL, 6, 0, { n: 2 });
  // Upper roof crown (Cream / Off-white)
  G.loft([{ z: -5.55, w: 2.48, y0: 2.58, y1: 3.16, r: 0.22 }, { z: -5.3, w: 2.52, y0: 2.58, y1: 3.22, r: 0.26 }, { z: 5.3, w: 2.52, y0: 2.58, y1: 3.22, r: 0.26 }, { z: 5.55, w: 2.48, y0: 2.58, y1: 3.16, r: 0.22 }], CR, 4, 0, { n: 3 });

  // Window pillars along both sides
  for (let z = -4.3; z <= 5.3; z += 1.3) for (const s of [-1, 1]) G.box(s * 1.235, 1.98, z, 0.035, 1.26, 0.12, CR, 4);
  for (const s of [-1, 1]) G.box(s * 1.265, 0.95, 0, 0.014, 0.12, 10.7, CR, 4); // Waistline stripe

  // Split front windshield with black divider & wipers
  G.box(0, 1.95, -5.50, 0.04, 1.25, 0.04, BK, 12);
  for (const s of [-0.55, 0.55]) G.beam([s, 1.45, -5.51], [s + 0.3, 1.85, -5.49], 0.018, BK, 12);

  // Large illuminated LED Destination Route Board
  G.box(0, 2.82, -5.54, 2.05, 0.34, 0.04, hex('#0c1018'), 5);
  G.box(0, 2.82, -5.56, 1.95, 0.28, 0.01, hex('#F59E0B'), 1, 2.2);

  // Rooftop Dual AC Units & Radiator Vents
  G.box(0, 3.32, -0.8, 1.5, 0.26, 2.6, hex('#d5d7dc'), 5);
  G.box(0, 3.32, 2.2, 1.5, 0.26, 2.6, hex('#d5d7dc'), 5);
  // Rear roof ladder
  for (let y = 0.8; y <= 3.2; y += 0.3) G.box(0.9, y, 5.58, 0.32, 0.02, 0.02, CH, 11);

  // INTERIOR: Passenger seats, grab poles, and SEATED NPCS
  // Center aisle floor
  G.box(0, 0.72, 0, 2.38, 0.08, 10.4, hex('#2d3139'), 5);
  // Vertical grab poles in aisle
  for (let z = -3.2; z <= 4.2; z += 1.4) G.beam([0, 0.72, z], [0, 2.58, z], 0.03, CH, 11);

  // Bus Driver Cabin
  const drvX = 0.65;
  G.box(drvX, 0.82, -4.5, 0.48, 0.16, 0.48, hex('#20242e'), 5);
  G.box(drvX, 1.10, -4.26, 0.44, 0.42, 0.12, hex('#20242e'), 5);
  // Large angled bus steering wheel
  G.beam([drvX, 0.95, -4.75], [drvX, 1.25, -4.55], 0.05, BK, 5);
  G.ringX(drvX, 1.25, -4.55, 0.18, 0.23, 16, BK, 5);
  // Bus Driver NPC
  addSeatedHuman(G, drvX, 0.82, -4.48, hex('#1E40AF'), hex('#8d5e3e'), hex('#121212'), true, drvX);

  // Passenger seats & Passenger NPCs along windows
  const passRows = [-3.0, -1.6, 0.2, 1.8, 3.4];
  passRows.forEach((pz, ri) => {
    // Twin seat blocks
    for (const sx of [-0.75, 0.75]) {
      G.box(sx, 0.92, pz, 0.64, 0.14, 0.44, hex('#1e3a5f'), 5);
      G.box(sx, 1.24, pz + 0.18, 0.62, 0.48, 0.10, hex('#1e3a5f'), 5);
    }
    // Place passenger NPCs in alternating seats
    const pCol = [hex('#D97706'), hex('#059669'), hex('#7C3AED'), hex('#DC2626'), hex('#2563EB')][ri % 5];
    const pSide = ri % 2 === 0 ? -0.75 : 0.75;
    addSeatedHuman(G, pSide, 0.92, pz, pCol, hex('#926242'), hex('#141210'), false);
  });

  // Passenger Entry & Exit Bi-Fold Doors (Left side)
  G.box(-1.24, 1.45, -3.4, 0.04, 1.95, 1.15, hex('#222832'), 5);
  G.box(-1.24, 1.45, 2.4, 0.04, 1.95, 1.15, hex('#222832'), 5);

  // Front bumper, grille, and headlights
  G.box(0, 0.52, -5.58, 2.45, 0.24, 0.12, BK, 12);
  G.box(0, 0.88, -5.55, 1.5, 0.32, 0.04, BK, 5);
  for (let i = 0; i < 4; i++) G.box(0, 0.78 + i * 0.07, -5.57, 1.4, 0.016, 0.02, CH, 11); // Grille slats
  for (const s of [-1, 1]) {
    G.box(s * 0.96, 0.76, -5.55, 0.28, 0.16, 0.04, hex('#FFF6DE'), 1, 2.0); // Headlights
    G.box(s * 1.12, 0.76, -5.55, 0.08, 0.14, 0.04, hex('#FFA500'), 1, 1.5); // Turn signal
    G.box(s * 1.02, 0.90, 5.55, 0.20, 0.32, 0.04, hex('#DC2626'), 1, 2.2); // Tail lights
  }
  G.box(0, 0.42, -5.64, 0.6, 0.14, 0.02, hex('#F2C230'), 0); // Front license plate
  G.box(0, 0.55, 5.56, 0.6, 0.14, 0.02, hex('#F2C230'), 0); // Rear license plate

  for (const s of [-1, 1]) for (const z of [-3.6, 3.4]) addTyre(G, s * 1.04, 0.52, z, 0.52, 0.32, s, { spokes: 0, disc: hex('#9aa0a6') });
  return G;
}

// ---------- ICONIC INDIAN HIGHWAY TRUCK (TATA / ASHOK LEYLAND) ----------
function buildTruck() {
  const G = new Geo(), OR = hex('#D97706'), YE = hex('#F59E0B'), BL = hex('#1D4ED8'), BK = hex('#121417'), WD = hex('#7c4a24'), CH = hex('#d1d5db');
  // High-slung driver cab
  G.loft([{ z: -4.3, w: 2.25, tw: 2.05, y0: 0.92, y1: 2.95, r: 0.18 }, { z: -4.08, w: 2.38, tw: 2.16, y0: 0.88, y1: 3.05, r: 0.22 }, { z: -2.45, w: 2.38, tw: 2.2, y0: 0.88, y1: 3.05, r: 0.2 }], OR, 4, 0, { n: 3 });

  // Iconic wooden canopy crown ("King of the Road") with carved scalloped crown
  G.box(0, 3.16, -3.3, 2.15, 0.24, 1.5, YE, 4);
  G.box(0, 3.32, -3.8, 1.6, 0.14, 0.5, hex('#DC2626'), 4);
  // Windshield sun-visor brow overhang with decorative folk art
  G.box(0, 2.82, -4.32, 2.2, 0.16, 0.28, hex('#047857'), 4);
  for (let i = 0; i < 5; i++) G.box(-0.8 + i * 0.4, 2.82, -4.36, 0.18, 0.12, 0.02, [BL, YE, hex('#DC2626'), YE, BL][i], 4);

  // Split front windshield
  G.box(0, 2.30, -4.28, 1.95, 0.78, 0.04, hex('#15202b'), 6);
  G.box(0, 2.30, -4.30, 0.04, 0.78, 0.02, BK, 12);

  // Extended heavy tubular steel bull-bar / crash guard
  G.box(0, 0.88, -4.48, 2.25, 0.12, 0.08, BK, 5);
  for (const s of [-0.95, 0.95]) G.beam([s, 0.5, -4.46], [s, 1.6, -4.42], 0.06, CH, 11);
  G.beam([-0.95, 1.55, -4.42], [0.95, 1.55, -4.42], 0.06, CH, 11);
  for (const s of [-0.4, 0.4]) G.prism(s, 0.55, -4.49, 0.05, 0.05, 0.08, 8, hex('#DC2626'), 4); // Red tow hooks

  // Front radiator grille & round headlights with mesh guard
  G.box(0, 1.35, -4.30, 2.15, 0.52, 0.05, YE, 4);
  for (let i = 0; i < 5; i++) G.box(-0.8 + i * 0.4, 1.35, -4.33, 0.2, 0.38, 0.02, [BL, hex('#C0272D'), hex('#2E7D32'), hex('#7C3AED'), BL][i], 4);
  for (const s of [-1, 1]) {
    G.prism(s * 0.88, 1.25, -4.33, 0.14, 0.14, 0.06, 12, CH, 11);
    G.prism(s * 0.88, 1.25, -4.35, 0.11, 0.11, 0.02, 12, hex('#FFF6DE'), 1, 2.2);
  }

  // Chrome air horn trumpet on cab roof
  G.prism(0.85, 3.12, -3.8, 0.05, 0.09, 0.42, 10, CH, 11);

  // Vertical chrome exhaust stack pipe rising behind driver cab
  G.prism(-1.12, 1.2, -2.2, 0.06, 0.06, 2.2, 12, CH, 11);
  G.prism(-1.12, 3.4, -2.2, 0.055, 0.085, 0.16, 12, CH, 11); // Curved exhaust tip

  // CAB INTERIOR & NPCS: TRUCK DRIVER & HELPER
  const drvX = 0.65;
  // Dashboard & big upright truck steering wheel
  G.box(0, 1.75, -3.8, 2.05, 0.18, 0.35, BK, 5);
  G.beam([drvX, 1.65, -3.7], [drvX, 1.95, -3.5], 0.05, BK, 5);
  G.ringX(drvX, 1.95, -3.5, 0.20, 0.25, 16, BK, 5);
  // Driver Seat & Truck Driver NPC
  G.box(drvX, 1.35, -3.2, 0.5, 0.18, 0.5, hex('#28221c'), 5);
  addSeatedHuman(G, drvX, 1.35, -3.2, hex('#EA580C'), hex('#8d5e3e'), hex('#121212'), true, drvX);
  // Helper / Cleaner NPC in passenger seat
  G.box(-drvX, 1.35, -3.2, 0.5, 0.18, 0.5, hex('#28221c'), 5);
  addSeatedHuman(G, -drvX, 1.35, -3.2, hex('#2563EB'), hex('#926242'), hex('#141210'), false);

  // Heavy steel frame chassis
  G.box(0, 1.1, 1.2, 2.48, 0.35, 7.2, BK, 5);

  // Timber cargo bed with reinforced steel upright ribs
  for (const s of [-1, 1]) {
    G.box(s * 1.22, 2.1, 1.2, 0.08, 1.7, 7.2, WD);
    for (let i = 0; i < 4; i++) G.box(s * 1.265, 1.5 + i * 0.4, 1.2, 0.02, 0.16, 7.2, [YE, hex('#C0272D'), BL, hex('#2E7D32')][i], 4);
  }
  G.box(0, 2.1, -2.3, 2.44, 1.7, 0.08, WD);

  // High-heaped cargo covered in realistic strapped canvas tarpaulin
  G.box(0, 2.45, 1.2, 2.32, 1.8, 6.8, hex('#3B5335'), 0); // Green canvas
  // Criss-cross rope lashings over canvas
  for (let z = -1.8; z <= 4.2; z += 1.0) {
    G.beam([-1.24, 1.3, z], [0, 3.36, z], 0.02, hex('#D4B996'));
    G.beam([1.24, 1.3, z], [0, 3.36, z], 0.02, hex('#D4B996'));
  }

  for (const s of [-1, 1]) {
    G.box(s * 0.96, 0.76, -5.55, 0.28, 0.16, 0.04, hex('#FFF6DE'), 1, 2.0); // Headlights
    G.box(s * 1.12, 0.76, -5.55, 0.08, 0.14, 0.04, hex('#FFA500'), 1, 1.5); // Turn signal
    G.box(s * 1.02, 0.90, 5.55, 0.20, 0.32, 0.04, hex('#DC2626'), 1, 2.2); // Tail lights
  }
  G.box(0, 0.42, -5.64, 0.6, 0.14, 0.02, hex('#F2C230'), 0); // Front license plate
  G.box(0, 0.55, 5.56, 0.6, 0.14, 0.02, hex('#F2C230'), 0); // Rear license plate

  for (const s of [-1, 1]) for (const z of [-3.6, 3.4]) addTyre(G, s * 1.04, 0.52, z, 0.52, 0.32, s, { spokes: 0, disc: hex('#9aa0a6') });
  return G;
}

// ---------- ICONIC INDIAN HIGHWAY TRUCK (TATA / ASHOK LEYLAND) ----------
function buildTruck() {
  const G = new Geo(), OR = hex('#D97706'), YE = hex('#F59E0B'), BL = hex('#1D4ED8'), BK = hex('#121417'), WD = hex('#7c4a24'), CH = hex('#d1d5db');
  // Aerodynamic truck cab front curvature
  const frontCurveTruck = (x, hw) => -0.15 * Math.cos(clamp(x / hw, -1, 1) * Math.PI * 0.5);

  // High-slung driver cab with smooth corner radii and curved front
  G.loft([
    { z: -4.32, w: 2.22, tw: 2.02, y0: 0.92, y1: 2.95, r: 0.32, dz: x => frontCurveTruck(x, 1.11), capDome: 0.08 },
    { z: -4.08, w: 2.38, tw: 2.16, y0: 0.88, y1: 3.05, r: 0.36 },
    { z: -2.45, w: 2.38, tw: 2.20, y0: 0.88, y1: 3.05, r: 0.32 }
  ], OR, 4, 0, { n: 6, deg: 66 });

  // Iconic wooden canopy crown ("King of the Road") with carved scalloped crown
  G.box(0, 3.16, -3.3, 2.15, 0.24, 1.5, YE, 4);
  G.box(0, 3.32, -3.8, 1.6, 0.14, 0.5, hex('#DC2626'), 4);
  // Windshield sun-visor brow overhang with decorative folk art
  G.box(0, 2.82, -4.32, 2.2, 0.16, 0.28, hex('#047857'), 4);
  for (let i = 0; i < 5; i++) G.box(-0.8 + i * 0.4, 2.82, -4.36, 0.18, 0.12, 0.02, [BL, YE, hex('#DC2626'), YE, BL][i], 4);

  // Split front windshield
  G.box(0, 2.30, -4.28, 1.95, 0.78, 0.04, hex('#15202b'), 6);
  G.box(0, 2.30, -4.30, 0.04, 0.78, 0.02, BK, 12);

  // Extended heavy tubular steel bull-bar / crash guard
  G.box(0, 0.88, -4.48, 2.25, 0.12, 0.08, BK, 5);
  for (const s of [-0.95, 0.95]) G.beam([s, 0.5, -4.46], [s, 1.6, -4.42], 0.06, CH, 11);
  G.beam([-0.95, 1.55, -4.42], [0.95, 1.55, -4.42], 0.06, CH, 11);
  for (const s of [-0.4, 0.4]) G.prism(s, 0.55, -4.49, 0.05, 0.05, 0.08, 8, hex('#DC2626'), 4); // Red tow hooks

  // Front radiator grille & round headlights with mesh guard
  G.box(0, 1.35, -4.30, 2.15, 0.52, 0.05, YE, 4);
  for (let i = 0; i < 5; i++) G.box(-0.8 + i * 0.4, 1.35, -4.33, 0.2, 0.38, 0.02, [BL, hex('#C0272D'), hex('#2E7D32'), hex('#7C3AED'), BL][i], 4);
  for (const s of [-1, 1]) {
    G.prism(s * 0.88, 1.25, -4.33, 0.14, 0.14, 0.06, 12, CH, 11);
    G.prism(s * 0.88, 1.25, -4.35, 0.11, 0.11, 0.02, 12, hex('#FFF6DE'), 1, 2.2);
  }

  // Chrome air horn trumpet on cab roof
  G.prism(0.85, 3.12, -3.8, 0.05, 0.09, 0.42, 10, CH, 11);

  // Vertical chrome exhaust stack pipe rising behind driver cab
  G.prism(-1.12, 1.2, -2.2, 0.06, 0.06, 2.2, 12, CH, 11);
  G.prism(-1.12, 3.4, -2.2, 0.055, 0.085, 0.16, 12, CH, 11); // Curved exhaust tip

  // CAB INTERIOR & NPCS: TRUCK DRIVER & HELPER
  const drvX = 0.65;
  // Dashboard & big upright truck steering wheel
  G.box(0, 1.75, -3.8, 2.05, 0.18, 0.35, BK, 5);
  G.beam([drvX, 1.65, -3.7], [drvX, 1.95, -3.5], 0.05, BK, 5);
  G.ringX(drvX, 1.95, -3.5, 0.20, 0.25, 16, BK, 5);
  // Driver Seat & Truck Driver NPC
  G.box(drvX, 1.35, -3.2, 0.5, 0.18, 0.5, hex('#28221c'), 5);
  addSeatedHuman(G, drvX, 1.35, -3.2, hex('#EA580C'), hex('#8d5e3e'), hex('#121212'), true, drvX);
  // Helper / Cleaner NPC in passenger seat
  G.box(-drvX, 1.35, -3.2, 0.5, 0.18, 0.5, hex('#28221c'), 5);
  addSeatedHuman(G, -drvX, 1.35, -3.2, hex('#2563EB'), hex('#926242'), hex('#141210'), false);

  // Heavy steel frame chassis
  G.box(0, 1.1, 1.2, 2.48, 0.35, 7.2, BK, 5);

  // Timber cargo bed with reinforced steel upright ribs
  for (const s of [-1, 1]) {
    G.box(s * 1.22, 2.1, 1.2, 0.08, 1.7, 7.2, WD);
    for (let i = 0; i < 4; i++) G.box(s * 1.265, 1.5 + i * 0.4, 1.2, 0.02, 0.16, 7.2, [YE, hex('#C0272D'), BL, hex('#2E7D32')][i], 4);
  }
  G.box(0, 2.1, -2.3, 2.44, 1.7, 0.08, WD);

  // High-heaped cargo covered in realistic strapped canvas tarpaulin
  G.box(0, 2.45, 1.2, 2.32, 1.8, 6.8, hex('#3B5335'), 0); // Green canvas
  // Criss-cross rope lashings over canvas
  for (let z = -1.8; z <= 4.2; z += 1.0) {
    G.beam([-1.24, 1.3, z], [0, 3.36, z], 0.02, hex('#D4B996'));
    G.beam([1.24, 1.3, z], [0, 3.36, z], 0.02, hex('#D4B996'));
  }

  // REAR TAILGATE: Iconic Indian Highway Painted Banner ("HORN PLEASE", "OK TATA")
  G.box(0, 2.1, 4.82, 2.44, 1.7, 0.08, WD);
  // Main yellow painted banner board
  G.box(0, 2.1, 4.87, 2.2, 0.65, 0.02, YE, 4);
  G.box(0, 2.3, 4.89, 1.9, 0.18, 0.01, hex('#DC2626'), 4); // "HORN PLEASE" red bar
  G.box(0, 1.9, 4.89, 1.6, 0.18, 0.01, BL, 4); // "OK TATA" blue bar
  // Diagonal yellow/black hazard chevrons on bumper
  for (let i = 0; i < 8; i++) G.box(-0.9 + i * 0.25, 0.72, 4.85, 0.12, 0.18, 0.02, i % 2 === 0 ? YE : BK, 5);

  for (const s of [-1, 1]) {
    G.box(s * 1.05, 1.05, 4.88, 0.18, 0.16, 0.04, hex('#DC2626'), 1, 2.2); // Rear lights
    // Mudflaps with white stripes
    G.box(s * 1.02, 0.35, 4.82, 0.38, 0.36, 0.02, BK, 12);
    G.box(s * 1.02, 0.35, 4.84, 0.32, 0.04, 0.01, hex('#FFFFFF'));
  }

  // 6 heavy-duty truck wheels (twin rear axles)
  for (const s of [-1, 1]) for (const z of [-3.3, 2.4, 3.6]) addTyre(G, s * 1.04, 0.54, z, 0.54, 0.34, s, { spokes: 0, disc: hex('#7d828a') });
  return G;
}

// ---------- RIVER BOAT (FERRY / SHIKARA) ----------
function buildBoat() {
  const G = new Geo(), WD = hex('#7c4a28'), DK = hex('#442514'), GL = hex('#1b2633');
  // Smoothly curved wooden plank hull
  G.loft([{ z: -4.3, w: 0.2, y0: 0.5, y1: 1.15, r: 0.12 }, { z: -3.3, w: 1.75, y0: 0.05, y1: 1.0, r: 0.44 }, { z: 0, w: 2.38, y0: -0.05, y1: 0.95, r: 0.58 }, { z: 3.0, w: 2.05, y0: 0.05, y1: 1.0, r: 0.48 }, { z: 3.8, w: 0.65, y0: 0.45, y1: 1.1, r: 0.24 }], WD, 0, 0, { n: 6, deg: 65 });
  // Floor deck planks
  for (let i = 0; i < 4; i++) G.loft([{ z: -3.1, w: 1.74 + i * 0.01, y0: 0.2 + i * 0.18, y1: 0.24 + i * 0.18, r: 0.02 }, { z: 2.8, w: 2.04, y0: 0.2 + i * 0.18, y1: 0.24 + i * 0.18, r: 0.02 }], DK, 0, 0, { n: 1, caps: false });

  // Fabric shade canopy
  G.loft([{ z: -0.5, w: 1.95, y0: 1.60, y1: 1.76, r: 0.35 }, { z: 2.7, w: 1.95, y0: 1.55, y1: 1.74, r: 0.35 }], hex('#E11D48'), 0, 0, { n: 6, deg: 65 });
  for (const [x, z] of [[-0.82, -0.4], [0.82, -0.4], [-0.82, 2.6], [0.82, 2.6]]) G.box(x, 1.25, z, 0.065, 0.72, 0.065, DK);

  // Stern Boatman NPC holding wooden rudder oar
  addSeatedHuman(G, 0, 0.48, 3.2, hex('#0284C7'), hex('#8d5e3e'), hex('#121212'), true, 0);
  G.beam([0.15, 0.9, 3.1], [0.35, 0.2, 4.4], 0.045, WD); // Rudder tiller oar

  // Passengers seated under canopy
  addSeatedHuman(G, -0.45, 0.38, 0.6, hex('#D97706'), hex('#926242'), hex('#141210'), false);
  addSeatedHuman(G, 0.45, 0.38, 1.6, hex('#10B981'), hex('#8d5e3e'), hex('#141210'), false);

  return G;
}

// ---------- REALISTIC INDIAN RAILWAYS TRAINS (LOCO, COACH, WAGON) ----------
// WAP-7 / WAG-9 Indian Railways High-Power Electric Locomotive
function buildLoco(body, band) {
  const G = new Geo(), B = hex(body), BD = hex(band), GR = hex('#7C8187'), BK = hex('#121212'), GL = hex('#131c24'), CH = hex('#d1d5db');
  // Heavy main steel underframe
  G.box(0, 0.95, 0, 2.92, 0.52, 19.8, BK, 5);

  // Aerodynamic body shell with sloped dual-ended driving cabs
  G.loft([
    { z: -10.3, w: 2.85, tw: 2.45, y0: 1.2, y1: 3.35, r: 0.40, capDome: 0.12 },
    { z: -9.5, w: 3.06, tw: 2.75, y0: 1.2, y1: 3.98, r: 0.50 },
    { z: 9.5, w: 3.06, tw: 2.75, y0: 1.2, y1: 3.98, r: 0.50 },
    { z: 10.3, w: 2.85, tw: 2.45, y0: 1.2, y1: 3.35, r: 0.40, capDome: 0.12 }
  ], B, 4, 0, { n: 6, deg: 66 });

  // Tricolor Indian Railways livery waistband along the sides
  for (const s of [-1, 1]) {
    G.box(s * 1.542, 1.75, 0, 0.02, 0.42, 19.2, BD, 4);
    // Airflow intake louvers along body
    for (let i = 0; i < 9; i++) G.box(s * 1.544, 2.85, -6.5 + i * 1.6, 0.015, 0.65, 1.1, hex('#2d3238'), 5);
  }

  // Dual cab details (Front Cab e = -1 and Rear Cab e = +1)
  for (const e of [-1, 1]) {
    // Sloped cabin windshield with wipers
    G.hexa([
      [-1.12, 2.6, e * 10.22], [1.12, 2.6, e * 10.22], [-1.0, 3.35, e * 10.05], [1.0, 3.35, e * 10.05],
      [-1.12, 2.6, e * 10.24], [1.12, 2.6, e * 10.24], [-1.0, 3.35, e * 10.07], [1.0, 3.35, e * 10.07]
    ], GL, 6);
    G.box(0, 2.95, e * 10.15, 0.04, 0.72, 0.03, BK, 12); // Center divider

    // High-beam sealed-beam twin headlight in nose
    G.box(0, 3.65, e * 9.98, 0.44, 0.22, 0.12, hex('#FFF6DE'), 1, e < 0 ? 2.8 : 0.4);
    for (const s of [-1, 1]) G.box(s * 0.98, 1.78, e * 10.24, 0.22, 0.16, 0.04, e < 0 ? hex('#FFF6DE') : hex('#DC2626'), 1, 2.0);

    // Aerodynamic cowcatcher / cattle guard plow & heavy buffer gear
    G.hexa([
      [-1.35, 0.28, e * 10.45], [1.35, 0.28, e * 10.45], [-0.95, 0.85, e * 10.28], [0.95, 0.85, e * 10.28],
      [-1.35, 0.32, e * 10.48], [1.35, 0.32, e * 10.48], [-0.95, 0.88, e * 10.30], [0.95, 0.88, e * 10.30]
    ], BK, 5);
    // Heavy steel central buffer couplers
    G.box(0, 0.85, e * 10.55, 0.36, 0.24, 0.35, BK, 5);
    for (const s of [-0.85, 0.85]) G.cylX(s, 0.85, e * 10.52, 0.15, 0.18, 12, BK, 5); // Side buffers
  }

  // Co-Co 6-wheel high-adhesion bogies
  for (const bz of [-6.2, 6.2]) {
    G.box(0, 0.62, bz, 2.65, 0.52, 4.4, hex('#1b1c1e'), 5);
    for (const z of [-1.5, 0, 1.5]) {
      for (const s of [-1, 1]) {
        G.cylX(s * 0.82, 0.52, bz + z, 0.52, 0.14, 14, hex('#282a2e'), 11);
        G.prism(s * 0.85, 0.52, bz + z, 0.18, 0.18, 0.04, 10, hex('#9ca3af'), 11); // Axle cap
      }
    }
  }
  return G;
}

// LHB Passenger Coach (Rajdhani Express Red/Grey Livery)
function buildCoach() {
  const G = new Geo(), RD = hex('#991B1B'), GY = hex('#E2E8F0'), GL = hex('#121922'), BK = hex('#141414'), RF = hex('#94A3B8');
  // Heavy underframe chassis
  G.box(0, 1.05, 0, 2.92, 0.42, 23.2, BK, 5);

  // Aerodynamic stainless steel body shell
  G.loft([{ z: -11.75, w: 3.12, tw: 3.02, y0: 1.2, y1: 3.65, r: 0.14 }, { z: 11.75, w: 3.12, tw: 3.02, y0: 1.2, y1: 3.65, r: 0.14 }], RD, 4, 0, { n: 2, deg: 40 });

  // Silver window band along sides
  for (const s of [-1, 1]) {
    G.box(s * 1.562, 2.58, 0, 0.012, 0.92, 23.4, GY, 4);
    // Destination board on side: "NEW DELHI ⇄ SHATRANJ EXPRESS"
    G.box(s * 1.568, 1.85, 0, 0.015, 0.22, 2.8, hex('#FBBF24'), 1, 1.4);
    // Large tinted panoramic passenger windows
    for (let i = 0; i < 11; i++) {
      const z = -8.6 + i * 1.72;
      G.box(s * 1.57, 2.62, z, 0.02, 0.74, 1.30, GL, 6);
    }
    // Passenger entry doors at ends
    for (const z of [-10.7, 10.7]) {
      G.box(s * 1.565, 2.25, z, 0.02, 1.95, 0.92, hex('#7f1d1d'), 4);
      G.box(s * 1.572, 2.75, z, 0.02, 0.42, 0.42, GL, 6);
    }
  }

  // PASSENGER NPCS: Visible sitting at windows inside the train!
  for (let i = 0; i < 6; i++) {
    const z = -7.5 + i * 3.0;
    const pCol = [hex('#2563EB'), hex('#D97706'), hex('#059669'), hex('#DC2626'), hex('#7C3AED'), hex('#0284C7')][i % 6];
    // Seated passengers at windows
    addSeatedHuman(G, -1.20, 2.05, z, pCol, hex('#8d5e3e'), hex('#121212'), false);
    addSeatedHuman(G, 1.20, 2.05, z + 0.8, pCol, hex('#926242'), hex('#141210'), false);
  }

  // Corrugated aerodynamic ribbed roof
  G.loft([{ z: -11.75, w: 3.02, y0: 3.58, y1: 4.02, r: 0.65 }, { z: 11.75, w: 3.02, y0: 3.58, y1: 4.02, r: 0.65 }], RF, 5, 0, { n: 4, deg: 50 });
  // Longitudinal roof ribs
  for (const rx of [-1.1, -0.6, 0, 0.6, 1.1]) G.box(rx, 4.04, 0, 0.04, 0.03, 23.2, hex('#CBD5E1'), 5);

  // Flexible rubber gangway vestibule bellows at coach ends
  for (const e of [-1, 1]) G.box(0, 2.45, e * 11.96, 2.05, 2.45, 0.42, hex('#18181b'), 12);

  // FIAT high-speed bogies with dual secondary coil springs
  for (const bz of [-8.3, 8.3]) {
    G.box(0, 0.62, bz, 2.55, 0.46, 3.4, hex('#1e1f22'), 5);
    for (const z of [-1.25, 1.25]) {
      for (const s of [-1, 1]) G.cylX(s * 0.82, 0.46, bz + z, 0.46, 0.13, 14, hex('#2b2c2f'), 11);
    }
  }
  return G;
}


function buildWagon() {
  const G = new Geo(), RS = hex('#78350F'), BK = hex('#141414'), CO = hex('#0F172A');
  // Chassis
  G.box(0, 1.0, 0, 2.95, 0.38, 10.3, BK, 5);
  // Heavy corrugated steel open gondola box
  G.box(0, 2.25, 0, 3.18, 2.15, 10.5, RS);
  // Reinforced vertical exterior ribs along side panels
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) G.box(s * 1.61, 2.25, -4.6 + i * 1.15, 0.06, 2.15, 0.14, V3.scale(RS, 0.82));

  // Realistic uneven heaped coal / ore mound cargo
  G.box(0, 3.12, 0, 2.96, 0.45, 10.2, CO, 12);
  // Heaped surface mounds
  for (let i = 0; i < 4; i++) {
    const mz = -3.6 + i * 2.4;
    G.prism(0, 3.42, mz, 1.25, 0.28, 1.8, 8, CO, 12);
  }

  // Cast steel heavy-haul 3-piece freight bogies
  for (const bz of [-3.6, 3.6]) {
    G.box(0, 0.62, bz, 2.4, 0.45, 2.6, hex('#1e1f22'), 5);
    for (const z of [-0.9, 0.9]) {
      for (const s of [-1, 1]) G.cylX(s * 0.82, 0.46, bz + z, 0.46, 0.13, 14, hex('#2b2c2f'), 11);
    }
  }
  return G;
}

function buildCrossLamp() { const G = new Geo(); G.prism(0, -0.13, 0, 0.13, 0.13, 0.05, 14, hex('#FF2A1A'), 1, 3.2); return G; }

function buildTrafficLightLens() { const G = new Geo(); G.prism(0, 0, 0, 0.115, 0.115, 0.04, 14, hex('#FFFFFF'), 1, 3.6); return G; }


// ---------- vehicle meshes + traffic ----------
function initVehicleMeshes() {
  MESH.car = geoToMesh(buildVajra()); MESH.wheel = geoToMesh(buildWheel());
  { const L = buildVajraLights(); MESH.car_head = geoToMesh(L.head); MESH.car_tail = geoToMesh(L.tail); MESH.car_rev = geoToMesh(L.rev); MESH.car_indL = geoToMesh(L.indL); MESH.car_indR = geoToMesh(L.indR); MESH.beam = staticFlat(beamVerts(24, 4.2, 18)); }
  const mk = (k, p) => geoToMesh(buildRoadCar(k, p));
  Object.assign(MESH, {
    v_hatch_white: mk('hatch', PAINTS.white), v_hatch_red: mk('hatch', PAINTS.red), v_hatch_silver: mk('hatch', PAINTS.silver),
    v_sedan_silver: mk('sedan', PAINTS.silver), v_sedan_black: mk('sedan', PAINTS.black), v_sedan_blue: mk('sedan', PAINTS.blue), v_sedan_maroon: mk('sedan', PAINTS.maroon),
    v_suv_white: mk('suv', PAINTS.white), v_suv_grey: mk('suv', PAINTS.grey), v_suv_black: mk('suv', PAINTS.black),
    v_amb_taxi: mk('amb', PAINTS.taxi), v_amb_white: mk('amb', PAINTS.white), v_neon: mk('neon', '#1b1f35'),
    v_auto: geoToMesh(buildAuto()), v_bus: geoToMesh(buildBus()), v_truck: geoToMesh(buildTruck()),
    boat: geoToMesh(buildBoat()), loco_red: geoToMesh(buildLoco('#B7312C', '#EDE3CF')), loco_blue: geoToMesh(buildLoco('#1F4E8B', '#E8E4DA')),
    coach: geoToMesh(buildCoach()), wagon: geoToMesh(buildWagon()), crossLamp: geoToMesh(buildCrossLamp()),
    trafficLightLens: geoToMesh(buildTrafficLightLens()),
    nitroFlame: geoToMesh(buildNitroFlame()),
    bird: geoToMesh(buildBird('gull')),
    bird_gull: geoToMesh(buildBird('gull')), birdWingL_gull: geoToMesh(buildBirdWing(-1, 'gull')), birdWingR_gull: geoToMesh(buildBirdWing(1, 'gull')),
    bird_eagle: geoToMesh(buildBird('eagle')), birdWingL_eagle: geoToMesh(buildBirdWing(-1, 'eagle')), birdWingR_eagle: geoToMesh(buildBirdWing(1, 'eagle')),
    bird_parrot: geoToMesh(buildBird('parrot')), birdWingL_parrot: geoToMesh(buildBirdWing(-1, 'parrot')), birdWingR_parrot: geoToMesh(buildBirdWing(1, 'parrot')),
    bird_dove: geoToMesh(buildBird('dove')), birdWingL_dove: geoToMesh(buildBirdWing(-1, 'dove')), birdWingR_dove: geoToMesh(buildBirdWing(1, 'dove')),
    bird_swallow: geoToMesh(buildBird('swallow')), birdWingL_swallow: geoToMesh(buildBirdWing(-1, 'swallow')), birdWingR_swallow: geoToMesh(buildBirdWing(1, 'swallow')),
    // 4 Distinct Majestic Dragon Species (Ice Dragons: Pink/Obsidian & Orange/Jade | Fire Dragons: Crimson/Volcanic & Scarlet/Gold)
    dragon_obsidian: geoToMesh(buildDragon('obsidian')), dragonWingL_obsidian: geoToMesh(buildDragonWing(-1, 'obsidian')), dragonWingR_obsidian: geoToMesh(buildDragonWing(1, 'obsidian')),
    dragon_body_obsidian: geoToMesh(buildDragonBody('obsidian')), dragon_head_obsidian: geoToMesh(buildDragonHead('obsidian')), dragon_tail1_obsidian: geoToMesh(buildDragonTail1('obsidian')), dragon_tail2_obsidian: geoToMesh(buildDragonTail2('obsidian')),

    dragon_volcanic: geoToMesh(buildDragon('volcanic')), dragonWingL_volcanic: geoToMesh(buildDragonWing(-1, 'volcanic')), dragonWingR_volcanic: geoToMesh(buildDragonWing(1, 'volcanic')),
    dragon_body_volcanic: geoToMesh(buildDragonBody('volcanic')), dragon_head_volcanic: geoToMesh(buildDragonHead('volcanic')), dragon_tail1_volcanic: geoToMesh(buildDragonTail1('volcanic')), dragon_tail2_volcanic: geoToMesh(buildDragonTail2('volcanic')),

    dragon_jade: geoToMesh(buildDragon('jade')), dragonWingL_jade: geoToMesh(buildDragonWing(-1, 'jade')), dragonWingR_jade: geoToMesh(buildDragonWing(1, 'jade')),
    dragon_body_jade: geoToMesh(buildDragonBody('jade')), dragon_head_jade: geoToMesh(buildDragonHead('jade')), dragon_tail1_jade: geoToMesh(buildDragonTail1('jade')), dragon_tail2_jade: geoToMesh(buildDragonTail2('jade')),

    dragon_gold: geoToMesh(buildDragon('gold')), dragonWingL_gold: geoToMesh(buildDragonWing(-1, 'gold')), dragonWingR_gold: geoToMesh(buildDragonWing(1, 'gold')),
    dragon_body_gold: geoToMesh(buildDragonBody('gold')), dragon_head_gold: geoToMesh(buildDragonHead('gold')), dragon_tail1_gold: geoToMesh(buildDragonTail1('gold')), dragon_tail2_gold: geoToMesh(buildDragonTail2('gold')),

    serpentHead: geoToMesh(buildSerpentHead()), serpentBody: geoToMesh(buildSerpentBody()), serpentTail: geoToMesh(buildSerpentTail()),
    serpentFlipperL: geoToMesh(buildSerpentFlipper(-1)), serpentFlipperR: geoToMesh(buildSerpentFlipper(1))
  });

  // Fast zero-cost mesh aliases for dragon variants (saves loading time and GPU memory)
  const aliasDragon = (src, dst) => {
    MESH[`dragon_${dst}`] = MESH[`dragon_${src}`];
    MESH[`dragon_body_${dst}`] = MESH[`dragon_body_${src}`];
    MESH[`dragon_head_${dst}`] = MESH[`dragon_head_${src}`];
    MESH[`dragon_tail1_${dst}`] = MESH[`dragon_tail1_${src}`];
    MESH[`dragon_tail2_${dst}`] = MESH[`dragon_tail2_${src}`];
    MESH[`dragonWingL_${dst}`] = MESH[`dragonWingL_${src}`];
    MESH[`dragonWingR_${dst}`] = MESH[`dragonWingR_${src}`];
  };
  aliasDragon('obsidian', 'darkblue');
  aliasDragon('jade', 'sapphire');
  aliasDragon('obsidian', 'pink');
  aliasDragon('jade', 'orange');
  aliasDragon('volcanic', 'crimson');
  aliasDragon('volcanic', 'red');
  aliasDragon('obsidian', '');
  MESH.dragon = MESH.dragon_obsidian;
  MESH.dragon_body = MESH.dragon_body_obsidian;
  MESH.dragon_head = MESH.dragon_head_obsidian;
  MESH.dragon_tail1 = MESH.dragon_tail1_obsidian;
  MESH.dragon_tail2 = MESH.dragon_tail2_obsidian;
  MESH.dragonWingL = MESH.dragonWingL_obsidian;
  MESH.dragonWingR = MESH.dragonWingR_obsidian;
}
const VDIM = { hatch: [3.9, 1.72], sedan: [4.5, 1.76], suv: [4.55, 1.9], amb: [4.4, 1.7], neon: [4.5, 1.86], auto: [2.65, 1.36], bus: [11.1, 2.5], truck: [8.6, 2.44] };
function pickVehicle(li, i, rng) {
  const r = rng();
  const pool = li === 0 ? ['sedan', 'suv', 'hatch', 'bus', 'suv', 'truck', 'sedan'] : li === 1 ? ['hatch', 'amb', 'auto', 'sedan', 'amb', 'hatch'] : li === 2 ? ['auto', 'amb', 'auto', 'hatch'] : li === 3 ? ['sedan', 'suv', 'hatch'] : ['truck', 'bus', 'suv', 'sedan'];
  const kind = pool[Math.floor(r * pool.length)];
  const paints = { hatch: ['white', 'red', 'silver'], sedan: ['silver', 'black', 'blue', 'maroon'], suv: ['white', 'grey', 'black'], amb: ['taxi', 'taxi', 'white'] }[kind];
  const mesh = paints ? `v_${kind}_${paints[Math.floor(rng() * paints.length)]}` : 'v_' + kind;
  return { kind, mesh };
}
function initTraffic(rng) {
  W.traffic.forEach((lp, li) => {
    const dirs = lp.oneWay ? [1] : (li === 0 || li === 1 || li === 4) ? [1, -1] : [1];
    for (const dir of dirs) {
      const pts = dir > 0 ? lp.pts : lp.pts.slice().reverse();
      const path = offsetLoop(pts, true, lp.neon ? 2.5 : 3);
      const count = lp.neon ? 5 : li === 4 ? 3 : Math.max(2, Math.round(path.L / 150));
      for (let i = 0; i < count; i++) {
        const v = lp.neon ? { kind: 'neon', mesh: 'v_neon' } : pickVehicle(lp.pool ?? li, i, rng);
        const big = v.kind === 'bus' || v.kind === 'truck';
        const cruise = lp.neon ? 16 : v.kind === 'auto' ? 7.5 : big ? 8.5 : 10 + rng() * 3;
        const s = (path.L * (i + 0.5) / count) % path.L;
        const p = samplePath(path, s);
        TRAFFIC.push({
          path, s, v: cruise * 0.85, cruise,
          kind: v.kind, mesh: v.mesh,
          len: VDIM[v.kind][0], wid: VDIM[v.kind][1],
          y: lp.y || 0, x: p[0], z: p[1],
          yaw: p[2], byaw: p[2], brake: 0,
          hit: false, kx: 0, kz: 0, kyaw: 0, kvx: 0, kvz: 0, kr: 0
        });
      }
    }
  });
  W.pedSpots.forEach((s, i) => {
    const isObj = s && typeof s === 'object' && !Array.isArray(s);
    const x = isObj ? s.x : s[0], z = isObj ? s.z : s[1];
    const role = isObj && s.role ? s.role : (i % 3 === 0 ? 'walking' : (i % 3 === 1 ? 'talking' : 'working'));
    const arch = isObj && s.arch !== undefined ? s.arch : (i % 6);
    const ped = {
      bx: x, bz: z, x, z, ox: 0, oz: 0,
      yaw: isObj && s.yaw !== undefined ? s.yaw : rng() * 6.28,
      v: arch,
      ph: rng() * 10,
      wander: (rng() - 0.5) * 6,
      role,
      alert: 0,
      moving: false,
      speed: isObj && s.speed ? s.speed : (1.0 + rng() * 0.35),
      walkPhase: rng() * 10,
      talkPhase: rng() * 10,
      workPhase: rng() * 10,
      talkTimer: 2 + rng() * 4,
      isTalking: isObj && s.isTalking !== undefined ? s.isTalking : (rng() < 0.5),
      dir: rng() < 0.5 ? 1 : -1,
      prog: rng()
    };
    if (role === 'walking') {
      if (isObj && s.p1 && s.p2) {
        ped.p1 = s.p1;
        ped.p2 = s.p2;
      } else {
        const dx = (rng() < 0.5 ? 1 : 0) * (14 + rng() * 10);
        const dz = dx === 0 ? (14 + rng() * 10) : 0;
        ped.p1 = [x - dx / 2, z - dz / 2];
        ped.p2 = [x + dx / 2, z + dz / 2];
      }
      ped.segLen = Math.hypot(ped.p2[0] - ped.p1[0], ped.p2[1] - ped.p1[1]) || 12;
    } else if (role === 'talking') {
      ped.groupId = isObj && s.groupId ? s.groupId : ('grp_' + Math.floor(i / 2));
      ped.groupCenter = isObj && s.cx !== undefined ? [s.cx, s.cz] : [x, z];
    }
    PEDS.push(ped);
  });
  initTrains();
}

// ---------- trains: passenger stops at the junction, freight runs through ----------
const TRAINS = [];
function initTrains() {
  const consist = (loco, n, car, carLen, gap) => { const parts = [{ mesh: loco, len: 20.5 }]; for (let i = 0; i < n; i++) parts.push({ mesh: car, len: carLen }); let off = 0; for (const p of parts) { p.off = off + p.len / 2; off += p.len + gap; } return { parts, len: off - gap }; };
  TRAINS.push(Object.assign({ name: 'passenger', z: -292.5, dir: 1, head: -150, v: 12, cruise: 16, stops: true, state: 'run', timer: 0, dwelt: false }, consist('loco_red', 5, 'coach', 23.5, 0.9)));
  TRAINS.push(Object.assign({ name: 'freight', z: -299.5, dir: 1, head: 400, v: 0, cruise: 12, stops: false, state: 'wait', timer: 14, dwelt: true }, consist('loco_blue', 12, 'wagon', 10.7, 0.6)));
}
const PORTAL = 345;
function updateTrains(dt) {
  const c = GAME.car;
  for (const T of TRAINS) {
    if (T.state === 'wait') { T.timer -= dt; if (T.timer <= 0) { T.dir *= -1; T.head = -T.dir * PORTAL; T.v = T.cruise * 0.85; T.dwelt = !T.stops; T.state = 'run'; } continue; }
    let target = T.cruise;
    if (T.stops && !T.dwelt) { const dist = (T.dir * T.len / 2 - T.head) * T.dir; if (dist > 0) target = Math.min(target, Math.sqrt(2 * 0.75 * dist) + 0.2); if (dist <= 0.5 && T.v < 0.6) { T.state = 'dwell'; T.timer = 12; T.v = 0; T.dwelt = true; } }
    if (T.state === 'dwell') { T.timer -= dt; target = 0; if (T.timer <= 0) { T.state = 'run'; GAME.emit('trainHorn', T); } }
    const ahead = (c.x - T.head) * T.dir; let braking = false;
    if (Math.abs(c.z - T.z) < 3.4 && ahead > -3 && ahead < 70) { target = Math.min(target, Math.max(0, (ahead - 9) * 0.35)); braking = true; if (!T.honked) { T.honked = true; GAME.emit('trainHorn', T); } } else if (ahead > 90 || ahead < -10) T.honked = false;
    T.v = T.v < target ? Math.min(target, T.v + 0.8 * dt) : Math.max(target, T.v - (braking ? 5 : 1.6) * dt);
    T.head += T.dir * T.v * dt;
    if (T.head * T.dir > PORTAL + T.len) { T.state = 'wait'; T.timer = T.stops ? 18 : 34; }
  }
  // level crossings flash while a train is close
  for (const X of W.crossings || []) X.on = TRAINS.some(T => { if (T.state === 'wait') return false; const a = Math.min(T.head, T.head - T.dir * T.len), b = Math.max(T.head, T.head - T.dir * T.len); return X.x > a - 110 && X.x < b + 110; });
}
function trainParts(T) { return T.parts.map(p => ({ mesh: p.mesh, len: p.len, x: T.head - T.dir * p.off })); }
function crossingBlocks(p) { for (const X of W.crossings || []) if (X.on && Math.abs(p[0] - X.x) < 8 && p[1] > -318 && p[1] < -280 && !(p[1] > -304 && p[1] < -288)) return true; return false; }

// ---------- 4-Way Traffic Junction Signals & Vehicle Regulation ----------
function getJunctionSignalState(j, time) {
  const cycleT = 24.0;
  const lt = ((time + j.offset) % cycleT + cycleT) % cycleT;
  // 0.0 - 9.5s:  NS Green, EW Red
  // 9.5 - 12.0s: NS Yellow, EW Red
  // 12.0 - 13.0s: All Red (clearance buffer)
  // 13.0 - 21.5s: NS Red, EW Green
  // 21.5 - 23.0s: NS Red, EW Yellow
  // 23.0 - 24.0s: All Red (clearance buffer)
  let stateNS, stateEW;
  if (lt < 9.5) {
    stateNS = 'green';
    stateEW = 'red';
  } else if (lt < 12.0) {
    stateNS = 'yellow';
    stateEW = 'red';
  } else if (lt < 13.0) {
    stateNS = 'red';
    stateEW = 'red';
  } else if (lt < 21.5) {
    stateNS = 'red';
    stateEW = 'green';
  } else if (lt < 23.0) {
    stateNS = 'red';
    stateEW = 'yellow';
  } else {
    stateNS = 'red';
    stateEW = 'red';
  }
  return { stateNS, stateEW, lt };
}

function trafficLightBlocks(t, p0) {
  const px = p0[0], pz = p0[1], pyaw = p0[2];
  const fx = -Math.sin(pyaw), fz = -Math.cos(pyaw);

  for (const j of W.trafficJunctions || []) {
    const dx = j.x - px, dz = j.z - pz;
    if (Math.abs(dx) > 28 || Math.abs(dz) > 28) continue;

    // Ahead distance along vehicle travel heading
    const ahead = dx * fx + dz * fz;
    if (ahead <= 0 || ahead > 25) continue;

    // Lateral offset from road heading
    const lat = Math.abs(dx * (-fz) + dz * fx);
    if (lat > 6.5) continue;

    // Determine approach axis: |dz| >= |dx| means approaching along Z (NS axis)
    const isNS = Math.abs(dz) >= Math.abs(dx);
    const stopDist = isNS ? (j.wz * 0.5 + 3.8) : (j.wx * 0.5 + 3.8);

    // If vehicle has already crossed the stop line into the intersection box,
    // it MUST clear the intersection! Never block inside the box!
    if (ahead < stopDist - 0.2) continue;

    const distToLine = ahead - stopDist;
    const { stateNS, stateEW } = getJunctionSignalState(j, GAME.t);
    const state = isNS ? stateNS : stateEW;

    if (state === 'green') {
      continue;
    } else if (state === 'red') {
      if (distToLine <= 16.0) {
        if (distToLine <= 0.25 && distToLine >= -0.4) {
          t.v = 0;
          t.brake = 1;
        }
        return true;
      }
    } else if (state === 'yellow') {
      // Dilemma zone: if close and traveling with momentum, proceed safely; otherwise brake to stop
      if (distToLine < 4.2 && t.v > 3.2) {
        continue;
      } else if (distToLine <= 16.0) {
        return true;
      }
    }
  }
  return false;
}
// push the player's car out of an oriented box (traffic, trains)
function obbPush(c, px, pz, bx, bz, yaw, hl, hw, r) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw), dx = px - bx, dz = pz - bz;
  const lx = dx * rx + dz * rz, lf = dx * fx + dz * fz, qx = clamp(lx, -hw, hw), qf = clamp(lf, -hl, hl);
  let nx = px - (bx + rx * qx + fx * qf), nz = pz - (bz + rz * qx + fz * qf), d = Math.hypot(nx, nz);
  if (d === 0) { const ex = hw - Math.abs(lx), ef = hl - Math.abs(lf); if (ex < ef) { nx = rx * Math.sign(lx || 1); nz = rz * Math.sign(lx || 1); d = -ex; } else { nx = fx * Math.sign(lf || 1); nz = fz * Math.sign(lf || 1); d = -ef; } } else { nx /= d; nz /= d; }
  if (d >= r) return 0;
  const pen = r - d; c.x += nx * pen; c.z += nz * pen; const vn = c.vx * nx + c.vz * nz; if (vn < 0) { c.vx -= nx * vn * 1.2; c.vz -= nz * vn * 1.2; c.vx *= 0.82; c.vz *= 0.82; return -vn; } return 0;
}
function collideMovers(c) {
  let impact = 0; const f = [-Math.sin(c.yaw), -Math.cos(c.yaw)];
  for (const s of [CAROFF, -CAROFF, 0]) { const px = c.x + f[0] * s, pz = c.z + f[1] * s;
    for (const t of TRAFFIC) { if (t.y > 1 || Math.abs(t.x - px) > 9 || Math.abs(t.z - pz) > 9) continue; impact = Math.max(impact, obbPush(c, px, pz, t.x, t.z, t.yaw, t.len / 2, t.wid / 2, CARR)); }
    if (Math.abs(pz + 296) < 10) for (const T of TRAINS) { if (T.state === 'wait') continue; for (const p of trainParts(T)) if (Math.abs(p.x - px) < p.len / 2 + 2) impact = Math.max(impact, obbPush(c, px, pz, p.x, T.z, Math.PI / 2, p.len / 2, 1.6, CARR)); } }
  return impact;
}
let drawTrains = function (u) {
  for (const T of TRAINS) { if (T.state === 'wait') continue; const yaw = -T.dir * Math.PI / 2;
    for (const p of trainParts(T)) { if (Math.abs(p.x) > 350) continue; drawMesh(u, MESH[p.mesh], M4.model(p.x, 0.3, T.z, p.mesh.startsWith('loco') ? yaw : yaw)); } }
  if (W.crossLamps) { const blink = Math.floor(GAME.t * 2.2) % 2; for (const [x, y, z, k] of W.crossLamps) { const X = W.crossings.find(q => Math.abs(q.x - x) < 9); const on = X && X.on && blink === k; drawMesh(u, MESH.crossLamp, M4.model(x, y, z, 0, Math.PI / 2, 0), on ? [1, 1, 1] : [0.25, 0.08, 0.08], on ? 1 : 0.05); } }
};
// QA/showcase hook: extra static meshes drawn with the world
GAME.extra = [];
const _drawTrains = drawTrains;
drawTrains = function (u) { _drawTrains(u); for (const e of GAME.extra) drawMesh(u, MESH[e.mesh], M4.model(e.x, e.y || 0, e.z, e.yaw || 0)); };

function drawTrafficLights(u) {
  if (!W.trafficSignals || !W.trafficSignals.length || !MESH.trafficLightLens) return;
  const cam = GAME.cam;
  const juncMap = {};
  for (const j of W.trafficJunctions || []) {
    juncMap[j.id] = getJunctionSignalState(j, GAME.t);
  }

  const COLS = {
    red: [1.0, 0.08, 0.08],
    yellow: [1.0, 0.75, 0.04],
    green: [0.06, 1.0, 0.42]
  };
  const Y_OVERHEAD = { red: 4.95, yellow: 4.60, green: 4.25 };
  const Y_POLE = { red: 3.00, yellow: 2.70, green: 2.40 };

  for (const s of W.trafficSignals) {
    if (Math.abs(s.x - cam.pos[0]) > 260 || Math.abs(s.z - cam.pos[2]) > 260) continue;
    const jState = juncMap[s.jid];
    if (!jState) continue;
    const state = (s.axis === 'NS') ? jState.stateNS : jState.stateEW;
    const col = COLS[state];
    if (!col) continue;

    const baseM = M4.model(s.x, 0, s.z, s.yaw);

    // 1. Overhead active lens
    const yOver = Y_OVERHEAD[state];
    const mOver = M4.mul(baseM, M4.model(3.2, yOver, -0.135));
    drawMesh(u, MESH.trafficLightLens, mOver, col, 3.8);

    // 2. Pole eye-level active lens
    const yPole = Y_POLE[state];
    const mPole = M4.mul(baseM, M4.model(0.28, yPole, -0.115, 0, 0, 0, 0.82, 0.82, 0.82));
    drawMesh(u, MESH.trafficLightLens, mPole, col, 3.8);
  }
}
// train horn (only when sound is on)
GAME.on('trainHorn', T => {
  if (!GAME.sound || typeof AUDIO === 'undefined' || !AUDIO.ctx) return; const C = AUDIO.ctx, t = C.currentTime, c = GAME.car;
  const d = Math.hypot(c.x - T.head, c.z - T.z), vol = clamp(1 - d / 450, 0, 1) * 0.16; if (vol < 0.01) return;
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.5); lp.connect(g); g.connect(AUDIO.master);
  for (const f of [311, 370, 466]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 1.55); }
});
