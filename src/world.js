'use strict';
// ============================================================
// WORLD — Shatranj City. 1 unit = 1 m. +X east, -Z north, Y up.
// ============================================================
const COL = {
  ground: hex('#447A32'), oldGround: hex('#4C8036'), marketGround: hex('#52823A'), bizGround: hex('#487834'),
  park: hex('#387428'), lawn: hex('#3C7C2C'), paving: hex('#C4A57C'), gravel: hex('#7A6F63'),
  asphalt: hex('#383533'), dash: hex('#E8E0CC'), kerb: hex('#B8AE9C'),
  stone: hex('#9C8C74'), riverbed: hex('#3E3A33'),
  sandLit: hex('#BC9369'), sandShadow: hex('#7D563D'), sandstone: hex('#C49A6C'), sandDark: hex('#A67E55'), temple: hex('#B08B62'),
  wood: hex('#5C3B22'), cream: hex('#E8DCC0'), concrete: hex('#BDB3A6'), bridgeStone: hex('#D2C8B6'),
  glass: hex('#7FA6C8'), glassDark: hex('#1B2440'), neonDark: hex('#121633'),
  brass: hex('#EBB958'), lampWarm: hex('#FFD9A0'), white: hex('#F4F1EA'),
  trunk: hex('#6B4A2E'), leaf: hex('#3F7A3A'), leaf2: hex('#557F35'), palm: hex('#3F7A3A'),
  cyan: hex('#61F1F6'), magenta: hex('#FE68DB'), violet: hex('#A73CCD'), pinkRed: hex('#C12A57'), orange: hex('#FF9F43'),
  red: hex('#B22A2A'), brick: hex('#A6503A'), tank: hex('#222222')
};
const HAVELI = ['#C8964F', '#E08A3C', '#D99A94', '#5E9E9A', '#C9A06E', '#DCC7A0', '#B8845A', '#7FA9A0'].map(hex);
const RES = ['#5B8FD0', '#E9CF5C', '#D8D4C8', '#6F9BD6', '#E3C454'].map(hex);
const BRIGHT = ['#E08A3C', '#D9637A', '#3FB8AE', '#E9CF5C', '#C12A57', '#4F8FD8', '#5FA05A'].map(hex);

const W = {
  boxes: [], circles: [], grid: new Map(), mapBld: [], signs: [], labels: [], lamps: [],
  landmarks: [], nodes: {}, edges: [], traffic: [], pedSpots: [], sacks: [], stalls: [], holos: [], boats: [],
  trafficJunctions: [], trafficSignals: [],
  zones: [
    { name: 'OLD CITY', x0: -118, z0: -240, x1: 118, z1: -55, col: '#E8955A' },
    { name: 'RESIDENTIAL DISTRICT', x0: -300, z0: -300, x1: -132, z1: -175, col: '#5B8FD0' },
    { name: '', x0: -300, z0: -175, x1: -132, z1: -55, col: '#E9CF5C' },
    { name: 'ANCIENT TEMPLE COMPLEX', x0: 126, z0: -270, x1: 290, z1: -84, col: '#4FA35A' },
    { name: 'MARKET DISTRICT', x0: -300, z0: 55, x1: -104, z1: 205, col: '#D9637A' },
    { name: 'MODERN BUSINESS DISTRICT', x0: 36, z0: 55, x1: 302, z1: 302, col: '#3FB8AE' },
    { name: 'CENTRAL PARK', x0: -60, z0: 165, x1: 60, z1: 268, col: '#6FA05A' },
    { name: 'RAILWAY JUNCTION', x0: -80, z0: -302, x1: 80, z1: -238, col: '#9A8F80' }
  ],
  cyber: [200, 170], waterY: -4.5
};

// ---------- colliders ----------
function gridAdd(i, x0, z0, x1, z1) { for (let gx = Math.floor(x0 / 32); gx <= Math.floor(x1 / 32); gx++) for (let gz = Math.floor(z0 / 32); gz <= Math.floor(z1 / 32); gz++) { const k = gx + ',' + gz; if (!W.grid.has(k)) W.grid.set(k, []); W.grid.get(k).push(i); } }
function addBox(x0, z0, x1, z1, map = false) { const i = W.boxes.length; W.boxes.push({ x0, z0, x1, z1, tall: map }); gridAdd(i, x0, z0, x1, z1); if (map) W.mapBld.push([x0, z0, x1, z1]); }
function addCircle(x, z, r, tag) { const i = -1 - W.circles.length, c = { x, z, r, tag }; W.circles.push(c); gridAdd(i, x - r, z - r, x + r, z + r); return c; }
// allocation-free neighbour query (a stamp array removes duplicates); returns a shared array, so don't nest calls
const _NC = { out: [], seen: new Int32Array(0), stamp: 0 };
function nearColliders(x, z) {
  const need = W.boxes.length + W.circles.length; if (_NC.seen.length < need) _NC.seen = new Int32Array(need + 64);
  const out = _NC.out, seen = _NC.seen, st = ++_NC.stamp, nb = W.boxes.length; out.length = 0;
  const gx = Math.floor(x / 32), gz = Math.floor(z / 32);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = W.grid.get((gx + a) + ',' + (gz + b)); if (!l) continue; for (const i of l) { const k = i >= 0 ? i : nb - 1 - i; if (seen[k] !== st) { seen[k] = st; out.push(i); } } }
  return out;
}

// ---------- sign textures ----------
const FONT_D = "Teko, 'Rajdhani', 'Arial Narrow', sans-serif", FONT_H = "Rajdhani, 'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', sans-serif";
function neonSign(text, o = {}) {
  const w = o.vertical ? 256 : 1024, h = o.vertical ? 1024 : 256;
  return textCanvas(w, h, (x, W_, H_) => {
    x.fillStyle = o.bg || '#0b0d1c'; x.fillRect(0, 0, W_, H_);
    const fr = o.frame || '#FE68DB'; x.strokeStyle = fr; x.lineWidth = 14; x.shadowColor = fr; x.shadowBlur = 18; x.strokeRect(16, 16, W_ - 32, H_ - 32);
    x.shadowBlur = 0; x.lineWidth = 4; x.strokeStyle = '#ffffff'; x.globalAlpha = 0.6; x.strokeRect(16, 16, W_ - 32, H_ - 32); x.globalAlpha = 1;
    const col = o.color || '#61F1F6'; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 22; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fam = o.hindi ? FONT_H : FONT_D;
    if (o.vertical) { x.save(); x.translate(W_ / 2, H_ / 2); x.rotate(-Math.PI / 2); const s = fitFont(x, text, H_ - 110, 190, fam); x.font = `700 ${s}px ${fam}`; x.fillText(text, 0, 8); x.fillStyle = '#ffffff'; x.shadowBlur = 0; x.globalAlpha = 0.55; x.fillText(text, 0, 8); x.restore(); }
    else { const s = fitFont(x, text, W_ - 120, o.size || 170, fam); x.font = `700 ${s}px ${fam}`; x.fillText(text, W_ / 2, H_ / 2 + (o.hindi ? 6 : 12)); x.shadowBlur = 0; x.globalAlpha = 0.5; x.fillStyle = '#fff'; x.fillText(text, W_ / 2, H_ / 2 + (o.hindi ? 6 : 12)); }
  });
}
function roadSign(lines, o = {}) {
  return textCanvas(1024, 256, (x, w, h) => {
    x.fillStyle = o.bg || '#1f6b4a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (lines.length === 1) { const s = fitFont(x, lines[0], w - 100, 150, FONT_D); x.font = `600 ${s}px ${FONT_D}`; x.fillText(lines[0], w / 2, h / 2 + 10); }
    else { let s = fitFont(x, lines[0], w - 100, 100, FONT_D); x.font = `600 ${s}px ${FONT_D}`; x.fillText(lines[0], w / 2, h * 0.34 + 8); s = fitFont(x, lines[1], w - 100, 78, FONT_H); x.font = `600 ${s}px ${FONT_H}`; x.fillText(lines[1], w / 2, h * 0.72); }
  });
}
function shopSign(text, bg, fg = '#fff8e8') {
  return textCanvas(512, 128, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, h - 14, w, 14); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; const s = fitFont(x, text, w - 50, 84, FONT_H); x.font = `700 ${s}px ${FONT_H}`; x.fillText(text, w / 2, h / 2 + 2); });
}
function billboard(title, sub, c1, c2) {
  return textCanvas(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalAlpha = 0.15; for (let i = 0; i < 12; i++) { x.fillStyle = '#fff'; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 30 + Math.random() * 120, 0, 7); x.fill(); } x.globalAlpha = 1;
    x.fillStyle = '#ffffff'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 16;
    const s = fitFont(x, title, w - 120, 200, FONT_D); x.font = `700 ${s}px ${FONT_D}`; x.fillText(title, 60, h * 0.6);
    if (sub) { x.font = `600 58px ${FONT_H}`; x.fillText(sub, 64, h * 0.82); }
  });
}
function addSign(cv, x, y, z, yaw, w, h, emis = 1.4, key, both = false) { W.signs.push({ cv, x, y, z, yaw, w, h, emis, key, both }); }

// ---------- building helpers ----------
function chhatri(G, x, y, z, s = 1, col = COL.cream) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.box(x + dx * 0.9 * s, y + 1.1 * s, z + dz * 0.9 * s, 0.22 * s, 2.2 * s, 0.22 * s, col);
  G.box(x, y + 2.3 * s, z, 2.4 * s, 0.25 * s, 2.4 * s, col);
  G.prism(x, y + 2.42 * s, z, 1.25 * s, 1.05 * s, 0.35 * s, 10, col); G.prism(x, y + 2.77 * s, z, 1.05 * s, 0.55 * s, 0.6 * s, 10, col); G.prism(x, y + 3.37 * s, z, 0.55 * s, 0.05 * s, 0.55 * s, 10, col);
}
function hitsRoad(x, z, margin = 3.6) {
  if (!W.edges || !W.edges.length) return false;
  for (const e of W.edges) {
    const a = W.nodes[e.a], b = W.nodes[e.b];
    if (!a || !b) continue;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-4) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lenSq));
    const cx = a[0] + t * dx, cz = a[1] + t * dz;
    const dist = Math.hypot(x - cx, z - cz);
    const halfW = (e.w || 12) / 2;
    if (dist < halfW + margin) return true;
  }
  // Prevent trees from spawning in the river
  if (Math.abs(z) < 32.5) return true;
  return false;
}
function addSphericalCone(G, cx, cy, cz, r, hSwell, hCone, seg, cDark, cMid, cTop, rot = 0) {
  // 1. Lower spherical underbelly (curved bowl expanding from r * 0.45 to r)
  G.prism(cx, cy, cz, r * 0.45, r, hSwell, seg, cDark, 9, 0, { rot, colTop: cMid });
  // 2. Upper conical taper (sloping from r to fine tip)
  G.prism(cx, cy + hSwell, cz, r, r * 0.10, hCone, seg, cMid, 9, 0, { rot, colTop: cTop });
  // 3. Spire cone apex
  G.prism(cx, cy + hSwell + hCone, cz, r * 0.10, 0.01, hCone * 0.22, seg, cTop, 9, 0, { rot });
}

function tree(G, x, z, s = 1, rng = Math.random) {
  if (hitsRoad(x, z, 3.2 * s)) return;
  // Sturdy trunk and ground buttress root flares
  G.prism(x, 0, z, 0.36 * s, 0.22 * s, 2.0 * s, 6, COL.trunk);
  addCircle(x, z, 0.32 * s, { kind: 'tree', s, y: 3.8 * s, col: [0.28, 0.52, 0.24] });
  for (let a = 0; a < 3; a++) {
    const ang = a * 2.09 + rng() * 0.4;
    G.beam([x, 0, z], [x + Math.cos(ang) * 0.55 * s, 0, z + Math.sin(ang) * 0.55 * s], 0.16 * s, COL.trunk);
  }

  const cMid = rng() > 0.5 ? COL.leaf : COL.leaf2;
  const cDark = hex('#244c20');
  const cLight = hex('#52903e');
  const cPeak = hex('#6bb34e');

  const isCluster = rng() < 0.38;
  if (!isCluster) {
    // Combination of 3 stacked spherical-cone tiers (Tier 1: Lower broad, Tier 2: Mid, Tier 3: Crown spire)
    G.prism(x, 1.8 * s, z, 0.22 * s, 0.12 * s, 2.4 * s, 5, COL.trunk);
    // Tier 1 (Lower broad spherical-cone)
    addSphericalCone(G, x, 1.6 * s, z, 2.35 * s, 0.65 * s, 1.35 * s, 8, cDark, cMid, cLight, 0.15);
    // Tier 2 (Middle spherical-cone)
    addSphericalCone(G, x, 3.1 * s, z, 1.90 * s, 0.55 * s, 1.25 * s, 8, cDark, cMid, cLight, 0.55);
    // Tier 3 (Crown spherical-cone)
    addSphericalCone(G, x, 4.5 * s, z, 1.40 * s, 0.45 * s, 1.55 * s, 8, cMid, cLight, cPeak, 0.95);
  } else {
    // Combination of 3 clustered spherical-cone heads on branching wooden limbs
    const ang1 = rng() * 6.28;
    const ang2 = ang1 + 2.1 + (rng() - 0.5) * 0.4;
    const dx1 = Math.cos(ang1) * 1.15 * s, dz1 = Math.sin(ang1) * 1.15 * s;
    const dx2 = Math.cos(ang2) * 1.15 * s, dz2 = Math.sin(ang2) * 1.15 * s;

    // Branches
    G.beam([x, 1.8 * s, z], [x, 4.3 * s, z], 0.18 * s, COL.trunk);
    G.beam([x, 1.8 * s, z], [x + dx1, 3.0 * s, z + dz1], 0.16 * s, COL.trunk);
    G.beam([x, 1.8 * s, z], [x + dx2, 2.8 * s, z + dz2], 0.16 * s, COL.trunk);

    // Spherical-cone 1 (Tall central crown)
    addSphericalCone(G, x, 4.1 * s, z, 1.65 * s, 0.50 * s, 1.60 * s, 8, cDark, cMid, cPeak, 0.2);
    // Spherical-cone 2 (Lateral branch 1)
    addSphericalCone(G, x + dx1, 2.8 * s, z + dz1, 1.45 * s, 0.45 * s, 1.35 * s, 8, cDark, cMid, cLight, 0.6);
    // Spherical-cone 3 (Lateral branch 2)
    addSphericalCone(G, x + dx2, 2.6 * s, z + dz2, 1.50 * s, 0.45 * s, 1.40 * s, 8, cDark, cMid, cLight, 1.1);
  }
}
function palm(G, x, z, s = 1) {
  if (hitsRoad(x, z, 2.6 * s)) return;
  const top = [x + 0.6 * s, 7.5 * s, z]; G.beam([x, 0, z], top, 0.35 * s, COL.trunk); addCircle(x, z, 0.26 * s, { kind: 'tree', s, y: 7.2 * s, col: [0.28, 0.5, 0.25] });
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const tip = [top[0] + Math.cos(a) * 3.2 * s, top[1] - 1.4 * s, top[2] + Math.sin(a) * 3.2 * s]; const mid = [top[0] + Math.cos(a) * 1.6 * s, top[1] + 0.35 * s, top[2] + Math.sin(a) * 1.6 * s]; G.beam(top, mid, 0.5 * s, COL.palm, 9, 0, 0.08); G.beam(mid, tip, 0.45 * s, COL.palm, 9, 0, 0.08); }
}
function lamp(G, x, z, faceX = 0, faceZ = 0, h = 7) {
  G.prism(x, 0, z, 0.26, 0.24, 0.14, 8, COL.concrete);
  const L = { x, z, fx: faceX, fz: faceZ, h, down: false, rest: false, ang: 0, w: 0, dir: [1, 0], t: 0 };
  (W.lampPosts = W.lampPosts || []).push(L); L.col = addCircle(x, z, 0.2, { kind: 'lamp', lamp: L });
  W.lamps.push([x + faceX * 1.4, h - 0.3, z + faceZ * 1.4]);
}

// 4-Way Traffic Signal Post Assembly (Cantilever Mast Arm & Overhead/Eye-Level Hooded Signal Heads)
function addTrafficSignalAssembly(G, px, pz, yaw, name) {
  addCircle(px, pz, 0.35); // Solid collision circle so vehicles don't clip through pole
  const prevT = G.T;
  G.T = M4.model(px, 0, pz, yaw);

  // Base flange plate and anchor bolts
  G.box(0, 0.08, 0, 0.54, 0.16, 0.54, hex('#1e2229'), 5);
  for (const s1 of [-0.18, 0.18]) for (const s2 of [-0.18, 0.18]) {
    G.box(s1, 0.16, s2, 0.05, 0.05, 0.05, hex('#94a3b8'), 5);
  }

  // Vertical tapered steel mast
  G.beam([0, 0, 0], [0, 5.4, 0], 0.12, hex('#2d3238'), 5);
  G.prism(0, 5.42, 0, 0.14, 0.14, 0.06, 10, hex('#1e2229'), 5); // Acorn cap

  // Cantilever overhead mast arm reaching out over the road
  G.beam([0, 5.2, 0], [3.4, 5.2, 0], 0.095, hex('#2d3238'), 5);
  G.beam([0, 4.4, 0], [1.3, 5.2, 0], 0.055, hex('#2d3238'), 5); // Support strut
  G.prism(3.42, 5.2, 0, 0.10, 0.10, 0.04, 8, hex('#1e2229'), 5);

  // Primary Overhead Signal Head (at x = 3.2, y = 4.6, facing -Z)
  G.box(3.2, 4.6, 0.015, 0.54, 1.30, 0.02, hex('#EAB308'), 4); // Yellow border
  G.box(3.2, 4.6, -0.005, 0.44, 1.20, 0.22, hex('#111317'), 5); // Matte black box
  for (let i = -1; i <= 1; i++) {
    const y_i = 4.6 - i * 0.35;
    G.prism(3.2, y_i, -0.115, 0.115, 0.115, 0.02, 12, hex('#14171c'), 5); // Unlit lens well
    G.box(3.2, y_i + 0.12, -0.17, 0.26, 0.02, 0.13, hex('#111317'), 5); // Visor top
    G.box(3.2 - 0.12, y_i + 0.06, -0.15, 0.02, 0.12, 0.11, hex('#111317'), 5); // Visor left
    G.box(3.2 + 0.12, y_i + 0.06, -0.15, 0.02, 0.12, 0.11, hex('#111317'), 5); // Visor right
  }

  // Secondary Eye-Level Signal Head (on pole at x = 0.28, y = 2.7, facing -Z)
  G.box(0.28, 2.7, 0.015, 0.44, 1.12, 0.02, hex('#EAB308'), 4);
  G.box(0.28, 2.7, -0.005, 0.36, 1.04, 0.18, hex('#111317'), 5);
  for (let i = -1; i <= 1; i++) {
    const y_i = 2.7 - i * 0.30;
    G.prism(0.28, y_i, -0.095, 0.095, 0.095, 0.02, 12, hex('#14171c'), 5);
    G.box(0.28, y_i + 0.10, -0.14, 0.22, 0.02, 0.11, hex('#111317'), 5);
  }

  // Street / Chowk Name Sign Board
  G.box(0.65, 3.65, 0, 0.90, 0.26, 0.04, hex('#15803d'), 4);
  G.box(0.65, 3.65, -0.022, 0.84, 0.22, 0.01, hex('#FFFFFF'), 0);
  G.box(0.65, 3.65, -0.024, 0.80, 0.18, 0.01, hex('#166534'), 4);

  G.T = prevT;
}
function merlons(G, x0, x1, y, z, depth, col, alongZ = false) {
  const len = x1 - x0, n = Math.max(2, Math.round(len / 1.7));
  for (let i = 0; i < n; i++) { const c = x0 + (i + 0.5) * len / n; if (!alongZ) { G.box(c, y + 0.55, z, 1.0, 1.1, depth, col); G.prism(c, y + 1.1, z, 0.55, 0.12, 0.55, 8, col); } else { G.box(z, y + 0.55, c, depth, 1.1, 1.0, col); G.prism(z, y + 1.1, c, 0.55, 0.12, 0.55, 8, col); } }
}

// Nagara-style temple with curvilinear shikhara spire
function temple(G, x, z, R, H, face = 1) {
  const col = COL.temple, dark = COL.sandDark;
  G.block(x - 1.3 * R, z - 1.3 * R, x + 1.3 * R, z + 1.3 * R, 0, 1.6, dark, 0, 0, COL.paving); addBox(x - 1.3 * R, z - 1.3 * R, x + 1.3 * R, z + 1.3 * R, true);
  G.block(x - 0.85 * R, z - 0.85 * R, x + 0.85 * R, z + 0.85 * R, 1.6, 1.6 + 0.7 * R, col);
  const n = 12, base = 1.6 + 0.7 * R; let y = base;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, r0 = R * (1 - Math.pow(t0, 1.6) * 0.8), r1 = R * (1 - Math.pow(t1, 1.6) * 0.8), h = (H - base) / n;
    G.prism(x, y, z, r0, r1, h * 0.8, 12, i % 2 ? col : hex('#BA946A'), 0, 0, { star: 0.86, rot: 0.26 });
    G.prism(x, y + h * 0.8, z, r1 * 1.07, r1 * 1.02, h * 0.2, 12, dark, 0, 0, { star: 0.9, rot: 0.26 }); y += h;
  }
  const rt = R * 0.2; G.prism(x, y, z, rt * 1.3, rt * 1.5, R * 0.18, 16, col, 0, 0, { star: 0.85 }); G.prism(x, y + R * 0.18, z, rt * 1.5, rt * 0.4, R * 0.18, 16, col, 0, 0, { star: 0.85 });
  G.prism(x, y + R * 0.36, z, rt * 0.5, 0.03, R * 0.35, 8, COL.brass, 5);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const sx = x + dx * 0.72 * R, sz = z + dz * 0.72 * R; let yy = base; const r = R * 0.34, hh = (H - base) * 0.42; for (let i = 0; i < 6; i++) { const r0 = r * (1 - Math.pow(i / 6, 1.5) * 0.75), r1 = r * (1 - Math.pow((i + 1) / 6, 1.5) * 0.75); G.prism(sx, yy, sz, r0, r1, hh / 6, 10, col, 0, 0, { star: 0.86 }); yy += hh / 6; } G.prism(sx, yy, sz, r * 0.3, 0.02, r * 0.5, 8, dark); }
  // mandapa hall in front
  const mz = z + face * 1.9 * R, mw = 1.1 * R, md = 0.8 * R;
  G.block(x - mw, mz - md, x + mw, mz + md, 0, 1.2, dark); addBox(x - mw, mz - md, x + mw, mz + md, true);
  for (const dx of [-0.8, -0.27, 0.27, 0.8]) for (const dz of [-0.6, 0.6]) G.box(x + dx * mw, 1.2 + R * 0.35, mz + dz * md, 0.5, R * 0.7, 0.5, col);
  let ry = 1.2 + R * 0.7; for (let i = 0; i < 4; i++) { const k = 1 - i * 0.22; G.block(x - mw * k, mz - md * k, x + mw * k, mz + md * k, ry, ry + R * 0.18, i % 2 ? dark : col); ry += R * 0.18; }
}

// pointed arch gateway (used for the bazaar gate)
function archGate(G, cx, cz, alongZ, span, h, col) {
  // opening centred on (cx,cz), road passes along X if alongZ=false
  const pw = 5, d = 7, hw = span / 2, top = h, spring = h * 0.6;
  const P = (a0, a1, y0, y1, c = col) => { if (alongZ) G.block(cx - d / 2, cz + a0, cx + d / 2, cz + a1, y0, y1, c); else G.block(cx + a0, cz - d / 2, cx + a1, cz + d / 2, y0, y1, c); };
  P(-hw - pw, -hw, 0, top + 2); P(hw, hw + pw, 0, top + 2);
  if (alongZ) { addBox(cx - d / 2, cz - hw - pw, cx + d / 2, cz - hw, true); addBox(cx - d / 2, cz + hw, cx + d / 2, cz + hw + pw, true); }
  else { addBox(cx - hw - pw, cz - d / 2, cx - hw, cz + d / 2, true); addBox(cx + hw, cz - d / 2, cx + hw + pw, cz + d / 2, true); }
  const steps = 8; for (let k = 0; k < steps; k++) { const y0 = spring + k * (top - spring) / steps, y1 = y0 + (top - spring) / steps; const t = ((y0 + y1) / 2 - spring) / (top - spring); const ww = hw * (1 - Math.pow(t, 1.35)); P(-hw, -ww, y0, y1); P(ww, hw, y0, y1); }
  P(-hw, hw, top, top + 2);
  // carved frame
  const fr = COL.sandShadow;
  if (alongZ) { G.block(cx + d / 2, cz - hw - 0.7, cx + d / 2 + 0.3, cz - hw, 0, top, fr); G.block(cx + d / 2, cz + hw, cx + d / 2 + 0.3, cz + hw + 0.7, 0, top, fr); G.block(cx - d / 2 - 0.3, cz - hw - 0.7, cx - d / 2, cz - hw, 0, top, fr); G.block(cx - d / 2 - 0.3, cz + hw, cx - d / 2, cz + hw + 0.7, 0, top, fr); }
  if (alongZ) merlons(G, cz - hw - pw, cz + hw + pw, top + 2, cx, d * 0.9, col, true); else merlons(G, cx - hw - pw, cx + hw + pw, top + 2, cz, d * 0.9, col);
}

function haveli(G, x0, z0, x1, z1, h, col, rng, faces) {
  G.block(x0, z0, x1, z1, 0, h, col, 8, 0, V3.scale(col, 1.08)); addBox(x0, z0, x1, z1, true);
  G.block(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, h, h + 0.7, V3.scale(col, 0.92));
  G.block(x0 - 0.2, z0 - 0.2, x1 + 0.2, z1 + 0.2, 3.1, 3.4, V3.scale(col, 0.8));
  if (rng() < 0.28) chhatri(G, x0 + 2.2 + rng() * (x1 - x0 - 4.4), h + 0.7, z0 + 2.2 + rng() * (z1 - z0 - 4.4), 0.9, COL.cream);
  for (const f of faces || []) { // f: {axis:'x'|'z', at, dir} — facade plane and outward sign
    const along0 = f.axis === 'x' ? z0 : x0, along1 = f.axis === 'x' ? z1 : x1, len = along1 - along0;
    const nb = Math.max(1, Math.floor(len / 5));
    for (let fl = 1; fl <= 3; fl++) { const y = 2.2 + fl * 3.2; if (y + 2 > h) break; for (let i = 0; i < nb; i++) { if (rng() < 0.35) continue; const c = along0 + (i + 0.5) * len / nb; const bx = f.axis === 'x' ? f.at + f.dir * 0.55 : c, bz = f.axis === 'x' ? c : f.at + f.dir * 0.55; if (f.axis === 'x') { G.box(bx, y + 0.4, bz, 1.1, 1.8, 2.4, COL.wood); G.box(bx + f.dir * 0.1, y + 1.45, bz, 1.4, 0.2, 2.8, COL.wood); } else { G.box(bx, y + 0.4, bz, 2.4, 1.8, 1.1, COL.wood); G.box(bx, y + 1.45, bz + f.dir * 0.1, 2.8, 0.2, 1.4, COL.wood); } } }
    if (f.awning) { const ac = BRIGHT[Math.floor(rng() * BRIGHT.length)], a = f.at, o = f.at + f.dir * 2.4;
      if (f.axis === 'x') G.hexa([[a, 3.3, along0 + 0.4], [o, 2.5, along0 + 0.4], [a, 3.4, along0 + 0.4], [o, 2.6, along0 + 0.4], [a, 3.3, along1 - 0.4], [o, 2.5, along1 - 0.4], [a, 3.4, along1 - 0.4], [o, 2.6, along1 - 0.4]], ac, 0);
      else G.hexa([[along0 + 0.4, 3.3, a], [along0 + 0.4, 2.5, o], [along0 + 0.4, 3.4, a], [along0 + 0.4, 2.6, o], [along1 - 0.4, 3.3, a], [along1 - 0.4, 2.5, o], [along1 - 0.4, 3.4, a], [along1 - 0.4, 2.6, o]], ac, 0); }
  }
}
function bunting(G, xa, za, xb, zb, y, rng) {
  const L = Math.hypot(xb - xa, zb - za), n = Math.floor(L / 0.9), dx = (xb - xa) / L, dz = (zb - za) / L;
  let prev = null;
  for (let i = 0; i <= n; i++) { const t = i / n, sag = Math.sin(t * Math.PI) * 0.8, p = [xa + (xb - xa) * t, y - sag, za + (zb - za) * t]; if (prev) G.beam(prev, p, 0.03, hex('#dddddd')); prev = p;
    if (i < n) { const c = BRIGHT[Math.floor(rng() * BRIGHT.length)]; const p2 = [p[0] + dx * 0.7, p[1] - (Math.sin((i + 0.8) / n * Math.PI) - Math.sin(t * Math.PI)) * 0.8, p[2] + dz * 0.7]; G.tri(p, p2, [p[0] + dx * 0.35, p[1] - 0.75, p[2] + dz * 0.35], c, 0); } }
}

// ============================================================
function buildWorld(rng) {
  const G = new Geo();
  // ---------- ground, river ----------
  G.flat(-700, -700, 700, -32, 0, COL.ground, 13); G.flat(-700, 32, 700, 700, 0, COL.ground, 13);
  for (const z of [-32, 32]) G.quad([-700, 0, z], [700, 0, z], [700, -6.5, z], [-700, -6.5, z], COL.stone, 0, 0, [0, -3, z < 0 ? z - 1 : z + 1]);
  G.flat(-700, -32, 700, 32, -6.5, COL.riverbed, 0);
  // (River water plane is built separately via buildWaterGeo() for crystal-clear alpha blending over submerged creatures)
  // slim see-through riverside railing; open at the three bridges
  { const RC = hex('#34373C');
    for (const z of [-32.35, 32.35]) for (const [a, b] of [[-330, -317], [-303, -177], [-163, -7], [7, 143], [157, 303], [317, 330]]) {
      for (let x = a + 0.4; x <= b - 0.3; x += 3) G.box(x, 0.52, z, 0.08, 1.04, 0.08, RC, 5);
      G.block(a, z - 0.05, b, z + 0.05, 1.0, 1.08, RC, 5); G.block(a, z - 0.03, b, z + 0.03, 0.52, 0.57, RC, 5);
      G.block(a, z - 0.35, b, z + 0.35, 0.0, 0.06, hex('#A89E8C'));
    } }
  // zone ground tints (lush grass meadows & lawn surfaces across all open land)
  G.flat(-118, -240, 118, -52, 0.02, COL.oldGround, 13); G.flat(-300, 55, -104, 205, 0.02, COL.marketGround, 13); G.flat(36, 55, 302, 302, 0.02, COL.bizGround, 13);
  G.flat(-60, 165, 60, 268, 0.03, COL.park, 13); G.flat(126, -270, 290, -84, 0.02, COL.paving, 10); G.flat(-80, -302, 80, -238, 0.026, COL.gravel, 10);
  G.flat(-300, -300, -132, -55, 0.02, COL.ground, 13);
  // world walls
  for (const [a, b, c, d] of [[-326, -326, -320, 326], [320, -326, 326, 326], [-326, -326, 326, -320], [-326, 320, 326, 326]]) { G.block(a, b, c, d, 0, 2.2, COL.stone); addBox(a, b, c, d); }
  // river blockers except bridges (x = -170, 0, 150; half width 7)
  for (const [a, b] of [[-700, -317], [-303, -177], [-163, -7], [7, 143], [157, 303], [317, 700]]) addBox(a, -32.9, b, 32.9);

  // ---------- road network ----------
  const N = W.nodes; Object.assign(N, {
    nw: [-310, -45], nres: [-200, -45], vbN: [-170, -45], gate: [-40, -45], tbN: [0, -45], vsN: [150, -45], ntmp: [200, -45], ne: [310, -45],
    sw: [-310, 45], vbS: [-170, 45], tbS: [0, 45], vsS: [150, 45], cyS: [200, 45], se: [310, 45], setu: [150, 0],
    rN: [0, 66], rE: [21, 90], rS: [0, 114],
    bw: [-310, 120], arch: [-262, 120], bzW: [-230, 120], bzC: [-170, 120], bzE: [-110, 120], bC: [0, 120], bCy: [200, 120], be: [310, 120],
    gar: [0, 152], park: [0, 200], rs0: [0, 310],
    cyN: [200, 149], cyE: [221, 170], cyS2: [200, 191], cyW: [179, 170], cys: [200, 310],
    oc1: [0, -110], oc2: [0, -160], oc3: [0, -210], rail: [0, -246],
    ow1: [-115, -110], oe1: [115, -110], ow2: [-115, -160], oe2: [115, -160], ow3: [-115, -210], oe3: [115, -210],
    res1: [-200, -160], rres: [-200, -310], tgate: [200, -86],
    cnw: [-310, -310], cne: [310, -310], cse: [310, 310], csw: [-310, 310]
  });
  const E = (a, b, w = 12, draw = true) => W.edges.push({ a, b, w, draw });
  ['nw', 'nres', 'vbN', 'gate', 'tbN', 'vsN', 'ntmp', 'ne'].reduce((p, c) => (E(p, c), c));
  ['sw', 'vbS', 'tbS', 'vsS', 'cyS', 'se'].reduce((p, c) => (E(p, c), c));
  E('vbS', 'vbN'); E('tbS', 'tbN'); E('vsS', 'setu'); E('setu', 'vsN');
  E('tbS', 'rN'); E('rN', 'rE', 12, false); E('rE', 'rS', 12, false); E('rS', 'bC');
  ['bw', 'arch', 'bzW', 'bzC', 'bzE', 'bC', 'bCy', 'be'].reduce((p, c) => (E(p, c), c));
  E('vbS', 'bzC'); E('bC', 'gar'); E('gar', 'park'); E('park', 'rs0');
  E('cyS', 'bCy'); E('bCy', 'cyN'); E('cyN', 'cyE', 12, false); E('cyE', 'cyS2', 12, false); E('cyS2', 'cyW', 12, false); E('cyW', 'cyN', 12, false); E('cyS2', 'cys');
  ['tbN', 'oc1', 'oc2', 'oc3', 'rail'].reduce((p, c) => (E(p, c), c));
  E('ow1', 'oc1', 9); E('oc1', 'oe1', 9); E('ow2', 'oc2', 9); E('oc2', 'oe2', 9); E('ow3', 'oc3', 9); E('oc3', 'oe3', 9); E('ow2', 'res1', 9);
  E('nres', 'res1', 10); E('res1', 'rres', 10); E('ntmp', 'tgate', 10);
  ['cnw', 'rres', 'cne'].reduce((p, c) => (E(p, c), c)); ['cne', 'ne', 'se', 'be', 'cse'].reduce((p, c) => (E(p, c), c));
  ['cnw', 'nw', 'sw', 'bw', 'csw'].reduce((p, c) => (E(p, c), c)); ['csw', 'rs0', 'cys', 'cse'].reduce((p, c) => (E(p, c), c));
  for (const e of W.edges) { if (!e.draw) continue; const a = N[e.a], b = N[e.b]; G.strip(a, b, e.w, 0.048, COL.asphalt, 7);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (e.w >= 12) for (let d = 6; d < L - 6; d += 9) { const t0 = d / L, t1 = (d + 3) / L; G.strip([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1], 0.28, 0.088, COL.dash, 0); } }
  const nodeW = {}; for (const e of W.edges) if (e.draw) { nodeW[e.a] = Math.max(nodeW[e.a] || 0, e.w); nodeW[e.b] = Math.max(nodeW[e.b] || 0, e.w); }
  for (const k in N) { const n = N[k]; if (['rE', 'cyE', 'cyW', 'cyS2', 'cyN'].includes(k) || !nodeW[k]) continue; G.disc(n[0], 0.048, n[1], nodeW[k] / 2, 20, COL.asphalt, 7); }

  // ---------- 4-Way Traffic Junctions, Stop Lines, Zebra Crossings & Signals ----------
  W.trafficJunctions = [
    { id: 'tbS', name: 'Temple Bridge South', x: 0, z: 45, wx: 12, wz: 12, offset: 0.0 },
    { id: 'tbN', name: 'Temple Bridge North', x: 0, z: -45, wx: 12, wz: 12, offset: 6.0 },
    { id: 'vbS', name: 'Victoria Bridge South', x: -170, z: 45, wx: 12, wz: 12, offset: 12.0 },
    { id: 'bC',  name: 'Bazaar Mall / Connaught South', x: 0, z: 120, wx: 12, wz: 12, offset: 18.0 },
    { id: 'bCy', name: 'Cyber Chowk West', x: 200, z: 120, wx: 12, wz: 12, offset: 4.0 },
    { id: 'oc1', name: 'Old City 1st Chowk', x: 0, z: -110, wx: 9, wz: 12, offset: 10.0 },
    { id: 'oc2', name: 'Old City 2nd Chowk', x: 0, z: -160, wx: 9, wz: 12, offset: 16.0 },
    { id: 'oc3', name: 'Old City 3rd Chowk', x: 0, z: -210, wx: 9, wz: 12, offset: 22.0 }
  ];
  W.trafficSignals = [];
  for (const j of W.trafficJunctions) {
    const cx = j.x, cz = j.z;
    const hwx = j.wx * 0.5, hwz = j.wz * 0.5;

    // 1. South Approach (z > cz): traffic heading North (-Z)
    G.box(cx + hwx * 0.5, 0.065, cz + hwz + 3.8, hwx - 0.4, 0.015, 0.45, COL.white, 0);
    for (let x = cx - hwx + 0.6; x <= cx + hwx - 0.6; x += 1.0) {
      G.box(x, 0.062, cz + hwz + 1.7, 0.50, 0.012, 2.2, COL.white, 0);
    }

    // 2. North Approach (z < cz): traffic heading South (+Z)
    G.box(cx - hwx * 0.5, 0.065, cz - hwz - 3.8, hwx - 0.4, 0.015, 0.45, COL.white, 0);
    for (let x = cx - hwx + 0.6; x <= cx + hwx - 0.6; x += 1.0) {
      G.box(x, 0.062, cz - hwz - 1.7, 0.50, 0.012, 2.2, COL.white, 0);
    }

    // 3. West Approach (x < cx): traffic heading East (+X)
    G.box(cx - hwx - 3.8, 0.065, cz + hwz * 0.5, 0.45, 0.015, hwz - 0.4, COL.white, 0);
    for (let z = cz - hwz + 0.6; z <= cz + hwz - 0.6; z += 1.0) {
      G.box(cx - hwx - 1.7, 0.062, z, 2.2, 0.012, 0.50, COL.white, 0);
    }

    // 4. East Approach (x > cx): traffic heading West (-X)
    G.box(cx + hwx + 3.8, 0.065, cz - hwz * 0.5, 0.45, 0.015, hwz - 0.4, COL.white, 0);
    for (let z = cz - hwz + 0.6; z <= cz + hwz - 0.6; z += 1.0) {
      G.box(cx + hwx + 1.7, 0.062, z, 2.2, 0.012, 0.50, COL.white, 0);
    }

    // 4 Corner Traffic Light Posts with Cantilever Mast Arms:
    // South-East corner (faces South, yaw = PI, controls NS)
    addTrafficSignalAssembly(G, cx + hwx + 1.2, cz + hwz + 1.8, Math.PI, j.name);
    W.trafficSignals.push({ jid: j.id, axis: 'NS', x: cx + hwx + 1.2, z: cz + hwz + 1.8, yaw: Math.PI });

    // North-West corner (faces North, yaw = 0, controls NS)
    addTrafficSignalAssembly(G, cx - hwx - 1.2, cz - hwz - 1.8, 0, j.name);
    W.trafficSignals.push({ jid: j.id, axis: 'NS', x: cx - hwx - 1.2, z: cz - hwz - 1.8, yaw: 0 });

    // South-West corner (faces West, yaw = -PI/2, controls EW)
    addTrafficSignalAssembly(G, cx - hwx - 1.8, cz + hwz + 1.2, -Math.PI / 2, j.name);
    W.trafficSignals.push({ jid: j.id, axis: 'EW', x: cx - hwx - 1.8, z: cz + hwz + 1.2, yaw: -Math.PI / 2 });

    // North-East corner (faces East, yaw = PI/2, controls EW)
    addTrafficSignalAssembly(G, cx + hwx + 1.8, cz - hwz - 1.2, Math.PI / 2, j.name);
    W.trafficSignals.push({ jid: j.id, axis: 'EW', x: cx + hwx + 1.8, z: cz - hwz - 1.2, yaw: Math.PI / 2 });
  }
  // Connaught Circle roundabout
  G.annulus(0, 0.048, 90, 9.5, 23, 40, COL.asphalt, 7); G.disc(0, 0.3, 90, 9.6, 32, COL.lawn, 9); addCircle(0, 90, 10);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; G.prism(Math.cos(a) * 8.6, 0.3, 90 + Math.sin(a) * 8.6, 0.32, 0.28, 4.2, 8, COL.white); }
  G.annulus(0, 4.5, 90, 7.9, 9.3, 32, COL.white); G.prism(0, 0.3, 90, 2.5, 2.2, 0.9, 16, COL.white); G.prism(0, 1.2, 90, 0.5, 0.3, 2.2, 8, COL.white);
  // Cyber-Chowk loop
  G.annulus(200, 0.048, 170, 12.5, 28.5, 48, COL.asphalt, 7);

  // ---------- bridges ----------
  // Victoria Bridge (x=-170): 7 stone arches
  { const x0 = -177, x1 = -163, c = COL.bridgeStone; G.block(x0, -40, x1, 40, -1.0, 0.02, c); G.block(x0, -34, x0 + 0.8, 34, 0, 1.1, c); G.block(x1 - 0.8, -34, x1, 34, 0, 1.1, c); addBox(x0 - 1, -34, x0 + 0.8, 34); addBox(x1 - 0.8, -34, x1 + 1, 34);
    const span = 64 / 7; for (let k = 0; k <= 7; k++) { const zc = -32 + k * span; if (k > 0 && k < 7) G.block(x0, zc - 0.9, x1, zc + 0.9, -6.5, -1, c); }
    for (let k = 0; k < 7; k++) { const zm = -32 + (k + 0.5) * span, r = span / 2 - 0.9; for (let s = 0; s < 10; s++) { const za = zm - r + s * 2 * r / 10, zb = za + 2 * r / 10, zc = (za + zb) / 2; const yc = -1.6 - r + Math.sqrt(Math.max(0, r * r - (zc - zm) * (zc - zm))); G.block(x0, za, x1, zb, yc, -1, c); } }
    for (let z = -30; z <= 30; z += 15) { lamp(G, x0 + 0.4, z, 1, 0, 6); lamp(G, x1 - 0.4, z, -1, 0, 6); } }
  // Temple Bridge (x=0)
  { const x0 = -7, x1 = 7; G.block(x0, -40, x1, 40, -1.1, 0.02, COL.concrete); G.block(x0, -34, x0 + 0.6, 34, 0, 1.0, COL.white); G.block(x1 - 0.6, -34, x1, 34, 0, 1.0, COL.white); addBox(x0 - 1, -34, x0 + 0.6, 34); addBox(x1 - 0.6, -34, x1 + 1, 34);
    for (const z of [-12, 12]) G.block(-5, z - 1.5, 5, z + 1.5, -6.5, -1.1, COL.concrete);
    for (const z of [-34, 34]) for (const x of [-6.5, 6.5]) chhatri(G, x, 1.0, z, 0.6, COL.white);
    for (let z = -24; z <= 24; z += 16) { lamp(G, x0 + 0.3, z, 1, 0, 6); lamp(G, x1 - 0.3, z, -1, 0, 6); } }
  // Ring-road bridges (x = ±310) so the outer loop is continuous
  for (const bx of [-310, 310]) { const x0 = bx - 7, x1 = bx + 7; G.block(x0, -40, x1, 40, -1.1, 0.02, COL.concrete); G.block(x0, -34, x0 + 0.6, 34, 0, 1.0, COL.white); G.block(x1 - 0.6, -34, x1, 34, 0, 1.0, COL.white); addBox(x0 - 1, -34, x0 + 0.6, 34); addBox(x1 - 0.6, -34, x1 + 1, 34);
    for (const z of [-14, 14]) G.block(bx - 5, z - 1.5, bx + 5, z + 1.5, -6.5, -1.1, COL.concrete);
    for (let z = -24; z <= 24; z += 16) { lamp(G, x0 + 0.3, z, 1, 0, 6); lamp(G, x1 - 0.3, z, -1, 0, 6); } }
  // Vajra Setu (x=150): cable-stayed, two H pylons
  { const x0 = 143, x1 = 157; G.block(x0, -46, x1, 46, -1.2, 0.02, COL.concrete); G.block(x0, -34, x0 + 0.5, 34, 0, 1.1, hex('#8d8d8d')); G.block(x1 - 0.5, -34, x1, 34, 0, 1.1, hex('#8d8d8d')); addBox(x0 - 1, -34, x0 + 0.5, 34); addBox(x1 - 0.5, -34, x1 + 1, 34);
    const pc = hex('#B9B2A6');
    for (const zp of [-18, 18]) { for (const lx of [140.8, 159.2]) { G.hexa([[lx - 1.4, -6.5, zp - 1.6], [lx + 1.4, -6.5, zp - 1.6], [lx - 0.9, 62, zp - 1.1], [lx + 0.9, 62, zp - 1.1], [lx - 1.4, -6.5, zp + 1.6], [lx + 1.4, -6.5, zp + 1.6], [lx - 0.9, 62, zp + 1.1], [lx + 0.9, 62, zp + 1.1]], pc); addCircle(lx, zp, 1.6); }
      G.block(140, zp - 1.2, 160, zp + 1.2, -3, -1.2, pc); G.block(140.5, zp - 1, 159.5, zp + 1, 46, 48.5, pc); G.block(140.5, zp - 1, 159.5, zp + 1, 60, 62.5, pc);
      // semi-fan stays: 8 per side of each leg, anchored on the pylon between the crossbeams (longest stay highest),
      // main-span stays stop short of mid-span so the two fans never cross; each stay lands on a deck anchorage
      for (const lx of [140.8, 159.2]) { const inX = lx < 150 ? 1 : -1, px = lx + inX * 0.95, ax = lx < 150 ? 143.72 : 156.28;
        for (let i = 0; i < 8; i++) { const top = 49.4 + i * 1.3;
          for (const s of [-1, 1]) { const toMid = s === -Math.sign(zp), az = toMid ? zp + s * (5 + i * 1.6) : zp + s * (5 + i * 1.5);
            G.beam([px, top, zp + s * 1.05], [ax, 0.34, az], 0.13, hex('#D8D8D8'), 5);
            G.box(ax, 0.17, az, 0.36, 0.3, 0.5, hex('#9A958C')); G.box(ax, 0.33, az, 0.22, 0.06, 0.3, hex('#5e6064'), 5); addCircle(ax, az, 0.3); } } } }
    for (let z = -33; z <= 33; z += 11) { lamp(G, x0 + 0.3, z, 1, 0, 7); lamp(G, x1 - 0.3, z, -1, 0, 7); } }
  // river ghats + riverboats
  for (let k = 0; k < 6; k++) G.block(-150, -32 + k * 1.1, -118, -31 + k * 1.1, -6.5, -k * 0.85, COL.sandstone);
  for (let k = 0; k < 6; k++) G.block(60, 31 - k * 1.1, 100, 32 - k * 1.1, -6.5, -k * 0.85, COL.sandstone);

  // riverside lamps
  for (let x = -300; x <= 300; x += 30) { if (Math.abs(x + 170) < 10 || Math.abs(x) < 10 || Math.abs(x - 150) < 10) continue; lamp(G, x, -37.5, 0, -1); lamp(G, x, 37.5, 0, 1); }

  // ---------- About Me: Old City Darwaza (-40, -64) ----------
  { const cx = -40, z0 = -68, z1 = -60, col = COL.sandLit, dk = COL.sandShadow;
    G.block(-53, z0, -45, z1, 0, 17, col); G.block(-35, z0, -27, z1, 0, 17, col); addBox(-53, z0, -45, z1, true); addBox(-35, z0, -27, z1, true);
    G.block(-45, z0, -35, z1, 15.5, 17, col);
    for (let k = 0; k < 8; k++) { const y0 = 10.5 + k * 0.625, y1 = y0 + 0.625, t = ((y0 + y1) / 2 - 10.5) / 5; const ww = 5 * (1 - Math.pow(t, 1.3)); G.block(-45, z0, cx - ww, z1, y0, y1, col); G.block(cx + ww, z0, -35, z1, y0, y1, col); }
    // cusps along the arch
    for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7, y = 10.5 + t * 5, ww = 5 * (1 - Math.pow(t, 1.3)); for (const s of [-1, 1]) G.prism(cx + s * ww, y - 0.3, z1 + 0.05, 0.38, 0.1, 0.5, 8, col); }
    // carved frames and niches on the front face
    G.block(-45.8, z1, -45, z1 + 0.35, 0, 16.2, dk); G.block(-35, z1, -34.2, z1 + 0.35, 0, 16.2, dk); G.block(-45.8, z1, -34.2, z1 + 0.35, 16.2, 16.9, dk);
    for (const px of [-49, -31]) { for (const [y0, y1] of [[2, 7.5], [9, 14.5]]) { G.block(px - 2.4, z1, px + 2.4, z1 + 0.2, y0, y1, dk); G.block(px - 1.6, z1 + 0.2, px + 1.6, z1 + 0.28, y0 + 0.6, y1 - 1.6, hex('#4a3322')); G.prism(px, y1 - 1.6, z1 + 0.24, 1.6, 0.2, 1.2, 8, hex('#4a3322')); } }
    merlons(G, -53, -27, 17, (z0 + z1) / 2, 7.4, col);
    for (const tx of [-57, -23]) { G.block(tx - 4, -67, tx + 4, -61, 0, 13, col); addBox(tx - 4, -67, tx + 4, -61, true); merlons(G, tx - 4, tx + 4, 13, -64, 5.6, col); G.block(tx - 1.6, -61, tx + 1.6, -60.8, 3, 9, dk); G.prism(tx, 9, -60.9, 1.6, 0.2, 1.4, 8, dk); chhatri(G, tx, 14.1, -64, 0.8, col); }
    // stalls around the gate
    for (const [sx, sz] of [[-66, -55], [-72, -57], [-15.5, -55], [-10, -57.5]]) { const ac = BRIGHT[Math.floor(rng() * BRIGHT.length)]; G.block(sx - 2.5, sz - 1.5, sx + 2.5, sz + 1.5, 0, 1.0, COL.wood); addBox(sx - 2.5, sz - 1.5, sx + 2.5, sz + 1.5);
      for (let i = 0; i < 4; i++) G.prism(sx - 1.8 + i * 1.2, 1.0, sz, 0.45, 0.5, 0.35, 8, BRIGHT[(i + 2) % BRIGHT.length]); for (const dx of [-2.3, 2.3]) G.box(sx + dx, 1.5, sz - 1.3, 0.12, 3, 0.12, COL.wood);
      G.hexa([[sx - 2.8, 2.9, sz - 1.8], [sx + 2.8, 2.9, sz - 1.8], [sx - 2.8, 3.0, sz - 1.8], [sx + 2.8, 3.0, sz - 1.8], [sx - 2.8, 2.3, sz + 1.9], [sx + 2.8, 2.3, sz + 1.9], [sx - 2.8, 2.4, sz + 1.9], [sx + 2.8, 2.4, sz + 1.9]], ac);
      // Working vendor behind stall counter
      W.pedSpots.push({ role: 'working', x: sx, z: sz - 0.2, yaw: 0, arch: 2 });
      // Conversational customers in front of stall
      W.pedSpots.push({ role: 'talking', groupId: 'gate_stall_' + sx, x: sx - 0.7, z: sz + 2.5, cx: sx, cz: sz + 2.5, yaw: Math.PI * 0.25, arch: 0, isTalking: true });
      W.pedSpots.push({ role: 'talking', groupId: 'gate_stall_' + sx, x: sx + 0.7, z: sz + 2.5, cx: sx, cz: sz + 2.5, yaw: -Math.PI * 0.25, arch: 1, isTalking: false });
    }
    W.landmarks.push({ id: 'about', name: 'About me', district: 'Old City Darwaza', color: '#E8955A', img: 'ref06', trig: [[-40, -52]], pin: [-40, 24, -64], hero: [{ pos: [-18, 3.5, -28], look: [-40, 9, -64] }] });
  }
  // small roadside shrines between the Old City and Temple Bridge
  temple(G, 32, -66, 3.2, 16, 1); temple(G, 62, -68, 2.6, 13, 1);

  // ---------- Old City (havelis, bazaar main street) ----------
  { const cols = [[-114, -101], [-99, -86], [-84, -71], [-69, -56], [-54, -41], [-39, -26], [-24, -10]];
    const streets = [-110, -160, -210]; const rows = []; let z = -236;
    while (z + 11 <= -76) { const zb = z + 11; const hit = streets.find(s => zb > s - 5.5 && z < s + 5.5); if (hit !== undefined) { z = hit + 5.5; continue; } rows.push([z, zb]); z = zb + 1.5; }
    let signI = 0; const shopNames = ['मिठाई भंडार', 'चाय', 'कपड़ा', 'मसाले', 'किताबें', 'बर्तन', 'पान', 'जूते'];
    for (const side of [-1, 1]) for (let ci = 0; ci < cols.length; ci++) for (const [za, zb] of rows) {
      let [xa, xb] = cols[ci]; if (side > 0) [xa, xb] = [-xb, -xa];
      if (za > -100 && xb > -47 && xa < -33) continue; // plaza behind the Darwaza
      const inner = ci === cols.length - 1, h = 9 + Math.floor(rng() * 3) * 2 + rng() * 1.5, col = HAVELI[Math.floor(rng() * HAVELI.length)];
      const faces = inner ? [{ axis: 'x', at: side < 0 ? xb : xa, dir: -side, awning: true }] : [];
      haveli(G, xa, za, xb, zb, h, col, rng, faces);
      if (inner && signI < 16 && rng() < 0.75) { const t = shopNames[signI % shopNames.length]; const bgc = ['#8B1E1E', '#1E4E8B', '#1F6B4A', '#6B1F6B', '#8B5A1E'][signI % 5]; addSign(shopSign(t, bgc), (side < 0 ? xb : xa) - side * 0.08, 4.3, (za + zb) / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2, 5.2, 1.3, 0.95); signI++; }
    }
    for (let zz = -72; zz > -236; zz -= 12) bunting(G, -9.5, zz, 9.5, zz, 7.8, rng);
    for (let zz = -60; zz > -236; zz -= 24) for (const x of [-7.1, 7.1]) { G.prism(x, 0, zz, 0.13, 0.1, 8.5, 5, hex('#5a5048')); G.box(x, 8.2, zz, x > 0 ? 1.6 : 1.6, 0.12, 0.12, hex('#5a5048')); if (zz - 24 > -236) { G.beam([x, 8.1, zz], [x, 7.4, zz - 12], 0.04, hex('#222')); G.beam([x, 7.4, zz - 12], [x, 8.1, zz - 24], 0.04, hex('#222')); } }
    // Active pedestrians along Old City haveli street
    // Continuous walkers strolling along West and East sidewalks
    W.pedSpots.push({ role: 'walking', p1: [-7.8, -75], p2: [-7.8, -225], arch: 1, speed: 1.15 });
    W.pedSpots.push({ role: 'walking', p1: [7.8, -225], p2: [7.8, -75], arch: 0, speed: 1.1 });
    W.pedSpots.push({ role: 'walking', p1: [-7.8, -130], p2: [-7.8, -200], arch: 5, speed: 1.2 });
    W.pedSpots.push({ role: 'walking', p1: [7.8, -90], p2: [7.8, -170], arch: 3, speed: 1.3 });
    // Conversational resident groups chatting under carved balconies
    for (const [cx, cz, a1, a2] of [[-8.2, -95, 1, 0], [8.2, -135, 0, 1], [-8.2, -180, 1, 5], [8.2, -195, 0, 3]]) {
      W.pedSpots.push({ role: 'talking', groupId: 'haveli_' + cz, x: cx, z: cz - 0.6, cx, cz, yaw: Math.PI, arch: a1, isTalking: true });
      W.pedSpots.push({ role: 'talking', groupId: 'haveli_' + cz, x: cx, z: cz + 0.6, cx, cz, yaw: 0, arch: a2, isTalking: false });
    }
    for (let i = 0; i < 8; i++) {
      let z; do { z = -75 - rng() * 150; } while ([-110, -160, -210].some(s => Math.abs(z - s) < 8));
      const side = (rng() < 0.5 ? -1 : 1) * 7.8;
      W.pedSpots.push({ role: 'walking', p1: [side, z - 12], p2: [side, z + 12], arch: Math.floor(rng() * 6), speed: 1.1 + rng() * 0.3 });
    }
  }

  // ---------- Residential (blue/yellow blocks) ----------
  for (let x = -296; x < -140; x += 24) for (let z = -296; z < -60; z += 22) {
    const xa = x, xb = x + 16, za = z, zb = z + 15;
    if (xb > -207 && xa < -193) continue; if (zb > -167 && za < -153) continue; if (za < -277) continue;
    const h = 10 + Math.floor(rng() * 4) * 3.2, col = za < -175 ? (rng() < 0.7 ? RES[0] : RES[2]) : (rng() < 0.7 ? RES[1] : RES[4]);
    G.block(xa, za, xb, zb, 0, h, col, 8, 0, hex('#cfc8b8')); addBox(xa, za, xb, zb, true);
    for (let y = 3.2; y < h - 1; y += 3.2) G.block(xa + 1, zb, xb - 1, zb + 1.1, y - 0.15, y + 0.12, hex('#E6E1D6'));
    if (rng() < 0.8) G.prism(xa + 3 + rng() * (xb - xa - 6), h, za + 3 + rng() * 6, 1.1, 1.1, 1.8, 10, COL.tank, 5);
  }

  // ---------- Ancient Temple Complex ----------
  { const x0 = 130, x1 = 286, z0 = -266, z1 = -88, wc = COL.sandDark;
    G.block(x0, z0, x1, z0 + 2, 0, 4.5, wc); addBox(x0, z0, x1, z0 + 2, true); G.block(x0, z0, x0 + 2, z1, 0, 4.5, wc); addBox(x0, z0, x0 + 2, z1, true); G.block(x1 - 2, z0, x1, z1, 0, 4.5, wc); addBox(x1 - 2, z0, x1, z1, true);
    G.block(x0, z1 - 2, 193, z1, 0, 4.5, wc); addBox(x0, z1 - 2, 193, z1, true); G.block(207, z1 - 2, x1, z1, 0, 4.5, wc); addBox(207, z1 - 2, x1, z1, true);
    merlons(G, x0, 193, 4.5, z1 - 1, 1.8, wc); merlons(G, 207, x1, 4.5, z1 - 1, 1.8, wc);
    G.block(191, z1 - 3, 195, z1 + 1, 0, 9, COL.temple); G.block(205, z1 - 3, 209, z1 + 1, 0, 9, COL.temple); G.block(191, z1 - 3, 209, z1 + 1, 9, 11, COL.temple); chhatri(G, 200, 11, z1 - 1, 1.1, COL.temple); addBox(191, z1 - 3, 195, z1 + 1); addBox(205, z1 - 3, 209, z1 + 1);
    for (const [a, b, c, d] of [[140, -255, 185, -205], [220, -255, 278, -205], [140, -150, 180, -100], [224, -150, 278, -100]]) G.flat(a, b, c, d, 0.03, COL.lawn, 9);
    temple(G, 208, -190, 9, 42, 1); temple(G, 160, -140, 5.5, 26, 1); temple(G, 256, -140, 5.5, 26, 1); temple(G, 160, -232, 5, 24, 1); temple(G, 256, -232, 5, 24, 1); temple(G, 236, -110, 3.4, 16, 1);
    G.block(170, -212, 196, -200, -0.2, 0.25, hex('#6f9fb8'), 3); const TC = [[208, -190, 16], [160, -140, 11], [256, -140, 11], [160, -232, 10], [256, -232, 10], [236, -110, 8]]; const okT = (x, z) => TC.every(([a, b, r]) => Math.hypot(x - a, z - b) > r + 3);
    for (let i = 0; i < 40; i++) { const x = 140 + rng() * 140, z = -258 + rng() * 150; if (okT(x, z) && !(x > 168 && x < 198 && z > -214 && z < -198)) tree(G, x, z, 0.9 + rng() * 0.4, rng); }
  }

  // ---------- Railway Junction (Resume) ----------
  { G.flat(-45, -270, 45, -238, 0.036, COL.paving);
    G.block(-30, -281, 30, -267, 0, 10, COL.brick, 8, 0, COL.cream); G.block(-30.3, -281.3, 30.3, -266.7, 10, 11.2, COL.cream); G.block(-30.3, -281.3, 30.3, -266.7, 3.2, 3.8, COL.cream); addBox(-30, -281, 30, -267, true);
    for (let x = -26; x <= 26; x += 6.5) { G.block(x - 1.4, -266.8, x + 1.4, -266.5, 0, 4.2, COL.cream); G.prism(x, 4.2, -266.65, 1.4, 0.15, 1.1, 8, COL.cream); }
    G.block(-5, -278, 5, -270, 0, 25, COL.brick, 8); G.block(-5.4, -278.4, 5.4, -269.6, 25, 26, COL.cream); G.prism(0, 26, -274, 5.2, 0.4, 5, 4, hex('#5a3a2a'), 0, 0, { rot: Math.PI / 4 }); addBox(-5, -278, 5, -270, true);
    addSign(textCanvas(256, 256, (x, w, h) => { x.fillStyle = '#F4F1EA'; x.beginPath(); x.arc(w / 2, h / 2, 118, 0, 7); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 8; x.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; x.fillStyle = '#222'; x.fillRect(w / 2 + Math.cos(a) * 96 - 4, h / 2 + Math.sin(a) * 96 - 4, 8, 8); } x.lineWidth = 10; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + 50, h / 2 - 40); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 - 10, h / 2 - 80); x.stroke(); }), 0, 20.5, -269.9, 0, 6, 6, 1.0);
    addSign(roadSign(['SHATRANJ CITY JUNCTION', 'शतरंज सिटी जंक्शन'], { bg: '#E9CF5C' }), 0, 8.2, -266.6, 0, 20, 5, 0.95);
    G.block(-62, -290.45, 62, -283, 0, 0.9, COL.concrete); G.block(-62, -290.5, 62, -290.2, 0.9, 0.93, hex('#E9CF5C')); addBox(-62, -290.45, 62, -283); for (let x = -58; x <= 58; x += 8) G.box(x, 3.3, -286, 0.3, 4.8, 0.3, hex('#6b6b6b')); G.block(-62, -290.3, 62, -282.5, 5.6, 6.0, hex('#8a3a2a'));
    const XING = [-310, -200, 310]; W.crossings = XING.map(x => ({ x, on: false }));
    const nearX = x => XING.some(c => Math.abs(x - c) < 7.5);
    for (const tz of [-292.5, -299.5]) {
      let x0 = -342; for (const cx of [...XING, 342].sort((a, b) => a - b)) { const a = x0, b = Math.min(cx - 7.5, 342); if (b > a) { G.block(a, tz - 2.1, b, tz + 2.1, 0.0, 0.1, hex('#6E655B')); G.hexa([[a, 0.1, tz - 2.1], [b, 0.1, tz - 2.1], [a, 0.14, tz - 1.6], [b, 0.14, tz - 1.6], [a, 0.1, tz + 2.1], [b, 0.1, tz + 2.1], [a, 0.14, tz + 1.6], [b, 0.14, tz + 1.6]], hex('#7A7166')); } x0 = cx + 7.5; }
      for (let x = -341; x < 341; x += 1.3) { if (nearX(x)) continue; G.block(x, tz - 1.35, x + 0.26, tz + 1.35, 0.12, 0.2, hex('#9A958C')); }
      // running rails on sleepers; at level crossings they drop into the crossing panel, flush with the road
      const runs = []; { let x0 = -342; for (const cx of [...XING].sort((a, b) => a - b)) { runs.push([x0, cx - 7]); x0 = cx + 7; } runs.push([x0, 342]); }
      for (const off of [-0.72, 0.72]) { for (const [a, b] of runs) { G.block(a, tz + off - 0.04, b, tz + off + 0.04, 0.2, 0.3, hex('#8E9196'), 11); G.block(a, tz + off - 0.07, b, tz + off + 0.07, 0.2, 0.23, hex('#4a3f36'), 5); }
        for (const cx of XING) { G.block(cx - 7, tz + off - 0.04, cx + 7, tz + off + 0.04, 0.056, 0.062, hex('#8E9196'), 11); G.block(cx - 7, tz + off - 0.12, cx + 7, tz + off - 0.05, 0.056, 0.059, hex('#141414'), 12); } }
    }
    for (const cx of XING) { G.block(cx - 7, -303, cx + 7, -289, 0.0, 0.055, hex('#3b3836'), 12);
      for (const [pz, face] of [[-286.6, 1], [-303.4, -1]]) { const px = Math.abs(cx) > 300 ? cx - Math.sign(cx) * 7.2 : cx + (face > 0 ? -7.2 : 7.2); G.prism(px, 0, pz, 0.1, 0.09, 3.6, 8, hex('#EDEDED')); for (let k = 0; k < 4; k++) G.prism(px, 0.4 + k * 0.8, pz, 0.105, 0.105, 0.4, 8, hex('#C0272D')); G.box(px, 2.9, pz + face * 0.02, 1.3, 0.34, 0.12, hex('#1a1a1a')); G.beam([px - 0.8, 3.4, pz], [px + 0.8, 3.9, pz], 0.12, hex('#F4F4F4'), 0, 0, 0.12); G.beam([px - 0.8, 3.9, pz], [px + 0.8, 3.4, pz], 0.12, hex('#F4F4F4'), 0, 0, 0.12); addCircle(px, pz, 0.25);
        W.crossLamps = W.crossLamps || []; W.crossLamps.push([px - 0.4, 2.9, pz + face * 0.09, 0], [px + 0.4, 2.9, pz + face * 0.09, 1]); } }
    // tunnel portals where the line meets the city wall
    for (const s of [-1, 1]) { const xi = s * 316, xo = s * 342, xa = Math.min(xi, xo), xb = Math.max(xi, xo), PC = hex('#8C7B66');
      G.block(xa, -306, xb, -304.2, 0, 9.5, PC); G.block(xa, -287.8, xb, -286, 0, 9.5, PC); G.block(xa, -306, xb, -286, 6.4, 9.5, PC); G.block(xa, -306, xb, -286, 9.5, 10.2, V3.scale(PC, 0.85));
      G.block(xa, -304.2, xb, -287.8, 0, 6.4, hex('#0c0c0e')); G.quad([xi - s * 0.02, 0.05, -304.1], [xi - s * 0.02, 0.05, -287.9], [xi - s * 0.02, 6.35, -287.9], [xi - s * 0.02, 6.35, -304.1], hex('#050506'), 0, 0, [xi + s, 3, -296]);
      for (let k = 0; k < 7; k++) { const t0 = k / 7 * Math.PI, t1 = (k + 1) / 7 * Math.PI, zc = -296, r = 8.2; G.block(xi - s * 0.4 - 0.4, zc - Math.cos(t0) * r - 0.4, xi - s * 0.4 + 0.4, zc - Math.cos(t0) * r + 0.4, 6.4 + Math.sin(t0) * 1.4, 6.9 + Math.sin(t0) * 1.4, V3.scale(PC, 1.12)); }
      addBox(xa, -306, xb, -286, true); }

    for (const px of [-8.6, 8.6]) { G.box(px, 5, -258.5, 0.5, 10, 0.5, hex('#3a3a3a')); addCircle(px, -258.5, 0.6); }
    G.block(-9.6, -259.2, 9.6, -258.4, 3.0, 12.2, hex('#1a1a1a'));
    W.landmarks.push({ id: 'resume', name: 'Resume', district: 'Railway Junction', color: '#E9CF5C', img: 'ref05', trig: [[0, -249]], pin: [0, 17, -262], hero: [{ pos: [9, 4.2, -232], look: [0, 7.4, -258] }], board: { x: 0, y: 7.6, z: -258.3, w: 18.6, h: 8.6 } });
    for (let i = 0; i < 6; i++) W.pedSpots.push([-30 + rng() * 60, -244 - rng() * 18]);
  }

  // ---------- Market District + Chandni Bazaar (Skills) ----------
  { const skip = (xa, xb) => xb > -178 && xa < -162;
    let x = -252; while (x < -112) { const w = 11 + rng() * 3, xa = x, xb = Math.min(x + w, -112); x = xb + 1;
      for (const side of [-1, 1]) { if (side < 0 && skip(xa, xb)) continue; const za = side < 0 ? 100 : 128, zb = side < 0 ? 112 : 140; const col = HAVELI[Math.floor(rng() * HAVELI.length)];
        haveli(G, xa, za, xb, zb, 9 + rng() * 5, col, rng, [{ axis: 'z', at: side < 0 ? zb : za, dir: side < 0 ? 1 : -1, awning: true }]); } }
    // lantern wall (north side, x -160..-146)
    G.block(-161, 111.5, -145, 113.2, 0, 1.1, COL.wood); addBox(-161, 111.5, -145, 113.4);
    for (let i = 0; i < 44; i++) { const lx = -160 + (i % 11) * 1.4 + (Math.floor(i / 11) % 2) * 0.7, ly = 2.6 + Math.floor(i / 11) * 1.05, lz = 112.4 + (i % 3) * 0.25; G.beam([lx, 7.2, lz], [lx, ly + 0.5, lz], 0.03, hex('#6b5a3a')); G.prism(lx, ly - 0.35, lz, 0.05, 0.36, 0.45, 8, COL.brass, 1, 0.9); G.prism(lx, ly + 0.1, lz, 0.36, 0.08, 0.4, 8, COL.brass, 1, 0.9); }
    const cats = PORTFOLIO.skills.map(s => s.category);
    const stallPos = [[-236, -1], [-214, 1], [-192, -1], [-128, 1]];
    stallPos.forEach(([sx, side], i) => { const fz = side < 0 ? 112 : 128, cz = fz - side * -0.9; const out = side < 0 ? 1 : -1;
      G.block(sx - 2.6, Math.min(fz, fz + out * 1.8), sx + 2.6, Math.max(fz, fz + out * 1.8), 0, 1.05, COL.wood); addBox(sx - 2.6, Math.min(fz, fz + out * 1.8), sx + 2.6, Math.max(fz, fz + out * 1.8));
      for (let k = 0; k < 5; k++) G.prism(sx - 2 + k, 1.05, fz + out * 0.9, 0.35, 0.4, 0.3, 8, BRIGHT[(k + i) % BRIGHT.length]);
      const cv = textCanvas(512, 200, (x, w, h) => { x.fillStyle = '#2a1a0e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#EBB958'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#FFD27A'; x.textAlign = 'center'; x.textBaseline = 'middle'; const s = fitFont(x, cats[i], w - 60, 96, FONT_D); x.font = `700 ${s}px ${FONT_D}`; x.fillText(cats[i], w / 2, h / 2 + 8); });
      W.stalls.push({ x: sx, z: fz + out * 1.8, lit: 0, sign: W.signs.length, cat: i, lamp: [sx + 2.2, 3.1, fz + out * 1.4] });
      addSign(cv, sx, 3.35, fz + out * 1.95, side < 0 ? 0 : Math.PI, 4.2, 1.64, 0.55, 'stall' + i);
      G.beam([sx - 1.8, 5.2, fz + out * 1.95], [sx - 1.8, 4.2, fz + out * 1.95], 0.04, hex('#333')); G.beam([sx + 1.8, 5.2, fz + out * 1.95], [sx + 1.8, 4.2, fz + out * 1.95], 0.04, hex('#333'));
      for (let k = 0; k < 2; k++) W.sacks.push({ x: sx - 3.4 + k * 6.8, z: fz + out * 1.2, cool: 0, col: [hex('#E0442A'), hex('#E84A8A'), hex('#F2C230')][(i + k) % 3] });
    });
    for (const s of W.sacks) { G.prism(s.x, 0, s.z, 0.45, 0.5, 0.55, 8, hex('#C8B08A')); G.prism(s.x, 0.55, s.z, 0.5, 0.42, 0.18, 8, s.col); }
    const shopT = ['मसाला भंडार', 'कपड़ा बाज़ार', 'चाय', 'लालटेन', 'मिठाई', 'चूड़ियाँ'];
    [[-246, -1], [-226, 1], [-203, -1], [-186, 1], [-138, -1], [-120, 1]].forEach(([sx, side], i) => addSign(shopSign(shopT[i], ['#8B1E1E', '#1F6B4A', '#6B1F6B', '#1E4E8B', '#8B5A1E', '#7a1e4a'][i]), sx, 5.2, side < 0 ? 112.1 : 127.9, side < 0 ? 0 : Math.PI, 5.4, 1.35, 0.95));
    for (let xx = -246; xx < -114; xx += 10) bunting(G, xx, 112.3, xx + 3, 127.7, 8.2, rng);
    for (let i = 0; i < 160; i++) { const px = -250 + rng() * 136, pz = 114.5 + rng() * 11, s = 0.05 + rng() * 0.04; G.flat(px - s, pz - s, px + s, pz + s, 0.09, rng() < 0.6 ? hex('#F5A623') : hex('#F2C230'), 0); }
    archGate(G, -262, 120, true, 12, 12, COL.sandLit);
    // other market blocks
    for (let xx = -296; xx < -110; xx += 17) for (const [za, zb] of [[58, 70], [74, 94], [146, 162], [166, 182], [186, 202]]) { const xa = xx, xb = xx + 14; if (xb > -178 && xa < -162 && za < 120) continue; const col = BRIGHT[Math.floor(rng() * BRIGHT.length)]; G.block(xa, za, xb, zb, 0, 6 + rng() * 5, V3.lerp(col, COL.cream, 0.45), 8); addBox(xa, za, xb, zb, true); }
    // Active Chandni Bazaar Pedestrians
    // Continuous walkers patrolling along North and South sidewalks
    W.pedSpots.push({ role: 'walking', p1: [-244, 113.2], p2: [-125, 113.2], arch: 0, speed: 1.15 });
    W.pedSpots.push({ role: 'walking', p1: [-125, 126.8], p2: [-244, 126.8], arch: 1, speed: 1.2 });
    W.pedSpots.push({ role: 'walking', p1: [-230, 113.2], p2: [-140, 113.2], arch: 4, speed: 1.25 });
    W.pedSpots.push({ role: 'walking', p1: [-150, 126.8], p2: [-235, 126.8], arch: 3, speed: 1.3 });
    // Working Chai-Wallah and market vendors behind stall counters
    W.pedSpots.push({ role: 'working', x: -203, z: 111.8, yaw: 0, arch: 2 });
    W.pedSpots.push({ role: 'working', x: -246, z: 111.8, yaw: 0, arch: 5 });
    W.pedSpots.push({ role: 'working', x: -186, z: 128.2, yaw: Math.PI, arch: 2 });
    // Conversational customer clusters in front of tea & sweet shops
    // Chai stall customer trio
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_chai', x: -203.6, z: 114.5, cx: -203, cz: 114.5, yaw: Math.PI * 0.25, arch: 1, isTalking: true });
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_chai', x: -202.4, z: 114.5, cx: -203, cz: 114.5, yaw: -Math.PI * 0.25, arch: 0, isTalking: false });
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_chai', x: -203.0, z: 115.3, cx: -203, cz: 114.5, yaw: 0, arch: 3, isTalking: false });
    // Saree shoppers outside fabric stall
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_saree', x: -226.5, z: 125.8, cx: -226, cz: 125.8, yaw: -Math.PI * 0.5, arch: 0, isTalking: true });
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_saree', x: -225.5, z: 125.8, cx: -226, cz: 125.8, yaw: Math.PI * 0.5, arch: 0, isTalking: false });
    // Sweet shop conversation
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_sweets', x: -138.5, z: 114.5, cx: -138, cz: 114.5, yaw: -Math.PI * 0.5, arch: 1, isTalking: true });
    W.pedSpots.push({ role: 'talking', groupId: 'bazaar_sweets', x: -137.5, z: 114.5, cx: -138, cz: 114.5, yaw: Math.PI * 0.5, arch: 5, isTalking: false });
    { const busy = x => [-246, -226, -203, -186, -138, -120].some(s => Math.abs(x - s) < 5.2) || Math.abs(x + 170) < 8; let n = 0; while (n < 8) { const x = -248 + rng() * 132, north = rng() < 0.5; if (busy(x) || (north && x > -162 && x < -144)) continue; W.pedSpots.push({ role: 'walking', p1: [x - 10, north ? 113.2 : 126.8], p2: [x + 10, north ? 113.2 : 126.8], arch: Math.floor(rng() * 6), speed: 1.1 + rng() * 0.3 }); n++; } }
    W.landmarks.push({ id: 'skills', name: 'Skills', district: 'Chandni Bazaar', color: '#D9637A', img: 'ref04', trig: [[-175, 120]], pin: [-175, 15, 120], hero: [{ pos: [-146, 3.2, 124], look: [-196, 4, 117] }] });
  }

  // ---------- Business District (day glass) ----------
  { const colsX = [[40, 60], [66, 86], [92, 112], [118, 140], [146, 166], [236, 256], [262, 282], [286, 300]], rowsZ = [[58, 78], [84, 106], [132, 152], [158, 180], [186, 208], [214, 236], [242, 264], [270, 296]];
    for (const [xa0, xb0] of colsX) for (const [za0, zb0] of rowsZ) { const cxm = (xa0 + xb0) / 2, czm = (za0 + zb0) / 2; if (Math.hypot(cxm - 200, czm - 170) < 74) continue; if ([[262, 146, 16], [260, 200, 16], [226, 234, 18], [172, 234, 16], [138, 202, 16], [138, 146, 16]].some(([tx, tz, tw]) => xa0 < tx + tw / 2 + 2 && xb0 > tx - tw / 2 - 2 && za0 < tz + tw / 2 + 2 && zb0 > tz - tw / 2 - 2)) continue; if (xa0 < 232 && xb0 > 168 && za0 < 140) continue;
      const ins = 1 + rng() * 2.5, xa = xa0 + ins, xb = xb0 - ins, za = za0 + ins, zb = zb0 - ins, h = za0 < 110 ? 50 + rng() * 70 : 26 + rng() * 60;
      const col = V3.lerp(hex('#4F7FA8'), hex('#7A9CB8'), rng()); G.block(xa, za, xb, zb, 0, h, col, 2, 0, hex('#6b7a86')); addBox(xa, za, xb, zb, true);
      if (rng() < 0.5) G.block(xa + 2, za + 2, xb - 2, zb - 2, h, h + 3 + rng() * 5, hex('#5d6b78'), 2); }
    for (let x = 44; x < 300; x += 14) { if (Math.abs(x - 150) < 10 || Math.abs(x - 200) < 10) continue; palm(G, x, 56.5, 1); }
    for (let x = 44; x < 170; x += 16) palm(G, x, 131, 0.9);
  }

  // ---------- Garage (spawn) + Central Park ----------
  { G.flat(-12, 140, 12, 164, 0.07, hex('#F2F2F0'), 4); for (const [x, z] of [[-11.5, 140.5], [11.5, 140.5], [-11.5, 163.5], [11.5, 163.5]]) { G.prism(x, 0, z, 0.3, 0.3, 6.5, 8, hex('#dfe6ea'), 6); addCircle(x, z, 0.4); }
    G.block(-12.5, 139.5, 12.5, 164.5, 6.5, 7.1, hex('#F4F4F2')); G.block(-10, 142, 10, 162, 6.45, 6.5, hex('#FFFFFF'), 1, 1.2);
    addSign(roadSign(['VAJRA GARAGE'], { bg: '#0A5AA8' }), 0, 7.9, 139.4, Math.PI, 9, 2.2, 1.0);
    for (let i = 0; i < 90; i++) { const x = -55 + rng() * 110, z = 170 + rng() * 92; if (Math.abs(x) < 11 || Math.hypot(x - 30, z - 215) < 8) continue; tree(G, x, z, 0.85 + rng() * 0.65, rng); }
    // Parkland tree groves safely placed in open green meadows away from roads
    for (let x = -280; x < 280; x += 28) {
      if (Math.abs(x + 170) < 16 || Math.abs(x) < 16 || Math.abs(x - 150) < 16) continue;
      tree(G, x + (rng() - 0.5) * 6, -64 - rng() * 10, 0.85 + rng() * 0.55, rng);
      tree(G, x + (rng() - 0.5) * 6, 64 + rng() * 10, 0.85 + rng() * 0.55, rng);
    }
    G.block(26, 211, 34, 219, 0, 1.2, COL.white); G.prism(30, 1.2, 215, 1.6, 0.5, 18, 4, COL.white, 0, 0, { rot: Math.PI / 4 }); addBox(26, 211, 34, 219, true);
    // Active Central Park Pedestrians
    W.pedSpots.push({ role: 'walking', p1: [-35, 185], p2: [35, 185], arch: 0, speed: 1.1 });
    W.pedSpots.push({ role: 'walking', p1: [25, 195], p2: [25, 245], arch: 4, speed: 1.15 });
    W.pedSpots.push({ role: 'walking', p1: [-25, 245], p2: [-25, 195], arch: 1, speed: 1.2 });
    // Discussion circle on lush lawn
    W.pedSpots.push({ role: 'talking', groupId: 'park_circle_1', x: -18.5, z: 215, cx: -18, cz: 215, yaw: Math.PI * 0.25, arch: 3, isTalking: true });
    W.pedSpots.push({ role: 'talking', groupId: 'park_circle_1', x: -17.5, z: 215, cx: -18, cz: 215, yaw: -Math.PI * 0.25, arch: 4, isTalking: false });
    W.pedSpots.push({ role: 'talking', groupId: 'park_circle_1', x: -18.0, z: 215.8, cx: -18, cz: 215, yaw: 0, arch: 0, isTalking: false });
    // Relaxing couple near obelisk
    W.pedSpots.push({ role: 'talking', groupId: 'park_couple', x: 20, z: 220, cx: 20.5, cz: 220, yaw: Math.PI * 0.5, arch: 1, isTalking: true });
    W.pedSpots.push({ role: 'talking', groupId: 'park_couple', x: 21, z: 220, cx: 20.5, cz: 220, yaw: -Math.PI * 0.5, arch: 0, isTalking: false });
    for (let i = 0; i < 4; i++) {
      let x; do { x = -40 + rng() * 80; } while (Math.abs(x) < 8);
      const z = 180 + rng() * 70;
      W.pedSpots.push({ role: 'walking', p1: [x, z - 10], p2: [x, z + 10], arch: Math.floor(rng() * 6), speed: 1.05 + rng() * 0.3 });
    }
  }

  // ---------- Cyber-Chowk (Case Studies) ----------
  { const dark = COL.neonDark, blocksZ = [[55, 72], [76, 93], [97, 111]];
    const billboards = [['VAJRA MOTORS', 'वज्र', '#0A5AA8', '#61F1F6'], ['CHOWK CHAI', 'चाय', '#C12A57', '#FF9F43'], ['PIXEL PAAN', '', '#A73CCD', '#FE68DB'], ['DIGI DHABA', 'ढाबा', '#1F6B4A', '#61F1F6'], ['METRO MASALA', 'मसाला', '#8B1E1E', '#FF9F43'], ['SHATRANJ CITY', 'शतरंज सिटी', '#262A6E', '#A73CCD']];
    let bi = 0;
    for (const [za, zb] of blocksZ) for (const side of [-1, 1]) {
      const xa = side < 0 ? 172 : 213, xb = side < 0 ? 187 : 228, h = 55 + rng() * 85; G.block(xa, za, xb, zb, 0, h, V3.lerp(dark, COL.glassDark, rng()), 2, 0, hex('#10142a')); addBox(xa, za, xb, zb, true);
      const face = side < 0 ? xb + 0.1 : xa - 0.1, yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      G.block(side < 0 ? xb : xa - 0.4, za + 0.5, side < 0 ? xb + 0.4 : xa, zb - 0.5, 5.8, 6.1, side < 0 ? COL.magenta : COL.cyan, 1, 1.6);
      const b = billboards[bi % billboards.length]; bi++; addSign(billboard(b[0], b[1], b[2], b[3]), face, 12 + rng() * 14, (za + zb) / 2, yaw, 12, 6, 1.35);
      if (rng() < 0.8) { const nc = ['#61F1F6', '#FE68DB', '#FF9F43', '#C12A57'][Math.floor(rng() * 4)]; const t = ['वज्र', 'चौक', 'VAJRA', 'NEON', 'शतरंज'][Math.floor(rng() * 5)]; addSign(neonSign(t, { vertical: true, color: nc, frame: nc === '#61F1F6' ? '#FE68DB' : '#61F1F6', hindi: /[^\x00-\x7F]/.test(t) }), face, 34 + rng() * 14, za + 3, yaw, 3, 12, 1.7); }
    }
    addSign(neonSign('CYBER-CHOWK', { vertical: true, color: '#61F1F6', frame: '#FE68DB' }), 187.15, 36, 63.5, Math.PI / 2, 5.4, 22, 1.9, 'cyberV');
    addSign(neonSign('साइबर चौक', { color: '#FF9F43', frame: '#FE68DB', hindi: true }), 212.9, 22, 84, -Math.PI / 2, 14, 3.5, 1.7);
    for (const [zb, y] of [[84.5, 20], [104, 32]]) { G.block(187, zb - 3, 213, zb + 3, y, y + 3.2, hex('#1a2040'), 2); G.block(187, zb - 3.1, 213, zb - 2.9, y + 0.2, y + 0.45, COL.cyan, 1, 1.7); G.block(187, zb + 2.9, 213, zb + 3.1, y + 0.2, y + 0.45, COL.magenta, 1, 1.7); }
    for (const x of [191.5, 208.5]) { G.box(x, 3.6, 62, 0.5, 7.2, 0.5, hex('#707070')); addCircle(x, 62, 0.5); }
    G.block(191.5, 61.6, 208.5, 62.4, 6.8, 7.3, hex('#707070')); addSign(roadSign(['CYBER-CHOWK'], { bg: '#146b5a' }), 200, 8.3, 61.55, Math.PI, 9, 2.25, 1.1, null, true);
    // name billboard on its own steel frame, clear of the flyover and the boulevard
    addSign(billboard('HARSHIT KUMAR SINHA', 'UI/UX designer', '#0A5AA8', '#A73CCD'), 200, 30, 127.9, Math.PI, 22, 11, 1.25, null, true);
    for (const px of [187.6, 212.4]) { G.box(px, 18, 128.3, 0.7, 36, 0.7, hex('#4a4f5c'), 5); addCircle(px, 128.3, 0.6); G.box(px, 0.3, 128.3, 1.6, 0.6, 1.6, COL.concrete); }
    for (const y of [24.3, 35.7]) G.block(187.6, 128.05, 212.4, 128.55, y - 0.25, y + 0.25, hex('#4a4f5c'), 5);
    for (let i = 0; i < 6; i++) { const xa = 187.6 + i * 24.8 / 6, xb = xa + 24.8 / 6; G.beam([xa, 24.3, 128.3], [xb, 35.7, 128.3], 0.12, hex('#4a4f5c'), 5); }
    // elevated interchange ring (decorative) + pillars
    const R = 38; for (let i = 0; i < 48; i++) { const a0 = i / 48 * 6.2832, a1 = (i + 1) / 48 * 6.2832, p = (r, a, y) => [200 + Math.cos(a) * r, y, 170 + Math.sin(a) * r];
      G.hexa([p(R - 5, a0, 7.6), p(R + 5, a0, 7.6), p(R - 5, a0, 8.6), p(R + 5, a0, 8.6), p(R - 5, a1, 7.6), p(R + 5, a1, 7.6), p(R - 5, a1, 8.6), p(R + 5, a1, 8.6)], hex('#5a5f6e'));
      G.hexa([p(R - 5.2, a0, 8.6), p(R - 4.8, a0, 8.6), p(R - 5.2, a0, 9.6), p(R - 4.8, a0, 9.6), p(R - 5.2, a1, 8.6), p(R - 4.8, a1, 8.6), p(R - 5.2, a1, 9.6), p(R - 4.8, a1, 9.6)], hex('#6a6f7e'));
      G.hexa([p(R - 5.25, a0, 8.0), p(R - 5.15, a0, 8.0), p(R - 5.25, a0, 8.25), p(R - 5.15, a0, 8.25), p(R - 5.25, a1, 8.0), p(R - 5.15, a1, 8.0), p(R - 5.25, a1, 8.25), p(R - 5.15, a1, 8.25)], i % 2 ? COL.cyan : COL.magenta, 1, 1.8); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832 + 0.26; const px = 200 + Math.cos(a) * R, pz = 170 + Math.sin(a) * R; if (Math.abs(px - 200) < 9) continue; G.prism(px, 0, pz, 1.3, 1.3, 7.6, 10, hex('#6a6f7e')); addCircle(px, pz, 1.4); }
    // central plaza + circular hologram showcase
    G.disc(200, 0.25, 170, 12, 36, hex('#141828'), 5);
    G.annulus(200, 0.27, 170, 11.4, 12, 36, COL.cyan, 1, 1.6);
    addCircle(200, 170, 11.6);
    
    // Circular arrangement: 3 holographic billboards facing radially outwards (120° apart)
    const angs = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6];
    PORTFOLIO.caseStudies.forEach((cs, i) => {
      const a = angs[i % 3];
      const hx = 200 + Math.cos(a) * 7.5;
      const hz = 170 + Math.sin(a) * 7.5;
      const yaw = Math.atan2(Math.cos(a), Math.sin(a));

      // Foundation plinth angled radially outward
      G.box(hx, 0.60, hz, 8.2, 0.70, 1.8, hex('#151a2c'), 5, 0, yaw);
      // Front glowing neon edge runner along the footing facing outward
      G.box(hx + Math.cos(a) * 0.95, 0.65, hz + Math.sin(a) * 0.95, 8.0, 0.16, 0.08, cs.accent || COL.cyan, 1, 2.2, yaw);

      // Support pylons on left and right of billboard (tangent is [-sin(a), cos(a)])
      const tx = -Math.sin(a), tz = Math.cos(a);
      for (const s of [-3.6, 3.6]) {
        const colX = hx + tx * s;
        const colZ = hz + tz * s;
        G.prism(colX, 0, colZ, 0.22, 0.18, 16.4, 8, hex('#283042'));
        G.prism(colX, 0, colZ, 0.30, 0.28, 0.9, 8, hex('#1a2030'));
      }
      // Top overhead crossbar gantry
      const gX1 = hx - tx * 3.75, gZ1 = hz - tz * 3.75;
      const gX2 = hx + tx * 3.75, gZ2 = hz + tz * 3.75;
      G.beam([gX1, 16.2, gZ1], [gX2, 16.2, gZ2], 0.26, hex('#333d52'));
      G.box(hx, 16.25, hz, 1.4, 0.2, 0.4, hex('#444e66'), 5, 0, yaw);

      W.holos.push({ i, x: hx, z: hz, yaw, a });
    });
    // towers ringing the interchange
    for (const [tx, tz, w, h] of [[262, 146, 16, 110], [260, 200, 16, 90], [226, 234, 18, 120], [172, 234, 16, 80], [138, 202, 16, 100], [138, 146, 16, 70]]) {
      G.block(tx - w / 2, tz - w / 2, tx + w / 2, tz + w / 2, 0, h, V3.lerp(COL.neonDark, COL.glassDark, rng()), 2, 0, hex('#10142a')); addBox(tx - w / 2, tz - w / 2, tx + w / 2, tz + w / 2, true);
      const dx = 200 - tx, dz = 170 - tz, yaw = Math.atan2(dx, dz); const fx = Math.abs(dx) > Math.abs(dz), off = w / 2 + 0.15;
      const sx = tx + (fx ? Math.sign(dx) * off : 0), sz = tz + (fx ? 0 : Math.sign(dz) * off), sy = fx ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
      const b = billboards[bi % billboards.length]; bi++; addSign(billboard(b[0], b[1], b[2], b[3]), sx, 14 + rng() * 10, sz, sy, 12, 6, 1.35);
    }
    // Cyber-Chowk tech walkers, youths with smartphones, and colleagues
    W.pedSpots.push({ role: 'walking', p1: [189.5, 60], p2: [189.5, 120], arch: 4, speed: 1.3 });
    W.pedSpots.push({ role: 'walking', p1: [210.5, 120], p2: [210.5, 60], arch: 3, speed: 1.25 });
    // Youths viewing case study holographic billboards with glowing phones
    W.pedSpots.push({ role: 'phone', x: 196, z: 124, yaw: Math.PI, arch: 3 });
    W.pedSpots.push({ role: 'phone', x: 204, z: 124, yaw: Math.PI, arch: 3 });
    // Tech colleagues outside Chowk Chai
    W.pedSpots.push({ role: 'talking', groupId: 'cyber_colleagues', x: 211.2, z: 75, cx: 211.8, cz: 75.4, yaw: Math.PI * 0.35, arch: 4, isTalking: true });
    W.pedSpots.push({ role: 'talking', groupId: 'cyber_colleagues', x: 212.4, z: 75.8, cx: 211.8, cz: 75.4, yaw: -Math.PI * 0.65, arch: 3, isTalking: false });
    // Circular trigger spots on the roundabout road facing each billboard (perfectly spaced, zero overlap)
    const trig = angs.map(a => [
      200 + Math.cos(a) * 15.0,
      170 + Math.sin(a) * 15.0
    ]);
    // Hero camera perfectly framing each billboard radially from its front
    const hero = angs.map(a => ({
      pos: [200 + Math.cos(a) * 20.5, 4.2, 170 + Math.sin(a) * 20.5 + 0.01],
      look: [200 + Math.cos(a) * 7.5, 8.8, 170 + Math.sin(a) * 7.5]
    }));
    W.landmarks.push({ id: 'cases', name: 'Case studies', district: 'Cyber-Chowk', color: '#3FB8AE', img: 'ref07', trig, pin: [200, 26, 170], hero });
  }

  // ---------- Contact: Vajra Setu lay-by ----------
  W.landmarks.push({ id: 'contact', name: 'Contact', district: 'Vajra Setu', color: '#5B9CC4', img: 'ref02', trig: [[150, 0]], pin: [150, 12, 0], hero: [{ pos: [146, 3.4, 26], look: [150, 16, -20] }] });

  // ---------- district + city signage ----------
  const gantry = (cv, x, z, w, road = 12) => { const hs = Math.max(w / 2 + 1.4, road / 2 + 0.9); for (const px of [x - hs, x + hs]) { G.box(px, 3.7, z, 0.4, 7.4, 0.4, hex('#707070')); addCircle(px, z, 0.45); } G.block(x - hs, z - 0.25, x + hs, z + 0.25, 7.2, 7.6, hex('#707070')); };
  addSign(roadSign(['OLD CITY', 'पुराना शहर']), 0, 6.1, -52.2, 0, 9, 2.25, 1.0, null, true); gantry(null, 0, -52.5, 9);
  addSign(roadSign(['MARKET DISTRICT', 'बाज़ार']), -170, 6.1, 55.2, Math.PI, 9, 2.25, 1.0, null, true); gantry(null, -170, 55.5, 9);
  addSign(roadSign(['RAILWAY JUNCTION', 'रेलवे जंक्शन']), 0, 6.1, -86.2, 0, 9, 2.25, 1.0, null, true); gantry(null, 0, -86.5, 9);
  addSign(roadSign(['ALL ROADS LEAD TO THE PORTFOLIO'], { bg: '#0A5AA8' }), 0, 6.1, 131.8, 0, 9, 1.8, 1.0, null, true); gantry(null, 0, 131.5, 9);
  addSign(neonSign('VAJRA SETU', { color: '#FFD27A', frame: '#FF9F43', bg: '#1a1208' }), 150, 50, -18.9, Math.PI, 14, 3.5, 1.4);
  addSign(neonSign('वज्र सेतु', { color: '#FFD27A', frame: '#FF9F43', bg: '#1a1208', hindi: true }), 150, 50, 18.9, 0, 14, 3.5, 1.4);

  // ---------- distant skyline ----------
  for (let i = 0; i < 90; i++) {
    const a = i / 90 * 6.2832 + rng() * 0.05, r = 490 + rng() * 220, x = Math.cos(a) * r, z = Math.sin(a) * r, w = 18 + rng() * 26, h = (z > 150 && x > 0 ? 50 : 18) + rng() * (z > 150 && x > 0 ? 90 : 45);
    if (Math.abs(x) < 336 + w / 2 && Math.abs(z) < 336 + w / 2) continue;
    if (hitsRoad(x, z, w / 2 + 6)) continue;
    G.block(x - w / 2, z - w / 2, x + w / 2, z + w / 2, 0, h, V3.lerp(hex('#8b93a0'), hex('#b8a88e'), rng()), 8);
  }

  // ---------- traffic loops (left-hand traffic) ----------
  const loop = (pts, closed = true) => W.traffic.push({ pts, closed });
  loop([[-170, 45], [150, 45], [150, -45], [-170, -45]]);
  { const arc = (from, to, n) => { const pts = []; for (let i = 0; i <= n; i++) { const f = (from + (to - from) * i / n) * Math.PI / 180; pts.push([16.25 * Math.sin(f), 90 - 16.25 * Math.cos(f)]); } return pts; };
    loop([[0, 45], [0, 66], ...arc(28, 152, 6), [0, 114], [0, 120], [200, 120], [200, 45]]); W.traffic[W.traffic.length - 1].oneWay = true;
    W.trafficExtra = [[[200, 45], [200, 120], [0, 120], [0, 114], ...arc(-152, -28, 6), [0, 66], [0, 45]]]; }
  loop([[0, -50], [0, -240]]); loop([[200, 48], [200, 136]]);
  loop([[-310, -310], [310, -310], [310, 310], [-310, 310]]);
  { const ring = []; for (let i = 0; i < 32; i++) { const a = -i / 32 * 6.2832; ring.push([200 + Math.cos(a) * 38, 170 + Math.sin(a) * 38]); } loop(ring); W.traffic[W.traffic.length - 1].y = 8.6; W.traffic[W.traffic.length - 1].neon = true; }
  for (const pts of W.trafficExtra || []) { loop(pts); Object.assign(W.traffic[W.traffic.length - 1], { oneWay: true, pool: 1 }); }
  W.boats = [
    { x: -60, z: -8, baseZ: -8, sp: 4.8, ph: 0.0 },
    { x: 60, z: 14, baseZ: 14, sp: -4.2, ph: 1.5 },
    { x: 220, z: -4, baseZ: -4, sp: 5.2, ph: 3.1 },
    { x: -240, z: 10, baseZ: 10, sp: -4.5, ph: 4.8 },
    { x: -150, z: 6, baseZ: 6, sp: 4.4, ph: 2.2 },
    { x: 130, z: -14, baseZ: -14, sp: -5.0, ph: 5.5 },
    { x: -320, z: -12, baseZ: -12, sp: 4.6, ph: 0.8 },
    { x: 320, z: 18, baseZ: 18, sp: -4.3, ph: 3.9 }
  ];
  return G;
}

// Separate river water geometry for crystal-clear optical transmission & water creature visibility
function buildWaterGeo() {
  const G = new Geo();
  // Tessellate water plane into quads along the river channel (-700 to 700 in X, -32 to 32 in Z)
  for (let x = -700; x < 700; x += 35) {
    G.flat(x, -32, Math.min(x + 35, 700), 32, W.waterY, hex('#5B9CC4'), 3);
  }
  return G;
}
