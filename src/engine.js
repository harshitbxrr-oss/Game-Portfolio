'use strict';
// ============================================================
// ENGINE — raw WebGL2: math, geometry builder, shaders, bloom
// ============================================================
const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; },
  lookAt(e, c, up) {
    const z = V3.norm(V3.sub(e, c)), x = V3.norm(V3.cross(up, z)), y = V3.cross(z, x), m = new Float32Array(16);
    m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[8] = x[2]; m[9] = y[2]; m[10] = z[2];
    m[12] = -V3.dot(x, e); m[13] = -V3.dot(y, e); m[14] = -V3.dot(z, e); m[15] = 1; return m;
  },
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  inv(m) {
    const inv = new Float32Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12]; det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) inv[i] *= det; return inv;
  },
  // translate * Ry(yaw) * Rx(pitch) * Rz(roll) * scale.  Forward of a model = local -Z.
  model(x, y, z, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = sx, sz = sx, out = null) {
    const cy = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    const m = out || new Float32Array(16); m[3] = 0; m[7] = 0; m[11] = 0;
    m[0] = (cy * cr + sy_ * sp * sr) * sx; m[1] = (cp * sr) * sx; m[2] = (-sy_ * cr + cy * sp * sr) * sx;
    m[4] = (-cy * sr + sy_ * sp * cr) * sy; m[5] = (cp * cr) * sy; m[6] = (sy_ * sr + cy * sp * cr) * sy;
    m[8] = (sy_ * cp) * sz; m[9] = (-sp) * sz; m[10] = (cy * cp) * sz;
    m[12] = x; m[13] = y; m[14] = z; m[15] = 1; return m;
  },
  trans(x, y, z) { return M4.model(x, y, z); },
  rotY(a) { return M4.model(0, 0, 0, a); },
  xf(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
};

// ---------- Geometry builder (flat-shaded, per-vertex colour + material) ----------
// material ids: 0 matte, 1 emissive, 2 glass tower, 3 water, 4 car paint, 5 carbon, 6 glass,
//               7 road, 8 building w/ windows, 9 foliage, 10 ground
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.m = []; this.T = null; }
  _t(p) { return this.T ? M4.xf(this.T, p) : p; }
  _push(v, n, col, mat, em) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0], col[1], col[2]); this.m.push(mat, em); }
  quad(a, b, c, d, col, mat = 0, em = 0, center = null) {
    a = this._t(a); b = this._t(b); c = this._t(c); d = this._t(d);
    let n = V3.cross(V3.sub(b, a), V3.sub(c, a)); if (V3.len(n) < 1e-9) n = V3.cross(V3.sub(c, a), V3.sub(d, a)); n = V3.norm(n);
    if (center) { const ct = this._t(center), fc = V3.scale(V3.add(V3.add(a, b), V3.add(c, d)), 0.25); if (V3.dot(n, V3.sub(fc, ct)) < 0) n = V3.scale(n, -1); }
    for (const v of [a, b, c, a, c, d]) this._push(v, n, col, mat, em);
  }
  tri(a, b, c, col, mat = 0, em = 0, up = null) {
    a = this._t(a); b = this._t(b); c = this._t(c);
    let n = V3.norm(V3.cross(V3.sub(b, a), V3.sub(c, a))); if (up && V3.dot(n, up) < 0) n = V3.scale(n, -1);
    for (const v of [a, b, c]) this._push(v, n, col, mat, em);
  }
  // 8 corners: fbl fbr ftl ftr bbl bbr btl btr (f = -z end, b = +z end)
  hexa(C, col, mat = 0, em = 0, colTop = null) {
    const ctr = [0, 0, 0]; for (const v of C) { ctr[0] += v[0] / 8; ctr[1] += v[1] / 8; ctr[2] += v[2] / 8; }
    const [fbl, fbr, ftl, ftr, bbl, bbr, btl, btr] = C;
    this.quad(fbl, fbr, bbr, bbl, col, mat, em, ctr);
    this.quad(ftl, ftr, btr, btl, colTop || col, mat, em, ctr);
    this.quad(fbl, fbr, ftr, ftl, col, mat, em, ctr);
    this.quad(bbl, bbr, btr, btl, col, mat, em, ctr);
    this.quad(fbl, bbl, btl, ftl, col, mat, em, ctr);
    this.quad(fbr, bbr, btr, ftr, col, mat, em, ctr);
  }
  box(cx, cy, cz, sx, sy, sz, col, mat = 0, em = 0, yaw = 0, colTop = null) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    this.hexa([P(-hx, -hy, -hz), P(hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(-hx, hy, hz), P(hx, hy, hz)], col, mat, em, colTop);
  }
  // box from y0 up (common for buildings)
  block(x0, z0, x1, z1, y0, y1, col, mat = 0, em = 0, colTop = null) { this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, mat, em, 0, colTop); }
  beam(p1, p2, w, col, mat = 0, em = 0, h = w) {
    const d = V3.norm(V3.sub(p2, p1)); const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = V3.scale(V3.norm(V3.cross(d, up)), w / 2), v = V3.scale(V3.norm(V3.cross(u, d)), h / 2);
    const k = (p, a, b) => V3.add(V3.add(p, V3.scale(u, a)), V3.scale(v, b));
    this.hexa([k(p1, -1, -1), k(p1, 1, -1), k(p1, -1, 1), k(p1, 1, 1), k(p2, -1, -1), k(p2, 1, -1), k(p2, -1, 1), k(p2, 1, 1)], col, mat, em);
  }
  // vertical prism/frustum. star: inner radius factor for alternate vertices (ribbed look)
  prism(cx, cy, cz, rb, rt, h, seg, col, mat = 0, em = 0, o = {}) {
    const star = o.star || 1, rot = o.rot || 0, caps = o.caps !== false, colTop = o.colTop || col;
    const ring = (r, y) => { const a = []; for (let i = 0; i < seg; i++) { const t = rot + i / seg * Math.PI * 2, rr = (i % 2 && star !== 1) ? r * star : r; a.push([cx + Math.cos(t) * rr, y, cz + Math.sin(t) * rr]); } return a; };
    const B = ring(rb, cy), T = ring(rt, cy + h), ctr = [cx, cy + h / 2, cz];
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.quad(B[i], B[j], T[j], T[i], col, mat, em, ctr); }
    if (caps) { const tc = [cx, cy + h, cz], bc = [cx, cy, cz]; for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; if (rt > 0.001) this.tri(T[i], T[j], tc, colTop, mat, em, [0, 1, 0]); this.tri(B[i], B[j], bc, col, mat, em, [0, -1, 0]); } }
  }
  // cylinder along X axis (wheels), centred
  cylX(cx, cy, cz, r, w, seg, col, mat = 0, em = 0) {
    const L = [], R = [];
    for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2; L.push([cx - w / 2, cy + Math.cos(t) * r, cz + Math.sin(t) * r]); R.push([cx + w / 2, cy + Math.cos(t) * r, cz + Math.sin(t) * r]); }
    const ctr = [cx, cy, cz];
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.quad(L[i], L[j], R[j], R[i], col, mat, em, ctr); this.tri(L[i], L[j], [cx - w / 2, cy, cz], col, mat, em, [-1, 0, 0]); this.tri(R[i], R[j], [cx + w / 2, cy, cz], col, mat, em, [1, 0, 0]); }
  }
  // cylinder along Z axis (creature bodies, torsos, necks & tails)
  cylZ(cx, cy, cz, rx, ry, l, seg, col, mat = 0, em = 0, o = {}) {
    const B = [], F = [];
    const scaleFront = o.scaleFront || 1.0;
    const rfx = rx * scaleFront, rfy = ry * scaleFront;
    for (let i = 0; i < seg; i++) {
      const t = i / seg * Math.PI * 2;
      const cosT = Math.cos(t), sinT = Math.sin(t);
      B.push([cx + cosT * rx, cy + sinT * ry, cz - l / 2]);
      F.push([cx + cosT * rfx, cy + sinT * rfy, cz + l / 2]);
    }
    const ctr = [cx, cy, cz];
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.quad(B[i], B[j], F[j], F[i], col, mat, em, ctr);
    }
    if (o.caps !== false) {
      const fc = [cx, cy, cz + l / 2], bc = [cx, cy, cz - l / 2];
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        this.tri(F[i], F[j], fc, col, mat, em, [0, 0, 1]);
        this.tri(B[j], B[i], bc, col, mat, em, [0, 0, -1]);
      }
    }
  }
  // curved-edge cuboidal cylinder along Z axis (rounded cuboid / stadium cylinder)
  curvBoxZ(cx, cy, cz, wx, wy, l, cr, col, mat = 0, em = 0, o = {}) {
    const hx = wx / 2, hy = wy / 2;
    const r = Math.min(cr !== undefined ? cr : Math.min(hx, hy) * 0.35, hx * 0.85, hy * 0.85);
    const segCorner = o.segCorner || 3;
    const pts = [];
    const corners = [
      { cx: hx - r, cy: hy - r, a0: 0, a1: Math.PI / 2 },
      { cx: -hx + r, cy: hy - r, a0: Math.PI / 2, a1: Math.PI },
      { cx: -hx + r, cy: -hy + r, a0: Math.PI, a1: Math.PI * 1.5 },
      { cx: hx - r, cy: -hy + r, a0: Math.PI * 1.5, a1: Math.PI * 2 }
    ];
    for (let ci = 0; ci < 4; ci++) {
      const c = corners[ci];
      for (let s = 0; s < segCorner; s++) {
        const a = c.a0 + (c.a1 - c.a0) * (s / segCorner);
        pts.push([c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r]);
      }
    }
    const N = pts.length;
    const sfx = o.scaleFrontX !== undefined ? o.scaleFrontX : (o.scaleFront !== undefined ? o.scaleFront : 1.0);
    const sfy = o.scaleFrontY !== undefined ? o.scaleFrontY : (o.scaleFront !== undefined ? o.scaleFront : 1.0);
    const sbx = o.scaleBackX !== undefined ? o.scaleBackX : (o.scaleBack !== undefined ? o.scaleBack : 1.0);
    const sby = o.scaleBackY !== undefined ? o.scaleBackY : (o.scaleBack !== undefined ? o.scaleBack : 1.0);
    const dfx = o.offFrontX || 0, dfy = o.offFrontY || 0;
    const dbx = o.offBackX || 0, dby = o.offBackY || 0;

    const F = [], B = [];
    for (let i = 0; i < N; i++) {
      F.push([cx + dfx + pts[i][0] * sfx, cy + dfy + pts[i][1] * sfy, cz - l / 2]);
      B.push([cx + dbx + pts[i][0] * sbx, cy + dby + pts[i][1] * sby, cz + l / 2]);
    }
    const ctr = [cx, cy, cz];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const c = (o.colTop && (pts[i][1] + pts[j][1]) > hy * 0.3) ? o.colTop : col;
      this.quad(F[i], F[j], B[j], B[i], c, mat, em, ctr);
    }
    if (o.caps !== false) {
      const fc = [cx + dfx, cy + dfy, cz - l / 2];
      const bc = [cx + dbx, cy + dby, cz + l / 2];
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        this.tri(F[j], F[i], fc, o.colFront || col, mat, em, [0, 0, -1]);
        this.tri(B[i], B[j], bc, col, mat, em, [0, 0, 1]);
      }
    }
  }
  // flat horizontal ring (annulus) at height y
  annulus(cx, y, cz, r0, r1, seg, col, mat = 0, em = 0, a0 = 0, a1 = Math.PI * 2) {
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + (a1 - a0) * i / seg, t1 = a0 + (a1 - a0) * (i + 1) / seg;
      const p = (r, t) => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r];
      this.quad(p(r0, t0), p(r1, t0), p(r1, t1), p(r0, t1), col, mat, em, [cx, y - 1, cz]);
    }
  }
  disc(cx, y, cz, r, seg, col, mat = 0, em = 0) { for (let i = 0; i < seg; i++) { const t0 = i / seg * 6.2832, t1 = (i + 1) / seg * 6.2832; this.tri([cx, y, cz], [cx + Math.cos(t0) * r, y, cz + Math.sin(t0) * r], [cx + Math.cos(t1) * r, y, cz + Math.sin(t1) * r], col, mat, em, [0, 1, 0]); } }
  flat(x0, z0, x1, z1, y, col, mat = 10, em = 0) { this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col, mat, em, [(x0 + x1) / 2, y - 1, (z0 + z1) / 2]); }
  // oriented flat strip between two points on the ground (roads)
  strip(a, b, w, y, col, mat = 7, em = 0) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
    this.quad([a[0] + nx, y, a[1] + nz], [b[0] + nx, y, b[1] + nz], [b[0] - nx, y, b[1] - nz], [a[0] - nx, y, a[1] - nz], col, mat, em, [a[0], y - 1, a[1]]);
  }
  get count() { return this.p.length / 3; }
}

// ---------- GL helpers ----------
let gl;
function compile(vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s.split('\n').slice(0, 5).join('\n')); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function geoToMesh(g) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const add = (arr, loc, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
  add(g.p, 0, 3); add(g.n, 1, 3); add(g.c, 2, 3); add(g.m, 3, 2);
  gl.bindVertexArray(null); return { vao, count: g.count };
}
function dynMesh(layout) { // layout: [[loc,size],...] interleaved
  const vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const stride = layout.reduce((s, l) => s + l[1], 0) * 4; let off = 0;
  for (const [loc, size] of layout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off); off += size * 4; }
  gl.bindVertexArray(null); return { vao, buf, count: 0, floatsPerVert: stride / 4 };
}
function uploadDyn(m, data, n) { gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * m.floatsPerVert), gl.DYNAMIC_DRAW); m.count = n; }
function texFromCanvas(cv) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) { const maxAniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 16; gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, maxAniso)); }
  return t;
}

// ---------- Shaders ----------
const SH = {};
SH.mainVS = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nor; layout(location=2) in vec3 a_col; layout(location=3) in vec2 a_mat;
uniform mat4 u_vp, u_model;
out vec3 v_wpos, v_nor, v_col, v_opos; out vec2 v_mat;
void main(){ vec4 w=u_model*vec4(a_pos,1.); v_wpos=w.xyz; v_opos=a_pos; v_nor=mat3(u_model)*a_nor; v_col=a_col; v_mat=a_mat; gl_Position=u_vp*w; }`;
SH.mainFS = `#version 300 es
precision highp float;
in vec3 v_wpos, v_nor, v_col, v_opos; in vec2 v_mat;
uniform vec3 u_cam, u_sunDir, u_sunCol, u_ambSky, u_ambGnd, u_fogCol, u_skyTop, u_skyHor, u_water, u_colMul;
uniform vec2 u_fog; uniform float u_time, u_night, u_wet, u_emis, u_emisMul, u_fill;
uniform vec4 u_spot[4]; uniform vec3 u_spotCol; uniform float u_spotOn; uniform vec4 u_pt; uniform vec3 u_ptCol;
out vec4 o;

// ---------- Fast procedural PBR noise & texture helpers ----------
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  return 0.55 * vnoise(p) + 0.30 * vnoise(p * 2.1) + 0.15 * vnoise(p * 4.3);
}

vec3 env(vec3 r){
  vec3 sky = mix(u_skyHor, u_skyTop, clamp(r.y * 1.5 + 0.08, 0.0, 1.0)) + u_skyHor * 0.32 * smoothstep(0.16, 0.0, r.y);
  float sunSpec = pow(max(dot(r, normalize(u_sunDir)), 0.0), 30.0) * 1.5;
  sky += u_sunCol * sunSpec;
  vec3 gnd = mix(u_ambGnd * 0.85 + u_fogCol * 0.15, u_skyHor * 0.55, smoothstep(-0.35, 0.0, r.y));
  return r.y >= 0.0 ? sky : gnd;
}

void main(){
  int id = int(v_mat.x + 0.5); float em = v_mat.y;
  vec3 N = normalize(v_nor), V = normalize(u_cam - v_wpos);
  if(dot(N, V) < 0.0) N = -N;
  vec3 base = v_col * u_colMul, emis = vec3(0.0);
  float spec = 0.08, shin = 16.0, refl = 0.0, flake = 0.0, chromeK = 0.0, outAlpha = 1.0;

  // 1. EMISSIVE NEON & LAMPS
  if(id == 1){
    emis = base * em * u_emis * u_emisMul;
    base *= 0.25;
  }

  // 2. BUILDINGS: SKYSCRAPERS & ARCHITECTURAL GLASS
  else if(id == 2){
    if(abs(N.y) < 0.5){
      vec2 uv = abs(N.x) > 0.5 ? vec2(v_wpos.z, v_wpos.y) : vec2(v_wpos.x, v_wpos.y);
      vec2 g = uv / vec2(2.1, 3.4); vec2 f = fract(g); vec2 c = floor(g);
      // Realistic extruded aluminum mullions
      float mx = min(f.x, 1.0 - f.x) * 2.1;
      float my = min(f.y, 1.0 - f.y) * 3.4;
      float isMullion = step(min(mx, my), 0.11);

      // Architectural glass panel pillowing & micro-curvature
      vec2 pillow = (f - 0.5) * 0.04;
      vec3 bumpN = normalize(N + (abs(N.x) > 0.5 ? vec3(0.0, pillow.y, pillow.x) : vec3(pillow.x, pillow.y, 0.0)));
      N = mix(bumpN, N, isMullion);

      // Glass tint & interior variation
      vec3 glassTint = base * 0.55 + vec3(0.05, 0.12, 0.18);
      vec3 mullionCol = vec3(0.14, 0.17, 0.22);
      base = mix(glassTint, mullionCol, isMullion);

      // Night room lights with warm and cool office tones + blinds
      float lit = step(0.58, hash(c + floor(v_wpos.xz * 0.02) * 7.1));
      float blind = 0.75 + 0.25 * sin(f.y * 36.0);
      vec3 roomCol = mix(vec3(1.0, 0.88, 0.65), vec3(0.55, 0.82, 1.0), hash(c * 1.7));
      emis += (1.0 - isMullion) * lit * u_night * roomCol * blind * 0.9;

      refl = (1.0 - isMullion) * 0.72 + isMullion * 0.18;
      spec = mix(2.2, 0.6, isMullion);
      shin = mix(180.0, 45.0, isMullion);
    } else {
      // Skyscraper roof gravel
      base *= 0.88 + 0.12 * vnoise(v_wpos.xz * 6.0);
      spec = 0.15; shin = 18.0;
    }
  }

  // 3. WATER: ULTRA-REALISTIC OMNIDIRECTIONAL FLUID RIVER DYNAMICS
  // Active, visible flowing fluid movement: Left-to-Right, Right-to-Left, Forth and Back cross-swells
  else if(id == 3){
    vec2 p = v_wpos.xz; // p.x is downstream longitudinal axis (-700 to +700), p.y is river width (-32 to +32)

    // Parabolic velocity gradient: rapid flow in center deep channel, boundary-layer drag near banks
    float channelDist = clamp(abs(p.y) / 32.0, 0.0, 1.0);
    float streamSpeed = mix(3.6, 1.6, smoothstep(0.12, 0.90, channelDist));

    // Dynamic vorticity & lateral fluid shear (turbulent vortices curling along the edges)
    float shearCurl = sin(p.x * 0.12 + u_time * 1.8) * cos(p.y * 0.20 - u_time * 1.4);
    vec2 eddy = vec2(-shearCurl * 1.2, shearCurl * 0.95) * channelDist;

    // --- 1. PRIMARY CARDINAL WAVE CURRENTS ---
    // A. Left-to-Right (+X downstream dominant river current)
    vec2 d_LR = vec2(1.0, 0.06);
    // B. Right-to-Left (-X upstream eddy & back-swirl)
    vec2 d_RL = vec2(-0.95, -0.08);
    // C. Forth (+Z South-to-North cross-bank swell)
    vec2 d_FB = vec2(0.08, 0.98);
    // D. Back (-Z North-to-South reflective wash)
    vec2 d_BF = vec2(-0.06, -0.98);

    // --- 2. VICE-VERSA DIAGONAL CROSS-CURRENTS ---
    vec2 d_D1 = vec2(0.72, 0.69);
    vec2 d_D2 = vec2(-0.70, 0.71);
    vec2 d_D3 = vec2(0.71, -0.70);
    vec2 d_D4 = vec2(-0.72, -0.69);

    // Dynamic wave phases with energetic, visible traveling velocities
    float w_lr = dot(p + eddy, d_LR) * 0.42 - u_time * (streamSpeed * 1.65);
    float w_rl = dot(p, d_RL) * 0.52 - u_time * 1.85;
    float w_fb = dot(p, d_FB) * 0.78 - u_time * 2.35;
    float w_bf = dot(p, d_BF) * 0.74 - u_time * 2.10;

    float w_d1 = dot(p + eddy * 0.5, d_D1) * 0.95 - u_time * (streamSpeed * 1.2 + 1.4);
    float w_d2 = dot(p, d_D2) * 0.90 - u_time * 1.95;
    float w_d3 = dot(p, d_D3) * 1.18 - u_time * (streamSpeed * 1.1 + 1.5);
    float w_d4 = dot(p, d_D4) * 1.10 - u_time * 1.75;

    // Gerstner Trochoidal Wave Elevation Profiles
    float s_lr = sin(w_lr) * 0.5 + 0.5, p_lr = pow(s_lr, 2.2);
    float s_rl = sin(w_rl) * 0.5 + 0.5, p_rl = pow(s_rl, 2.0);
    float s_fb = sin(w_fb) * 0.5 + 0.5, p_fb = pow(s_fb, 2.4);
    float s_bf = sin(w_bf) * 0.5 + 0.5, p_bf = pow(s_bf, 2.2);

    float s_d1 = sin(w_d1) * 0.5 + 0.5, p_d1 = pow(s_d1, 2.4);
    float s_d2 = sin(w_d2) * 0.5 + 0.5, p_d2 = pow(s_d2, 2.2);
    float s_d3 = sin(w_d3) * 0.5 + 0.5, p_d3 = pow(s_d3, 2.4);
    float s_d4 = sin(w_d4) * 0.5 + 0.5, p_d4 = pow(s_d4, 2.2);

    // Summed wave height elevation across all opposing and diagonal currents
    float waveElev = (p_lr * 0.36 + p_rl * 0.16 + p_fb * 0.22 + p_bf * 0.18 + p_d1 * 0.14 + p_d2 * 0.12 + p_d3 * 0.10 + p_d4 * 0.10);

    // Continuous Gerstner surface slope derivatives (bold amplitude for clear, visible light distortion)
    float der_lr = cos(w_lr) * pow(s_lr, 1.2) * 0.32;
    float der_rl = cos(w_rl) * pow(s_rl, 1.0) * 0.15;
    float der_fb = cos(w_fb) * pow(s_fb, 1.4) * 0.24;
    float der_bf = cos(w_bf) * pow(s_bf, 1.2) * 0.20;

    float der_d1 = cos(w_d1) * pow(s_d1, 1.4) * 0.14;
    float der_d2 = cos(w_d2) * pow(s_d2, 1.2) * 0.12;
    float der_d3 = cos(w_d3) * pow(s_d3, 1.4) * 0.11;
    float der_d4 = cos(w_d4) * pow(s_d4, 1.2) * 0.10;

    // High-frequency capillary liquid skin micro-ripples visibly streaming downstream
    vec2 flowUV1 = vec2(p.x * 0.95 - u_time * 3.2, p.y * 1.40 + u_time * 1.1);
    vec2 flowUV2 = vec2(p.x * 1.15 + u_time * 2.2, p.y * 1.30 - u_time * 1.4);
    vec2 flowUV3 = vec2((p.x + p.y) * 1.5 - u_time * 2.8, (p.x - p.y) * 1.5 + u_time * 2.4);
    float cap1 = vnoise(flowUV1) * 2.0 - 1.0;
    float cap2 = vnoise(flowUV2) * 2.0 - 1.0;
    float cap3 = vnoise(flowUV3) * 2.0 - 1.0;
    float capDerX = (cap1 * 0.85 - cap2 * 0.65 + cap3 * 0.60) * 0.08;
    float capDerZ = (cap1 * 0.60 + cap2 * 0.95 - cap3 * 0.55) * 0.08;

    // Combined normal slope with strong primary downstream current and active cross-swells
    float dX = d_LR.x * der_lr + d_RL.x * der_rl + d_FB.x * der_fb + d_BF.x * der_bf
             + d_D1.x * der_d1 + d_D2.x * der_d2 + d_D3.x * der_d3 + d_D4.x * der_d4 + capDerX;
    float dZ = d_LR.y * der_lr + d_RL.y * der_rl + d_FB.y * der_fb + d_BF.y * der_bf
             + d_D1.y * der_d1 + d_D2.y * der_d2 + d_D3.y * der_d3 + d_D4.y * der_d4 + capDerZ;
    N = normalize(vec3(-dX * 2.8, 1.0, -dZ * 2.8));

    // Optical depth absorption & crystal-clear turquoise river water
    vec3 deepWater    = mix(vec3(0.045, 0.30, 0.46), vec3(0.015, 0.12, 0.24), u_night);
    vec3 shallowWater = mix(vec3(0.09, 0.54, 0.62), vec3(0.035, 0.26, 0.38), u_night);
    vec3 crestTrans   = mix(vec3(0.24, 0.80, 0.88), vec3(0.08, 0.38, 0.50), u_night);

    vec3 waterTint = mix(deepWater, shallowWater, smoothstep(0.10, 0.88, channelDist));
    waterTint += crestTrans * clamp(waveElev * 1.5, 0.0, 1.0) * 0.42 * (1.0 - u_night);

    // Drifting sunlight caustic webs streaming along the river
    vec2 caust1 = (p - vec2(u_time * 2.8, u_time * 0.7)) * 0.42;
    vec2 caust2 = (p + vec2(u_time * 2.1, -u_time * 0.9)) * 0.58;
    vec2 caust3 = (vec2(p.x + p.y, p.x - p.y) * 0.5 + vec2(-u_time * 1.8, u_time * 1.8)) * 0.48;
    float cn1 = vnoise(caust1), cn2 = vnoise(caust2), cn3 = vnoise(caust3);
    float caustic = pow(clamp(1.0 - abs(cn1 - cn2) * 2.4 - abs(cn2 - cn3) * 1.5, 0.0, 1.0), 2.5) * (1.0 - channelDist * 0.48);
    vec3 causticCol = vec3(0.30, 0.72, 0.82) * caustic * (1.0 - u_night);

    // Constructive clash whitecaps & shoreline surf
    float waveClash = smoothstep(0.68, 0.94, s_lr * 0.5 + s_rl * 0.4 + s_fb * 0.35 + s_bf * 0.35);
    float foamStreak = vnoise(vec2(p.x * 2.8 - u_time * 3.4, p.y * 3.8 + u_time * 1.5));
    float crestFoam = waveClash * smoothstep(0.50, 0.82, foamStreak) * 0.72;

    float shoreZone = smoothstep(26.0, 31.8, abs(p.y));
    float lappingWave = sin(p.x * 0.85 + u_time * 3.8 + sin(p.y * 0.8)) * 0.5 + 0.5;
    float shoreFoam = smoothstep(0.42, 0.80, vnoise(vec2(p.x * 2.8 - u_time * 2.6, p.y * 4.0 + u_time * 1.6))) * shoreZone * (0.60 + 0.40 * lappingWave);
    vec3 foamCol = vec3(0.94, 0.98, 1.0) * (shoreFoam * 0.90 + crestFoam * 0.65);

    base = waterTint + causticCol + foamCol;

    // Physical PBR Fresnel reflectivity & crystal clear aquatic translucency
    float cosTheta = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 4.0);
    refl = mix(0.35, 0.76, fresnel);

    // Water transparency: top-down / bank view is crystal-clear (0.38 alpha) so the swimming water serpent is clearly visible
    outAlpha = mix(0.38, 0.80, pow(1.0 - cosTheta, 2.8));
    outAlpha = clamp(outAlpha + (shoreFoam * 0.85 + crestFoam * 0.65) * 0.45, 0.0, 0.95);

    vec3 H = normalize(normalize(u_sunDir) + V);
    float sharpGlint = pow(max(dot(N, H), 0.0), 160.0) * 4.8;
    float broadGlitter = pow(max(dot(N, H), 0.0), 32.0) * 1.4;
    spec = 2.8 + sharpGlint + broadGlitter;
    shin = 88.0;
  }

  // 4. VEHICLE BODY PAINT: MULTI-LAYER METALLIC FLAKE & CLEARCOAT
  else if(id == 4){
    float nv = max(dot(N, V), 0.0);
    // Pearlescent flip-flop base
    vec3 flipFlop = base * vec3(0.85, 0.95, 1.25) + vec3(0.06, 0.02, 0.16);
    base = mix(base, flipFlop, pow(1.0 - nv, 2.5) * 0.65);

    // Glittering metallic flake noise
    vec3 flk = floor(v_opos * 110.0);
    flake = step(0.92, hash(flk.xy + flk.z * 19.31));

    // Dual-coat PBR clearcoat
    spec = 2.4; shin = 260.0;
    refl = 0.42 + 0.58 * pow(1.0 - nv, 4.0);
  }

  // 5. CARBON FIBER WEAVE (Splitters, diffusers, spoiler wings)
  else if(id == 5){
    vec3 an = abs(N);
    vec2 cuv = (an.x > an.y && an.x > an.z ? v_opos.zy : (an.y > an.z ? v_opos.xz : v_opos.xy)) * 95.0;
    vec2 g = floor(cuv);
    float twill = mod(g.x + g.y, 2.0);
    float weaveSheen = 0.92 + 0.08 * sin(fract(cuv.x + cuv.y) * 6.2832);
    base = mix(vec3(0.06, 0.07, 0.09), vec3(0.14, 0.15, 0.18), twill) * weaveSheen;
    spec = 1.4; shin = 120.0; refl = 0.28;
  }

  // 6. VEHICLE GLASS (Windshield, headlights)
  else if(id == 6){
    float nv = max(dot(N, V), 0.0);
    refl = 0.25 + 0.75 * pow(1.0 - nv, 4.0);
    spec = 2.8; shin = 220.0;
  }

  // 7. ROADS & ASPHALT: AGGREGATE TEXTURE, TIRE WEAR & WET PUDDLES
  else if(id == 7){
    // Multi-octave asphalt aggregate stone noise
    float stoneGrain = vnoise(v_wpos.xz * 22.0) * 0.16 + vnoise(v_wpos.xz * 64.0) * 0.09;
    float mineralSpeck = step(0.88, hash(floor(v_wpos.xz * 48.0))) * 0.15;
    base = base * (0.86 + stoneGrain + mineralSpeck);

    // Micro-roughness bump on asphalt
    vec2 dAsphalt = (hash2(floor(v_wpos.xz * 32.0)) - 0.5) * 0.05;
    N = normalize(N + vec3(dAsphalt.x, 0.0, dAsphalt.y));

    // Wet puddles with smooth water reflections
    float puddleNoise = smoothstep(0.48, 0.72, fbm(v_wpos.xz * 0.16));
    float puddle = puddleNoise * u_wet;
    base *= mix(1.0, 0.55, max(u_wet * 0.7, puddle));
    spec = mix(0.18, 2.8, max(u_wet * 0.4, puddle));
    shin = mix(22.0, 240.0, puddle);
    refl = mix(0.0, 0.65, puddle);
    if(puddle > 0.3) N = mix(N, vec3(0.0, 1.0, 0.0), smoothstep(0.3, 0.7, puddle));
  }

  // 8. HERITAGE ARCHITECTURE & HAVELIS (Ashlar stone courses & warm carved windows)
  else if(id == 8){
    // Ashlar stone masonry course lines
    float course = smoothstep(0.04, 0.09, abs(fract(v_wpos.y * 1.35) - 0.5));
    float stoneNoise = fbm(v_wpos.xz * 3.5 + v_wpos.y * 1.8);
    base *= (0.88 + 0.22 * stoneNoise) * (0.90 + 0.10 * course);

    // Arched windows with warm interior lamplight
    if(abs(N.y) < 0.5 && v_wpos.y > 2.8){
      vec2 uv = abs(N.x) > 0.5 ? vec2(v_wpos.z, v_wpos.y) : vec2(v_wpos.x, v_wpos.y);
      vec2 g = uv / vec2(2.8, 3.2); vec2 f = fract(g); vec2 c = floor(g);
      float win = step(0.28, f.x) * step(f.x, 0.72) * step(0.22, f.y) * step(f.y, 0.82);
      base = mix(base, base * 0.22, win * 0.95);
      float lit = step(0.55, hash(c + floor(v_wpos.xz * 0.07) * 3.1));
      emis += win * lit * u_night * vec3(1.0, 0.75, 0.42) * 1.1;
      spec = mix(0.10, 0.8, win); shin = mix(14.0, 90.0, win);
    }
  }

  // 9. TREES & FOLIAGE: SUBSURFACE SCATTERING & ORGANIC CANOPY
  else if(id == 9){
    // Procedural leaf cluster micro-normals
    vec2 lHash = hash2(floor(v_wpos.xz * 9.0 + v_wpos.y * 7.0));
    vec3 leafBump = vec3((lHash.x - 0.5) * 0.38, (lHash.y - 0.5) * 0.25, (lHash.x + lHash.y - 1.0) * 0.38);
    N = normalize(N + leafBump);

    // Natural canopy gradient
    float heightT = smoothstep(1.5, 7.5, v_wpos.y);
    float leafNoise = vnoise(v_wpos.xz * 3.2 + v_wpos.y * 2.0);
    vec3 freshLeaves = base * vec3(1.18, 1.25, 0.88);
    vec3 deepLeaves = base * vec3(0.82, 0.88, 0.75);
    base = mix(deepLeaves, freshLeaves, heightT * 0.6 + leafNoise * 0.4);

    spec = 0.28; shin = 28.0;
  }

  // 10. GROUND, STONE, PAVING & PALACE COURTYARDS
  else if(id == 10){
    float stoneNoise = fbm(v_wpos.xz * 2.8);
    float tileCourse = 0.94 + 0.06 * smoothstep(0.04, 0.08, abs(fract(v_wpos.x * 0.8) - 0.5)) * smoothstep(0.04, 0.08, abs(fract(v_wpos.z * 0.8) - 0.5));
    base *= (0.86 + 0.26 * stoneNoise) * tileCourse;
    spec = 0.12; shin = 14.0;
  }

  // 11. MIRROR CHROME & METALLIC DETAILS
  else if(id == 11){
    base *= 0.15; spec = 3.6; shin = 320.0; chromeK = 0.92; refl = 0.95;
  }

  // 12. VULCANIZED RUBBER TIRES & MATTE TRIM
  else if(id == 12){
    base = vec3(0.09, 0.09, 0.10);
    spec = 0.12; shin = 12.0; refl = 0.03;
  }

  // 13. LUSH GRASS MEADOWS, LAWNS & OPEN FIELDS
  else if(id == 13 || (id == 10 && base.g > base.r * 0.92)){
    vec2 gp = v_wpos.xz;
    // 1. Broad meadow hue variation: clover patches, sun-kissed lawns, rich emerald turf
    float meadowPatch = fbm(gp * 0.12);
    vec3 lawnDark = vec3(0.20, 0.45, 0.14);
    vec3 lawnMid = vec3(0.28, 0.55, 0.18);
    vec3 lawnBright = vec3(0.36, 0.66, 0.22);
    vec3 grassColor = mix(lawnDark, lawnBright, meadowPatch);

    // 2. High-frequency grass blade stippling and micro-shadows
    float bladeNoise = vnoise(gp * 36.0) * 0.22 + vnoise(gp * 88.0) * 0.14;
    grassColor *= (0.85 + bladeNoise);

    // 3. Subtle scatter of wildflower buttercups & daisies in open fields
    float flowerHash = hash(floor(gp * 7.0));
    float isFlower = step(0.965, flowerHash);
    vec3 flowerCol = mix(vec3(1.0, 0.88, 0.3), vec3(0.96, 0.96, 1.0), hash(floor(gp * 7.0) + 7.1));
    grassColor = mix(grassColor, flowerCol, isFlower * 0.85);

    // 4. Lawn mower striping patterns in parks and central medians
    float stripes = 0.93 + 0.07 * sin(gp.x * 1.4 + gp.y * 0.5);
    base = grassColor * stripes;

    // Grass micro-roughness normal perturbation
    vec2 dGrass = (hash2(floor(gp * 28.0)) - 0.5) * 0.12;
    N = normalize(N + vec3(dGrass.x, 0.0, dGrass.y));

    // Soft velvety specular sheen (forward scattering)
    spec = 0.22; shin = 22.0;
  }

  // 14. DRAGON & LEVIATHAN REPTILIAN SCALES & BIOLUMINESCENT DRAGON SKIN (Photorealistic PBR Scale System)
  else if(id == 14){
    // Procedural diamond/hexagonal overlapping convex dragon scale lattice mapped over local geometry
    vec3 op = v_opos * 3.4;
    vec2 scUV = vec2(op.z * 1.8 + op.x * 0.9, op.y * 2.2 - op.x * 0.7);
    vec2 scGrid = fract(scUV) - 0.5;
    
    // Convex shingled scute height curve with rounded scale relief & keel ridge
    float scDist = max(abs(scGrid.x) * 0.866 + abs(scGrid.y) * 0.5, abs(scGrid.y));
    float scaleRim = smoothstep(0.34, 0.48, scDist);
    float scProfile = cos(clamp(scDist * 3.14159, 0.0, 3.14159)) * 0.5 + 0.5;
    float scaleHighlight = pow(clamp(1.0 - scDist * 1.6, 0.0, 1.0), 3.4);

    // Multi-wavelength thin-film chameleon iridescence depending on view angle
    float nv = clamp(dot(N, V), 0.0, 1.0);
    vec3 iridHue = 0.5 + 0.5 * cos(6.28318 * (vec3(0.12, 0.52, 0.92) * (1.0 - nv) + vec3(0.0, 0.33, 0.67)));
    vec3 iridShift = mix(base * 1.30 + iridHue * 0.22, base * 0.72 + vec3(0.02, 0.08, 0.14), pow(1.0 - nv, 2.5));
    base = mix(iridShift, base * 0.35, scaleRim);
    base += (base * 0.85 + vec3(0.35, 0.40, 0.45)) * scaleHighlight * (1.0 - scaleRim) * (0.55 + 0.45 * scProfile);

    // Organic scale micro-normal curvature & central keel ridge
    vec2 bump = scGrid * 0.42 * (1.0 - scaleRim);
    N = normalize(N + vec3(bump.x, bump.y, bump.x * 0.4));

    // Water serpent wet aquatic sheen & refractive dancing caustics (River proximity)
    if(v_wpos.y < 2.0){
      float waterProx = clamp((2.0 - v_wpos.y) * 0.25, 0.0, 1.0);
      // Dual-frequency crystalline sunlight caustics rippling across wet scales
      float caust1 = sin(v_wpos.x * 3.2 + u_time * 3.8) * cos(v_wpos.z * 3.2 - u_time * 3.2);
      float caust2 = sin(v_wpos.z * 4.5 + u_time * 4.2 + v_wpos.x * 1.8);
      float caust = pow(clamp(caust1 * 0.6 + caust2 * 0.4 + 0.40, 0.0, 1.0), 2.5);
      // Luminous cyan/aquamarine aquatic iridescence
      base += vec3(0.12, 0.65, 0.85) * caust * 0.85 * waterProx;
      // Soft aquatic depth tint - keeps serpent clear, luminous, and visible underwater!
      base = mix(base, vec3(0.04, 0.28, 0.38), clamp((-4.5 - v_wpos.y) * 0.15, 0.0, 0.40));
      // Bioluminescent lateral line photophores glow bright cyan
      if(em > 0.05){
        float bioPulse = 0.90 + 0.35 * sin(u_time * 2.8 + v_wpos.x * 0.8);
        emis += vec3(0.13, 0.83, 0.93) * em * bioPulse * 2.5;
      }
      // Ultra-high wet specular sheen & water reflection
      spec = mix(3.5, 6.2, waterProx);
      shin = mix(160.0, 260.0, waterProx);
      refl = mix(0.38, 0.68 + 0.32 * pow(1.0 - nv, 2.5), waterProx);
    } else {
      // Flying dragons: Vitreous obsidian stone sheen & rim lighting (Matching DragonObsidian.shader)
      float rimF = pow(1.0 - nv, 3.0);
      // Subtle cyan-blue obsidian rim glow matching character reference sheet
      base += vec3(0.15, 0.25, 0.35) * rimF * 0.65;
      spec = 4.5; shin = 220.0; refl = 0.45 + 0.50 * pow(1.0 - nv, 2.8);

      // Animated Magma fissures & glowing throat (Matching DragonVolcanic.shader)
      if(em > 0.05){
        if(base.r > 0.45 || em > 2.0){
          // Volcanic dragon animated magma fissures & throat glow
          float magmaWave = sin(u_time * 3.5 + v_wpos.x * 0.8 + v_wpos.z * 0.8) * 0.5 + 0.5;
          float magmaPulse = 1.0 + 0.45 * magmaWave;
          emis += vec3(1.0, 0.40, 0.04) * em * magmaPulse * u_emis * u_emisMul * 1.8;
        } else {
          // Astral bioluminescent photophore pulses
          float bioPulse = 0.85 + 0.32 * sin(u_time * 3.4 + v_wpos.x * 0.7 - v_wpos.z * 0.5);
          emis += base * em * bioPulse * u_emis * u_emisMul * 1.45;
        }
      }
    }
  }

  // 15. REALISTIC AVIAN FEATHERS & PLUMAGE (Directional Barb Micro-Texture, Downy Softness, Iridescence)
  else if(id == 15){
    vec3 bp = v_opos * 9.5;
    float barbNoise = vnoise(vec2(bp.z * 4.5 + abs(bp.x) * 3.2, bp.y * 5.5));
    float barbGroove = sin((bp.z * 14.0 + abs(bp.x) * 7.0) * 3.14159) * 0.5 + 0.5;

    // Soft feather vane micro-normals along wing airflow
    vec2 fv = (hash2(floor(bp.xz * 12.0)) - 0.5) * 0.16;
    N = normalize(N + vec3(fv.x, (barbGroove - 0.5) * 0.20, fv.y));

    // Downy plumage soft light diffusion & forward scattering
    float nv = clamp(dot(N, V), 0.0, 1.0);
    float featherRim = pow(1.0 - nv, 2.6);

    // Iridescent feather sheen on mantle and primary wing coverts
    vec3 sheen = 0.5 + 0.5 * cos(6.28318 * (vec3(0.12, 0.52, 0.88) * (1.0 - nv) + vec3(0.08, 0.28, 0.62)));
    base = mix(base * (0.86 + 0.24 * barbNoise), base + sheen * 0.22, featherRim * 0.60);

    // Velvety soft specular for plumage (diffuse wrap)
    spec = 0.42;
    shin = 26.0;
  }

  // 0. ARCHITECTURAL HERITAGE STONE, FORT WALLS, GATES & MASONRY (Every general building)
  else if(id == 0){
    if(abs(N.y) < 0.65){
      // Vertical facades: Ashlar stone course seams every 0.8m + quarried stone grain
      float course = smoothstep(0.04, 0.08, abs(fract(v_wpos.y * 1.25) - 0.5));
      float stoneGrain = fbm(v_wpos.xz * 3.8 + v_wpos.y * 1.6);
      base *= (0.86 + 0.28 * stoneGrain) * (0.92 + 0.08 * course);
      float groundAO = clamp((v_wpos.y - 0.2) / 3.5, 0.0, 1.0);
      base *= 0.82 + 0.18 * groundAO;
      spec = 0.14; shin = 18.0;
    } else {
      // Horizontal surfaces: fine paving or terrace concrete
      float terraceNoise = fbm(v_wpos.xz * 2.5);
      base *= 0.88 + 0.24 * terraceNoise;
      spec = 0.12; shin = 14.0;
    }
  }

  vec3 L = normalize(u_sunDir); float nd = max(dot(N, L), 0.0);
  vec3 amb = mix(u_ambGnd, u_ambSky, N.y * 0.5 + 0.5);
  vec3 col = base * (amb + u_sunCol * nd);
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  col += u_sunCol * pow(nh, shin) * spec * (0.3 + 0.7 * nd);

  // Tree & Foliage Subsurface Scattering (Backlit Sunlight Translucency)
  if(id == 9){
    float sss = pow(max(dot(-L, V), 0.0), 2.8) * 0.85;
    col += base * u_sunCol * vec3(0.55, 0.95, 0.25) * sss * (1.0 - u_night);
  }

  // Dragon & Leviathan Translucent Wing/Fin Subsurface Backlight
  if(id == 14){
    float sss = pow(max(dot(-L, V), 0.0), 2.8) * 0.95;
    vec3 tissueTint = mix(vec3(0.25, 0.88, 0.95), vec3(1.0, 0.42, 0.16), step(0.32, base.r));
    col += tissueTint * u_sunCol * sss * 1.35 * (1.0 - u_night);
  }

  // Bird Feather Translucent Subsurface Backlight (Sunlight glowing through flight feathers)
  if(id == 15){
    float sss = pow(max(dot(-L, V), 0.0), 2.4) * 0.82;
    vec3 featherTint = mix(vec3(0.96, 0.90, 0.75), base * 1.4, 0.45);
    col += featherTint * u_sunCol * sss * (1.0 - u_night);
  }


  // Car paint sparkling metallic flake
  if(id == 4){
    col += base * u_sunCol * pow(nh, 18.0) * 0.35 * nd + u_sunCol * flake * pow(nh, 32.0) * 1.5 * nd;
  }

  // PBR Environment Fresnel Reflections
  if(refl > 0.0){
    float fr = refl * (0.2 + 0.8 * pow(1.0 - max(dot(N, V), 0.0), 4.0));
    col = mix(col, env(reflect(-V, N)), fr);
  }

  // Mirror Chrome
  if(chromeK > 0.0){
    col = mix(col, env(reflect(-V, N)) * 1.15 + u_sunCol * pow(nh, 320.0) * 2.5, chromeK);
  }
  // the player's headlights (two spotlights) and a rear lamp glow light the world around the car
  if(u_spotOn>0.001){ for(int i=0;i<2;i++){ vec3 Lv=u_spot[i*2].xyz-v_wpos; float d=length(Lv); vec3 L=Lv/max(d,1e-3); float cone=smoothstep(u_spot[i*2+1].w,u_spot[i*2+1].w+0.09,dot(-L,u_spot[i*2+1].xyz)); float att=clamp(1.-d/u_spot[i*2].w,0.,1.); att*=att; float nl=clamp((dot(N,L)+0.25)/1.25,0.,1.);
    col+=(base*nl+u_spotCol*0.35*pow(max(dot(N,normalize(L+V)),0.),max(shin,8.))*spec)*u_spotCol*cone*att*u_spotOn; } }
  if(u_pt.w>0.01){ vec3 Lv=u_pt.xyz-v_wpos; float d=length(Lv); float att=clamp(1.-d/u_pt.w,0.,1.); att*=att; float nl=clamp((dot(N,Lv/max(d,1e-3))+0.3)/1.3,0.,1.); col+=base*u_ptCol*att*nl; }
  if(u_fill>0.){ float nv=max(dot(N,V),0.); col+=base*u_fill*(0.45+0.55*nv); if(id>=4&&id<=6) col+=u_fill*0.55*pow(1.-nv,3.)*mix(u_skyHor,vec3(1.),0.6); }
  col+=emis;
  float d=length(v_wpos-u_cam); float f=smoothstep(u_fog.x,u_fog.y,d);
  col=mix(col,u_fogCol,f*(1.-0.55*clamp(max(emis.r,max(emis.g,emis.b)),0.,1.)));
  float mx=max(col.r,max(col.g,col.b)); if(mx>1.) col=mix(col/mx,vec3(1.),clamp((mx-1.)*0.12,0.,0.3));
  o=vec4(col, outAlpha);
}`;
// textured quads: signs, labels, holograms
SH.texVS = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in vec2 a_uv;
uniform mat4 u_vp,u_model; out vec2 v_uv; out vec3 v_wpos;
void main(){ vec4 w=u_model*vec4(a_pos,1.); v_wpos=w.xyz; v_uv=a_uv; gl_Position=u_vp*w; }`;
SH.texFS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec3 v_wpos; uniform sampler2D u_tex; uniform float u_emis,u_alpha,u_mode,u_time; uniform vec3 u_cam,u_fogCol; uniform vec2 u_fog;
out vec4 o;
void main(){
  vec4 t=texture(u_tex,v_uv); vec3 c=t.rgb*u_emis; float a=t.a*u_alpha;
  if(u_mode>0.5 && u_mode<1.5){
    float scan=0.72+0.28*sin(v_uv.y*420.-u_time*7.);
    float fl=0.88+0.12*sin(u_time*31.)*sin(u_time*7.3);
    vec2 e=min(v_uv,1.-v_uv); float edge=min(e.x,e.y);
    vec2 cell=fract(v_uv*vec2(60.,140.))-0.5; float dots=step(length(cell),0.32);
    float frame=smoothstep(0.035,0.0,edge);
    c=mix(c,vec3(0.25,0.95,0.9)*1.3,0.35)*scan*fl + vec3(0.4,1.,0.95)*frame*1.2;
    a=(a*0.85+frame)*mix(1.,dots,smoothstep(0.08,0.0,edge))*fl;
  } else if(u_mode>=1.5){
    vec2 e=min(v_uv,1.-v_uv); float edge=min(e.x,e.y);
    float frame=smoothstep(0.010,0.0,edge);
    c = mix(c, vec3(0.2,0.85,1.0), frame * 0.75);
    a = 1.0;
  }
  float d=length(v_wpos-u_cam); float f=smoothstep(u_fog.x,u_fog.y,d)*0.6;
  c=mix(c,u_fogCol,f);
  float mx=max(c.r,max(c.g,c.b)); if(mx>1.) c=mix(c/mx,vec3(1.),clamp((mx-1.)*0.12,0.,0.3));
  o=vec4(c,a);
}`;
// flat coloured geometry (rings, tyre marks, trails, shadows)
SH.flatVS = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in vec4 a_col;
uniform mat4 u_vp,u_model; out vec4 v_col; out vec3 v_wpos;
void main(){ vec4 w=u_model*vec4(a_pos,1.); v_wpos=w.xyz; v_col=a_col; gl_Position=u_vp*w; }`;
SH.flatFS = `#version 300 es
precision highp float;
in vec4 v_col; in vec3 v_wpos; uniform vec4 u_colMul; uniform vec3 u_cam,u_fogCol; uniform vec2 u_fog; out vec4 o;
void main(){ vec4 c=v_col*u_colMul; float f=smoothstep(u_fog.x,u_fog.y,length(v_wpos-u_cam)); o=vec4(mix(c.rgb,u_fogCol,f*0.5),c.a*(1.-f*0.6)); }`;
// soft particles (camera-facing quads built on CPU)
SH.partVS = `#version 300 es
layout(location=0) in vec3 a_pos; layout(location=1) in vec2 a_uv; layout(location=2) in vec4 a_col;
uniform mat4 u_vp; out vec2 v_uv; out vec4 v_col; out vec3 v_wpos;
void main(){ v_uv=a_uv; v_col=a_col; v_wpos=a_pos; gl_Position=u_vp*vec4(a_pos,1.); }`;
SH.partFS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec4 v_col; in vec3 v_wpos; uniform vec3 u_cam,u_fogCol; uniform vec2 u_fog; out vec4 o;
void main(){ float r=length(v_uv-0.5)*2.; float a=smoothstep(1.,0.25,r)*v_col.a; float f=smoothstep(u_fog.x,u_fog.y,length(v_wpos-u_cam));
  o=vec4(mix(v_col.rgb,u_fogCol,f*0.6),a*(1.-f*0.7)); }`;
SH.skyVS = `#version 300 es
const vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3)); out vec2 v_ndc;
void main(){ v_ndc=P[gl_VertexID]; gl_Position=vec4(P[gl_VertexID],0.9999,1.); }`;
SH.skyFS = `#version 300 es
precision highp float;
in vec2 v_ndc;
uniform mat4 u_ivp;
uniform vec3 u_cam, u_sunDir, u_sunCol, u_moonDir, u_moonCol, u_skyTop, u_skyMid, u_skyHor, u_sunGlow;
uniform float u_clouds, u_time, u_sunSize, u_moonSize;
out vec4 o;

float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.50;
  for(int i = 0; i < 4; i++){
    s += a * n(p);
    p = p * 2.08 + vec2(1.6, 2.4);
    a *= 0.50;
  }
  return s;
}

void main(){
  vec4 w = u_ivp * vec4(v_ndc, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w - u_cam);
  float y = d.y;

  // 1. Realistic Rayleigh atmospheric dome gradient
  vec3 c = y < 0.16 ? mix(u_skyHor, u_skyMid, smoothstep(-0.06, 0.16, y)) : mix(u_skyMid, u_skyTop, smoothstep(0.16, 0.78, y));
  // Warm atmospheric horizon haze band (softened to prevent glare wash)
  c += u_skyHor * 0.10 * smoothstep(0.18, 0.0, max(y, 0.0));

  // 2. Solar disk, circumsolar halo & Mie forward scattering
  vec3 L = normalize(u_sunDir);
  float sd = max(dot(d, L), 0.0);
  float sunUp = smoothstep(-0.06, 0.08, L.y);

  if (sunUp > 0.005) {
    // Soft, tighter atmospheric solar glow without wide overbright glare
    c += u_sunGlow * (pow(sd, 14.0) * 0.16 + pow(sd, 54.0) * 0.35) * sunUp;
    // Crisp, radiant solar disk
    if (u_sunSize > 0.0001) {
      float sunDisk = smoothstep(1.0 - u_sunSize, 1.0 - u_sunSize * 0.35, sd);
      c += (u_sunCol * 1.30 + vec3(0.20, 0.16, 0.10)) * sunDisk * sunUp;
    }
  }

  // 3. Moon disk, lunar maria craters, and ethereal cool lunar halo
  vec3 M = normalize(u_moonDir);
  float md = max(dot(d, M), 0.0);
  float moonUp = smoothstep(-0.06, 0.08, M.y);

  if (moonUp > 0.005) {
    // Soft cool silvery-blue lunar atmospheric halo
    vec3 moonHalo = vec3(0.40, 0.60, 0.95);
    c += moonHalo * (pow(md, 8.0) * 0.22 + pow(md, 48.0) * 0.45) * moonUp;

    // Glowing lunar disk with realistic surface crater details
    float mSize = u_moonSize > 0.0001 ? u_moonSize : 0.0018;
    float moonDisk = smoothstep(1.0 - mSize, 1.0 - mSize * 0.45, md);
    if (moonDisk > 0.001) {
      vec3 mCoord = d - M;
      float craters = fbm(mCoord.xy * 650.0);
      vec3 moonSurface = mix(vec3(0.95, 0.97, 1.0), vec3(0.64, 0.68, 0.80), craters * 0.55);
      float phaseK = clamp(dot(normalize(mCoord.xy), normalize(u_sunDir.xy + vec2(0.1, 0.1))) * 0.35 + 0.75, 0.5, 1.25);
      c += (moonSurface * 2.2 * phaseK) * moonDisk * moonUp;
    }
  }

  // 4. Subtle twinkling stars in night sky
  float nightSky = clamp((0.40 - length(u_sunCol)) * 2.5, 0.0, 1.0) * (1.0 - sunUp * 0.75);
  if(nightSky > 0.05 && y > 0.03){
    vec2 sc = floor(d.xz / (y + 0.12) * 85.0);
    float sr = h(sc);
    if(sr > 0.985){
      float tw = sin(u_time * 2.8 + sr * 60.0) * 0.35 + 0.65;
      c += vec3(0.85, 0.92, 1.0) * tw * nightSky * smoothstep(0.03, 0.25, y) * 1.35;
    }
  }

  // 5. Clearly visible, fluffy, moving cumulus and cirrus clouds drifting across the sky
  float cloudAmt = max(u_clouds, 0.52);
  if(cloudAmt > 0.02 && y > 0.005){
    // Project onto a curved atmospheric dome
    float domeH = max(y, 0.04) + 0.16;
    vec2 skyUV = (d.xz / domeH);
    // Active wind drift speed (clearly visible movement across the sky!)
    vec2 wind = vec2(0.68, 0.32) * (u_time * 0.055);
    vec2 uv = skyUV * 0.52 + wind;

    // Billowy cumulus cloud FBM with domain warping
    float q = fbm(uv);
    vec2 warp = vec2(fbm(uv + vec2(1.2, 3.4)), fbm(uv + vec2(4.5, 1.8)));
    float cloudNoise = fbm(uv + warp * 0.35);

    float thresh = 0.44 - cloudAmt * 0.16;
    float density = smoothstep(thresh, thresh + 0.22, cloudNoise);
    float horizonFade = smoothstep(0.01, 0.18, y);
    float alpha = density * clamp(cloudAmt * 1.35, 0.0, 1.0) * horizonFade;

    if(alpha > 0.003){
      // Dynamic lighting from the moving Sun
      float sunSilver = pow(sd, 8.0) * 0.30 * sunUp;
      vec3 sunlit = mix(vec3(1.0, 0.98, 0.95), u_sunCol, 0.40) * (1.18 + sunSilver);
      vec3 sunShaded = mix(u_skyMid * 0.75, vec3(0.42, 0.45, 0.54), 0.45);
      vec3 dayCloud = mix(sunShaded, sunlit, clamp(cloudNoise * 0.85 + sunSilver, 0.0, 1.0));

      // Dynamic lighting from the moving Moon
      float moonSilver = pow(md, 4.0) * 0.40 * moonUp;
      vec3 moonlit = vec3(0.70, 0.82, 0.98) * (0.90 + moonSilver);
      vec3 moonShaded = vec3(0.08, 0.10, 0.20);
      vec3 nightCloud = mix(moonShaded, moonlit, clamp(cloudNoise * 0.85 + moonSilver, 0.0, 1.0));

      vec3 cloudCol = mix(nightCloud, dayCloud, clamp(sunUp * 1.25, 0.0, 1.0));
      c = mix(c, cloudCol, alpha * 0.92);
    }
  }

  o = vec4(c, 1.0);
}`;
SH.quadVS = `#version 300 es
const vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3)); out vec2 v_uv;
void main(){ v_uv=P[gl_VertexID]*0.5+0.5; gl_Position=vec4(P[gl_VertexID],0.,1.); }`;
SH.brightFS = `#version 300 es
precision highp float; in vec2 v_uv; uniform sampler2D u_tex; uniform float u_th; out vec4 o;
void main(){
  vec3 c = texture(u_tex, v_uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float soft = smoothstep(u_th - 0.1, u_th + 0.22, l);
  o = vec4(c * soft, 1.0);
}`;
SH.blurFS = `#version 300 es
precision highp float; in vec2 v_uv; uniform sampler2D u_tex; uniform vec2 u_dir; out vec4 o;
void main(){ vec3 c=texture(u_tex,v_uv).rgb*0.227;
  c+=(texture(u_tex,v_uv+u_dir*1.385).rgb+texture(u_tex,v_uv-u_dir*1.385).rgb)*0.316;
  c+=(texture(u_tex,v_uv+u_dir*3.231).rgb+texture(u_tex,v_uv-u_dir*3.231).rgb)*0.07; o=vec4(c,1.); }`;
SH.compFS = `#version 300 es
precision highp float; in vec2 v_uv; uniform sampler2D u_scene,u_bloom; uniform float u_bloomAmt,u_blur,u_vig; out vec4 o;

// ACES Filmic Tone Mapping Curve (preserves high-dynamic range speculars, neons, and vibrant golds)
vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main(){
  vec3 c = texture(u_scene, v_uv).rgb;
  if(u_blur > 0.001){
    vec2 d = v_uv - 0.5;
    float e = smoothstep(0.18, 0.72, length(d));
    vec3 acc = c;
    for(int i = 1; i < 7; i++) acc += texture(u_scene, v_uv - d * float(i) * 0.011 * u_blur).rgb;
    c = mix(c, acc / 7.0, e);
  }
  vec3 bloom = texture(u_bloom, v_uv).rgb;
  c += bloom * (u_bloomAmt * 1.15);
  c *= mix(1.0, smoothstep(1.10, 0.35, length(v_uv - 0.5)), u_vig * 0.72);
  c = aces(c * 1.05);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, 1.06);
  o = vec4(c, 1.0);
}`;

// ---------- Render targets for bloom & MSAA ----------
const RT = { ok: false };
function makeTex(w, h) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { tex: t, fbo: f, w, h };
}
function setupTargets(w, h) {
  try {
    if (RT.del) RT.del();
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    const isUltra = GAME.quality === 'ultra';
    const samples = Math.min(isUltra ? 8 : 4, maxSamples);
    const ms = gl.createFramebuffer(), cr = gl.createRenderbuffer(), dr = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, cr);
    if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, dr);
    if (samples > 0) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, cr);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dr);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo');
    const scene = makeTex(w, h), qw = Math.max(1, w >> 1), qh = Math.max(1, h >> 1), A = makeTex(qw, qh), B = makeTex(qw, qh);
    Object.assign(RT, { ok: true, ms, scene, A, B, w, h, del() { gl.deleteFramebuffer(ms); gl.deleteRenderbuffer(cr); gl.deleteRenderbuffer(dr); for (const t of [scene, A, B]) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } } });
  } catch (e) { RT.ok = false; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// ---------- canvas text textures ----------
function textCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); return c; }
function fitFont(x, text, maxW, size, family, weight = 700) { let s = size; do { x.font = `${weight} ${s}px ${family}`; s -= 2; } while (x.measureText(text).width > maxW && s > 8); return s + 2; }
