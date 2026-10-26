'use strict';
// ============================================================
// PHYSICS — fixed 120 Hz step with render interpolation.
// Car: bicycle model with tyre saturation (friction circle), weight
// transfer, downforce, AWD drivetrain with 6-speed auto box, brakes
// with ABS, handbrake that locks the rear axle, optional stability
// control, spring-damper body pitch/roll. Collisions use impulses at
// the contact point, so glancing hits spin the car. Traffic can be
// knocked and recovers; cones, barrels and crates are rigid bodies.
// ============================================================
const PH = { dt: 1 / 120, acc: 0, alpha: 0 };
const VP = {
  m: 1450, Iz: 2250, a: 1.3, b: 1.45, h: 0.46, Cf: 90000, Cr: 100000, mu: 1.35, down: 1.1, drag: 0.44, rollR: 170,
  gears: [3.1, 2.15, 1.62, 1.28, 1.04, 0.86], rev: 3.0, fd: 5.4, rw: 0.36, eff: 0.88, idle: 950, redline: 8200,
  split: 0.38, brakeF: 21000, e: 0.12
};
VP.L = VP.a + VP.b;
const GRAV = 9.81;
GAME.assists = true;
GAME.steerSens = 1;
Object.assign(GAME.car, { r: 0, rev: false, thrS: 0, brkS: 0, strS: 0, pv: 0, rv: 0, pitch: 0, roll: 0, wheelspin: 0, axPrev: 0, gearI: 1, shiftT: 0, vl: 0 });
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
function engineTorque(rpm) { const t = clamp((rpm - 1000) / 7200, 0, 1); return 430 + 300 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) - (t > 0.85 ? (t - 0.85) * 900 : 0); }
// smooth tyre saturation: linear for small slip, capped at the friction limit
const tyre = (C, alpha, cap) => cap <= 1 ? 0 : -cap * Math.tanh(C * alpha / cap);

// ---------- car: one fixed step ----------
function carStep(dt) {
  const c = GAME.car, inp = GAME.input, P = VP;
  const locked = GAME.phase !== 'driving';
  let thrT = locked ? 0 : inp.throttle, brkT = locked ? 0 : inp.brake, strT = locked ? 0 : inp.steer;
  const hb = !locked && !!inp.drift, hbStop = hb && Math.abs(strT) < 0.2, eb = !locked && !!inp.ebrake, hard = eb || hbStop;
  if (hard) thrT = 0;
  if (c.auto > 0) { thrT = c.vf < 8 ? 0.6 : 0; c.auto -= dt; }
  if (GAME.phase === 'entering' || GAME.phase === 'panel') brkT = 1;
  // pedal + steering smoothing (keyboards are on/off; this makes them feel analogue)
  c.thrS = approach(c.thrS || 0, thrT, (thrT > (c.thrS || 0) ? 9 : 14) * dt);
  c.brkS = GAME.brakeMode === 'instant' ? brkT : approach(c.brkS || 0, brkT, (brkT > (c.brkS || 0) ? 11 : 14) * dt); if (hard) c.thrS = 0;
  const sp0 = Math.hypot(c.vx, c.vz);
  const centring = Math.abs(strT) < Math.abs(c.strS || 0) || Math.sign(strT) !== Math.sign(c.strS || 0);
  const analog = strT !== 0 && Math.abs(strT) !== 1, sens = clamp(GAME.steerSens || 1, 0.5, 1.8);
  // sensitivity: analogue sticks get a response curve (gentler or sharper around the centre); keys turn the wheel faster or slower
  if (analog) strT = Math.sign(strT) * Math.pow(Math.abs(strT), 1 / Math.sqrt(sens));
  c.strS = approach(c.strS || 0, strT, (analog ? 14 : centring ? 9 : lerp(7.5, 4.2, clamp(sp0 / 40, 0, 1)) * clamp(sens, 0.6, 1.6)) * dt);

  const s = Math.sin(c.yaw), co = Math.cos(c.yaw), fx = -s, fz = -co, lx = -co, lz = s;
  let vx = c.vx * fx + c.vz * fz, vy = c.vx * lx + c.vz * lz, r = c.r || 0;

  // forward / reverse selection: S at a standstill engages reverse, W takes it out
  if (!locked && !hard) { if (!c.rev && c.brkS > 0.5 && vx < 0.8) c.rev = true; else if (c.rev && c.thrS > 0.5 && vx > -0.8) c.rev = false; }
  if (locked && GAME.phase !== 'intro') c.rev = false;
  const drive = hard ? 0 : (c.rev ? c.brkS : c.thrS), brake = hard ? 1 : (c.rev ? c.thrS : c.brkS); c.brakeCmd = brake;
  if (eb && !c.ebPrev && Math.hypot(c.vx, c.vz) > 16) GAME.emit('ebrake', Math.hypot(c.vx, c.vz)); c.ebPrev = eb;

  const canBoost = !!inp.boost && !locked && !c.rev && drive > 0.1 && (c.boosting ? c.boost > 0 : c.boost > 10);
  c.boosting = canBoost; c.boost = clamp(c.boost + (canBoost ? -25 : 12) * dt, 0, 100);

  // gearbox
  const wheelRpm = Math.abs(vx) / (2 * Math.PI * P.rw) * 60;
  c.shiftT = Math.max(0, (c.shiftT || 0) - dt);
  if (!c.gearI || c.gearI < 1) c.gearI = 1;
  const rpmIn = g => wheelRpm * P.gears[g - 1] * P.fd;
  if (!c.rev && c.shiftT <= 0) { if (c.gearI < 6 && rpmIn(c.gearI) > 7700) { c.gearI++; c.shiftT = 0.16; GAME.emit('shift', c.gearI); } else if (c.gearI > 1 && rpmIn(c.gearI) < 3500 && rpmIn(c.gearI - 1) < 6800) { c.gearI--; c.shiftT = 0.1; } }
  const gr = c.rev ? P.rev : P.gears[c.gearI - 1];
  let rpmE = Math.max(P.idle, wheelRpm * gr * P.fd);

  // loads with weight transfer (from last step's longitudinal acceleration) + downforce
  const down = P.down * vx * vx, Wt = P.m * GRAV + down, trans = P.m * (c.axPrev || 0) * P.h / P.L;
  const Nf = Math.max(0.15 * Wt, Wt * P.b / P.L - trans), Nr = Math.max(0.15 * Wt, Wt * P.a / P.L + trans);
  const surf = surfaceAt(c.x, c.z) === 'dust' ? 0.84 : 1, wet = GAME.mood ? GAME.mood.wet : 0;
  const mu = P.mu * surf * (1 - 0.12 * wet);

  // engine force with rev limiter and speed limiter (the boost raises the limit)
  const vmax = c.rev ? 12 : canBoost ? 52 : 38;
  const lim = clamp((vmax - Math.abs(vx)) / 2.5, 0, 1);
  let Fd = engineTorque(Math.min(rpmE, P.redline)) * gr * P.fd * P.eff / P.rw * drive * lim * (c.shiftT > 0 ? 0.3 : 1) * (canBoost ? 1.55 : 1);
  if (rpmE >= P.redline) Fd *= 0.25;
  if (c.rev) Fd = -Fd;
  let Fxf = Fd * P.split, Fxr = Fd * (1 - P.split);
  // brakes (ABS keeps each axle just under the grip limit)
  const sgn = Math.sign(vx);
  if (brake > 0 && Math.abs(vx) > 0.05) { Fxf -= sgn * Math.min(P.brakeF * brake * 0.62, mu * Nf * 0.96); Fxr -= sgn * Math.min(P.brakeF * brake * 0.38, mu * Nr * 0.96); }
  // wheelspin when the drive asks for more than the tyres can give
  const capF = mu * Nf, capR = mu * Nr; let spin = 0;
  if (Math.abs(Fxf) > capF) { spin = Math.max(spin, Math.abs(Fxf) / capF - 1); Fxf = Math.sign(Fxf) * capF; }
  if (Math.abs(Fxr) > capR) { spin = Math.max(spin, Math.abs(Fxr) / capR - 1); Fxr = Math.sign(Fxr) * capR; }
  c.wheelspin = damp(c.wheelspin || 0, clamp(spin, 0, 1.5), 10, dt);

  // steering: speed-sensitive lock
  // speed-sensitive lock matched to the grip available, so steering never asks for the impossible
  const dMax = Math.min(0.72, Math.min(0.6, 1.8 * Math.atan(P.L * mu * GRAV / Math.max(vx * vx, 1))) * (hb ? 1.35 : 1) * Math.pow(sens, 0.8)), delta = c.strS * dMax; c.steer = delta;
  // front axle, forces computed in the wheel frame then rotated back
  const cd = Math.cos(delta), sd = Math.sin(delta), vfy = vy + P.a * r;
  const wfx = vx * cd + vfy * sd, wfy = -vx * sd + vfy * cd;
  const af = Math.atan2(wfy, Math.max(Math.abs(wfx), 0.6));
  const FyfW = tyre(P.Cf, af, Math.sqrt(Math.max(0, capF * capF - Fxf * Fxf)));
  const FxF = Fxf * cd - FyfW * sd, FyF = Fxf * sd + FyfW * cd;
  // rear axle; with the handbrake the locked wheels slide against their own velocity
  const vry = vy - P.b * r; let FxR, FyR;
  if (hb && Math.hypot(vx, vry) > 0.4) { const vr = Math.hypot(vx, vry), k = 0.78 * capR / vr; FxR = -vx * k + Fxr * 0.15; FyR = -vry * k; }
  else { const ar = Math.atan2(vry, Math.max(Math.abs(vx), 0.6)); FxR = Fxr; FyR = tyre(P.Cr, ar, Math.sqrt(Math.max(0, capR * capR - Fxr * Fxr))); }

  const Fdrag = P.drag * vx * Math.abs(vx) + P.rollR * Math.sign(vx) * Math.min(1, Math.abs(vx));
  // instant brake: on top of full ABS braking, an emergency retarder (~0.9 g) stops the car in about a second and a half from 100 km/h
  const Febr = hard && Math.abs(vx) > 0.05 ? Math.sign(vx) * P.m * 9 * Math.min(1, Math.abs(vx) / 0.6) : 0;
  const Fx = FxF + FxR - Fdrag - Febr, Fy = FyF + FyR, Mz = P.a * FyF - P.b * FyR;
  // velocity is re-read from the world frame every step, so the frame rotation is already accounted for
  vx += Fx / P.m * dt; vy += Fy / P.m * dt; r += Mz / P.Iz * dt;
  if (hard) { if (Math.abs(vx) < 0.35) vx = 0; vy *= Math.exp(-3 * dt); r *= Math.exp(-2 * dt); }
  // low speed: blend into kinematic steering (tyre models are singular at rest)
  const kb = smooth(0.8, 3.5, Math.abs(vx));
  r = lerp(vx * Math.tan(delta) / P.L, r, kb); vy = lerp(vy * Math.exp(-14 * dt), vy, kb);
  if (Math.abs(vx) < 0.08 && drive === 0) vx = brake > 0 ? 0 : vx * 0.9;
  // stability control keeps normal driving tidy; the handbrake bypasses it for drifts
  const beta = Math.atan2(vy, Math.max(Math.abs(vx), 1));
  // stability control: only ever trims yaw back toward what the tyres can actually deliver
  if (GAME.assists && !hb && Math.abs(vx) > 5) {
    const rGrip = 0.95 * mu * GRAV / Math.abs(vx), rRef = clamp(vx * Math.tan(delta) / P.L, -rGrip, rGrip);
    if (Math.abs(r) > Math.abs(rRef) + 0.08 || (Math.sign(r) !== Math.sign(rRef) && Math.abs(r) > 0.1)) r = lerp(r, rRef, 1 - Math.exp(-4 * dt));
    if (Math.abs(beta) > 0.1) vy *= Math.exp(-2.2 * dt);
  }
  // slide limiter: drifts hold an angle instead of spinning; momentum is kept, just redirected
  const bMax = GAME.assists ? 0.6 : 0.85;
  if (vx > 3 && Math.abs(beta) > bMax) { const spd = Math.hypot(vx, vy), nb = Math.sign(beta) * lerp(Math.abs(beta), bMax, 1 - Math.exp(-7 * dt)); vx = spd * Math.cos(nb); vy = spd * Math.sin(nb); r *= Math.exp(-1.5 * dt); }
  if (Math.abs(r) > 2.4) r = Math.sign(r) * 2.4;

  c.axPrev = damp(c.axPrev || 0, (FxF + FxR - Fdrag) / P.m, 20, dt);
  c.vx = fx * vx + lx * vy; c.vz = fz * vx + lz * vy; c.r = r;
  c.yaw += r * dt; c.x += c.vx * dt; c.z += c.vz * dt;
  const impact = collideWorld(c);

  // bookkeeping for HUD, audio, FX
  c.vf = vx; c.vl = -vy; c.speed = Math.hypot(c.vx, c.vz);
  c.drifting = (Math.abs(vy) > 2.4 && c.speed > 7) || (hb && c.speed > 6 && Math.abs(vy) > 1) || (hard && c.speed > 6);
  c.gear = c.rev ? 'R' : (c.speed < 0.4 && !drive ? 'N' : String(c.gearI));
  c.rpm = damp(c.rpm || 0.9, clamp((c.gear === 'N' ? (c.thrS ? 2500 + c.thrS * 3500 : P.idle) : rpmE + c.wheelspin * 2600) / 1000, 0.9, 9.6), 14, dt);
  c.spin -= (vx + c.wheelspin * 6 * Math.sign(Fd || 1)) * dt / P.rw;
  c.throttle = c.thrS; c.hb = hb;
  // suspension: spring-damper pitch and roll driven by the real accelerations
  const pitchT = clamp((Fx / P.m) * 0.0048, -0.06, 0.05), rollT = clamp(-(Fy / P.m) * 0.0052, -0.07, 0.07);
  if (!isFinite(c.pitch) || !isFinite(c.pv)) { c.pitch = 0; c.pv = 0; } if (!isFinite(c.roll) || !isFinite(c.rv)) { c.roll = 0; c.rv = 0; }
  c.pv += (-(c.pitch - pitchT) * 95 - c.pv * 11.5) * dt; c.pitch += c.pv * dt;
  c.rv += (-(c.roll - rollT) * 85 - c.rv * 10.5) * dt; c.roll += c.rv * dt;
  if (impact > 1.5) { c.pv += clamp(impact * 0.012, 0, 0.25) * (Math.random() < 0.5 ? -1 : 1); c.rv += clamp(impact * 0.01, 0, 0.2) * (Math.random() < 0.5 ? -1 : 1); }
  return impact;
}

// ---------- impulses ----------
// v_point = v + w * perp(r) with perp(x,z) = (z,-x); cross2(r,n) = n . perp(r)
function impulseCar(c, rx, rz, nx, nz, e, muC, ux = 0, uz = 0, invM2 = 0) {
  const vpx = c.vx + c.r * rz - ux, vpz = c.vz - c.r * rx - uz, vn = vpx * nx + vpz * nz; if (vn >= 0) return { j: 0, vn: 0 };
  const IzC = VP.Iz * 1.7, rn = nx * rz - nz * rx, K = 1 / VP.m + rn * rn / IzC + invM2;
  const j = -(1 + (vn < -1.5 ? e : 0)) * vn / K;
  c.vx += j * nx / VP.m; c.vz += j * nz / VP.m; c.r += j * rn / IzC;
  const tx = nz, tz = -nx, vt = vpx * tx + vpz * tz, rt = tx * rz - tz * rx, Kt = 1 / VP.m + rt * rt / IzC;
  const jt = clamp(-vt / Kt, -muC * j, muC * j); c.vx += jt * tx / VP.m; c.vz += jt * tz / VP.m; c.r += jt * rt / IzC;
  return { j, vn: -vn, jt, tx, tz };
}
function obbContact(px, pz, bx, bz, yaw, hl, hw, r) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw), dx = px - bx, dz = pz - bz;
  const lxx = dx * rx + dz * rz, lf = dx * fx + dz * fz, qx = clamp(lxx, -hw, hw), qf = clamp(lf, -hl, hl);
  let nx = px - (bx + rx * qx + fx * qf), nz = pz - (bz + rz * qx + fz * qf), d = Math.hypot(nx, nz);
  if (d === 0) { const ex = hw - Math.abs(lxx), ef = hl - Math.abs(lf); if (ex < ef) { nx = rx * Math.sign(lxx || 1); nz = rz * Math.sign(lxx || 1); d = -ex; } else { nx = fx * Math.sign(lf || 1); nz = fz * Math.sign(lf || 1); d = -ef; } } else { nx /= d; nz /= d; }
  return d < r ? { nx, nz, pen: r - d } : null;
}
function collideWorld(c) {
  let impact = 0; const f = [-Math.sin(c.yaw), -Math.cos(c.yaw)];
  for (const s of [CAROFF, -CAROFF, 0]) {
    const px = c.x + f[0] * s, pz = c.z + f[1] * s;
    for (const i of nearColliders(px, pz)) {
      let nx, nz, d;
      if (i >= 0) { const b = W.boxes[i]; const qx = clamp(px, b.x0, b.x1), qz = clamp(pz, b.z0, b.z1); nx = px - qx; nz = pz - qz; d = Math.hypot(nx, nz); if (d === 0) { const o = [[px - b.x0, -1, 0], [b.x1 - px, 1, 0], [pz - b.z0, 0, -1], [b.z1 - pz, 0, 1]].sort((a, b2) => a[0] - b2[0]); nx = o[0][1]; nz = o[0][2]; d = -o[0][0]; } else { nx /= d; nz /= d; } }
      else { const cc = W.circles[-1 - i]; if (cc.off) continue; nx = px - cc.x; nz = pz - cc.z; const l = Math.hypot(nx, nz) || 1; d = l - cc.r; nx /= l; nz /= l;
        if (d < CARR && cc.tag && cc.tag.kind === 'lamp') { const vn = -(c.vx * nx + c.vz * nz); if (vn > 5.5) { breakLamp(cc.tag.lamp, c, vn); continue; } } }
      if (d < CARR) { const pen = CARR - d; c.x += nx * pen; c.z += nz * pen; const res = impulseCar(c, px - nx * CARR - c.x, pz - nz * CARR - c.z, nx, nz, VP.e, 0.28); impact = Math.max(impact, res.vn);
        if (i < 0 && res.vn > 5) { const tg = W.circles[-1 - i].tag; if (tg && tg.kind === 'tree') shakeTree(W.circles[-1 - i], res.vn); } }
    }
    // traffic: two-body impulse, the other car gets shoved and spins
    for (const t of TRAFFIC) {
      if (t.y > 1 || Math.abs(t.x - px) > 9 || Math.abs(t.z - pz) > 9) continue;
      const k = obbContact(px, pz, t.x, t.z, t.yaw, t.len / 2, t.wid / 2, CARR); if (!k) continue;
      const mt = TMASS[t.kind] || 1300, It = mt * (t.len * t.len + t.wid * t.wid) / 12, share = mt / (mt + VP.m);
      c.x += k.nx * k.pen * share; c.z += k.nz * k.pen * share; t.kx = (t.kx || 0) - k.nx * k.pen * (1 - share); t.kz = (t.kz || 0) - k.nz * k.pen * (1 - share); t.x -= k.nx * k.pen * (1 - share); t.z -= k.nz * k.pen * (1 - share);
      const cpx = px - k.nx * CARR, cpz = pz - k.nz * CARR, r2x = cpx - t.x, r2z = cpz - t.z;
      const tf = [-Math.sin(t.yaw), -Math.cos(t.yaw)], tvx = tf[0] * t.v + (t.kvx || 0) + (t.kr || 0) * r2z, tvz = tf[1] * t.v + (t.kvz || 0) - (t.kr || 0) * r2x;
      const rn2 = k.nx * r2z - k.nz * r2x, inv2 = 1 / mt + rn2 * rn2 / It;
      const res = impulseCar(c, cpx - c.x, cpz - c.z, k.nx, k.nz, 0.18, 0.2, tvx, tvz, inv2);
      if (res.j > 0) { t.kvx = (t.kvx || 0) - res.j * k.nx / mt; t.kvz = (t.kvz || 0) - res.j * k.nz / mt; t.kr = (t.kr || 0) - res.j * rn2 / It; t.kt = 0; t.hit = true; impact = Math.max(impact, res.vn); }
    }
    // trains are effectively immovable
    if (Math.abs(pz + 296) < 10) for (const T of TRAINS) { if (T.state === 'wait') continue; for (const p of trainParts(T)) { if (Math.abs(p.x - px) > p.len / 2 + 2) continue; const k = obbContact(px, pz, p.x, T.z, Math.PI / 2, p.len / 2, 1.6, CARR); if (!k) continue; c.x += k.nx * k.pen; c.z += k.nz * k.pen; const res = impulseCar(c, px - k.nx * CARR - c.x, pz - k.nz * CARR - c.z, k.nx, k.nz, 0.15, 0.35, T.dir * T.v, 0); impact = Math.max(impact, res.vn); } }
  }
  return impact;
}
const TMASS = { hatch: 1050, sedan: 1300, suv: 1900, amb: 1150, neon: 1400, auto: 420, bus: 11000, truck: 9000 };

// Physical traffic-to-traffic collision resolution: prevents NPC vehicles from penetrating into each other!
function collideTrafficTraffic(dt) {
  const n = TRAFFIC.length;
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < n; i++) {
      const a = TRAFFIC[i];
      if (a.y > 1) continue;
      for (let j = i + 1; j < n; j++) {
        const b = TRAFFIC[j];
        if (b.y > 1) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const maxR = (a.len + b.len) * 0.72;
        if (Math.abs(dx) > maxR || Math.abs(dz) > maxR) continue;
        if (dx * dx + dz * dz > maxR * maxR) continue;

        const af = [-Math.sin(a.yaw), -Math.cos(a.yaw)];
        const bf = [-Math.sin(b.yaw), -Math.cos(b.yaw)];

        let best = null;
        // 1. Test 3 circles along vehicle B against vehicle A's oriented box
        for (const s of [-b.len * 0.35, 0, b.len * 0.35]) {
          const px = b.x + bf[0] * s, pz = b.z + bf[1] * s;
          const k = obbContact(px, pz, a.x, a.z, a.yaw, a.len * 0.5, a.wid * 0.5, b.wid * 0.48);
          if (k && (!best || k.pen > best.pen)) best = { nx: k.nx, nz: k.nz, pen: k.pen, cpx: px, cpz: pz };
        }
        // 2. Test 3 circles along vehicle A against vehicle B's oriented box
        for (const s of [-a.len * 0.35, 0, a.len * 0.35]) {
          const px = a.x + af[0] * s, pz = a.z + af[1] * s;
          const k = obbContact(px, pz, b.x, b.z, b.yaw, b.len * 0.5, b.wid * 0.5, a.wid * 0.48);
          if (k && (!best || k.pen > best.pen)) best = { nx: -k.nx, nz: -k.nz, pen: k.pen, cpx: px, cpz: pz };
        }

        if (!best || best.pen <= 0.002) continue;

        const ma = TMASS[a.kind] || 1300, mb = TMASS[b.kind] || 1300;
        const totalM = ma + mb;
        const shareA = mb / totalM, shareB = ma / totalM;

        // Position separation: push them apart along normal so they NEVER overlap
        const sep = best.pen * 1.05;
        const nx = best.nx, nz = best.nz;
        a.kx = (a.kx || 0) - nx * sep * shareA;
        a.kz = (a.kz || 0) - nz * sep * shareA;
        a.x -= nx * sep * shareA;
        a.z -= nz * sep * shareA;

        b.kx = (b.kx || 0) + nx * sep * shareB;
        b.kz = (b.kz || 0) + nz * sep * shareB;
        b.x += nx * sep * shareB;
        b.z += nz * sep * shareB;

        // Velocity impulse exchange & dynamic reaction (only on first iteration)
        if (iter === 0) {
          const avx = af[0] * a.v + (a.kvx || 0), avz = af[1] * a.v + (a.kvz || 0);
          const bvx = bf[0] * b.v + (b.kvx || 0), bvz = bf[1] * b.v + (b.kvz || 0);
          const rvx = bvx - avx, rvz = bvz - avz;
          const relVn = rvx * nx + rvz * nz;

          if (relVn < 0) {
            const e = 0.28; // restitution: metal crunch with elastic bounce
            const impulse = -(1 + e) * relVn / (1 / ma + 1 / mb);

            // Tangential friction impulse
            const tx = -nz, tz = nx;
            const vt = rvx * tx + rvz * tz;
            const jt = clamp(-vt / (1 / ma + 1 / mb), -0.3 * impulse, 0.3 * impulse);

            a.kvx = (a.kvx || 0) - (impulse * nx + jt * tx) / ma;
            a.kvz = (a.kvz || 0) - (impulse * nz + jt * tz) / ma;
            b.kvx = (b.kvx || 0) + (impulse * nx + jt * tx) / mb;
            b.kvz = (b.kvz || 0) + (impulse * nz + jt * tz) / mb;

            // Angular torque impulse from off-center clash
            const armAx = best.cpx - a.x, armAz = best.cpz - a.z;
            const armBx = best.cpx - b.x, armBz = best.cpz - b.z;
            const tauA = (armAx * nz - armAz * nx) * impulse;
            const tauB = (armBx * nz - armBz * nx) * impulse;
            const Ia = ma * (a.len * a.len + a.wid * a.wid) / 12;
            const Ib = mb * (b.len * b.len + b.wid * b.wid) / 12;
            a.kr = clamp((a.kr || 0) - tauA / Ia * 0.5, -4, 4);
            b.kr = clamp((b.kr || 0) + tauB / Ib * 0.5, -4, 4);

            a.hit = b.hit = true;
            a.kt = b.kt = 0;
            a.v = Math.max(0, a.v * 0.25);
            b.v = Math.max(0, b.v * 0.25);
            a.brake = b.brake = 1.0;

            // Collision sparks & debris
            if (Math.abs(relVn) > 1.2 && typeof FX !== 'undefined' && FX && FX.add) {
              const sparkCount = Math.min(8, Math.floor(Math.abs(relVn) * 2));
              for (let k = 0; k < sparkCount; k++) {
                FX.add.emit({
                  pos: [best.cpx + (Math.random() - 0.5) * 0.4, 0.45 + Math.random() * 0.3, best.cpz + (Math.random() - 0.5) * 0.4],
                  vel: [(Math.random() - 0.5) * 6 + nx * 2, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 6 + nz * 2],
                  life: 0.45,
                  size: 0.12,
                  col: [1, 0.76, 0.25, 1],
                  g: 14,
                  drag: 1.2
                });
              }
            }
          }
        }
      }
    }
  }
}

// knocked traffic slides, spins, then its driver straightens up and carries on
function trafficKnockStep(dt) {
  collideTrafficTraffic(dt);
  for (const t of TRAFFIC) {
    if (!t.hit) continue;
    const v = Math.hypot(t.kvx, t.kvz);
    if (v > 0.01) { const dv = Math.min(v, 6.5 * dt); t.kvx -= t.kvx / v * dv; t.kvz -= t.kvz / v * dv; }
    t.kr *= Math.exp(-2.8 * dt); if (Math.abs(t.kr) < 0.02) t.kr = 0;
    t.kx += t.kvx * dt; t.kz += t.kvz * dt; t.x += t.kvx * dt; t.z += t.kvz * dt; t.kyaw = (t.kyaw || 0) + t.kr * dt; t.yaw += t.kr * dt;
    // keep knocked cars out of buildings
    for (const i of nearColliders(t.x, t.z)) { if (i < 0) continue; const b = W.boxes[i]; const qx = clamp(t.x, b.x0, b.x1), qz = clamp(t.z, b.z0, b.z1); let nx = t.x - qx, nz = t.z - qz, d = Math.hypot(nx, nz); const rr = t.wid / 2; if (d < rr && d > 0) { nx /= d; nz /= d; t.kx += nx * (rr - d); t.kz += nz * (rr - d); const vn = t.kvx * nx + t.kvz * nz; if (vn < 0) { t.kvx -= nx * vn * 1.2; t.kvz -= nz * vn * 1.2; } } }
    if (Math.hypot(t.kvx, t.kvz) < 0.05 && t.kr === 0) {
      t.kt = (t.kt || 0) + dt;
      if (t.kt > 1.0) {
        const k = 1 - Math.exp(-1.8 * dt);
        t.kx -= t.kx * k;
        t.kz -= t.kz * k;
        t.kyaw -= t.kyaw * k;
        if ((Math.hypot(t.kx, t.kz) < 0.12 && Math.abs(t.kyaw) < 0.05) || t.kt > 2.2) {
          t.kx = t.kz = t.kyaw = 0;
          t.hit = false;
          t.kt = 0;
        }
      }
    }
  }
}

// ---------- rigid-body props: cones, barrels, crates ----------
const PROPS = [];
const PKIND = {
  cone: { h: [0.22, 0.37, 0.22], m: 4, e: 0.25, mesh: 'prop_cone' },
  barrel: { h: [0.29, 0.44, 0.29], m: 16, e: 0.2, mesh: 'prop_barrel' },
  crate: { h: [0.35, 0.35, 0.35], m: 14, e: 0.15, mesh: 'prop_crate' }
};
function buildProps() {
  const cone = new Geo(), OR = hex('#E8621C'), WH = hex('#F2F2EE');
  cone.box(0, -0.35, 0, 0.44, 0.04, 0.44, hex('#2a2a2a'), 12);
  [[-0.33, -0.12, 0.17, 0.125, OR], [-0.12, -0.02, 0.125, 0.105, WH], [-0.02, 0.1, 0.105, 0.078, OR], [0.1, 0.18, 0.078, 0.062, WH], [0.18, 0.37, 0.062, 0.02, OR]].forEach(([y0, y1, r0, r1, col]) => cone.prism(0, y0, 0, r0, r1, y1 - y0, 14, col, col === WH ? 0 : 4));
  const bar = new Geo(), BO = hex('#E36A1E');
  [[-0.44, -0.2, BO], [-0.2, -0.08, WH], [-0.08, 0.08, BO], [0.08, 0.2, WH], [0.2, 0.44, BO]].forEach(([y0, y1, col]) => bar.prism(0, y0, 0, 0.29, 0.29, y1 - y0, 16, col, col === WH ? 0 : 4));
  bar.prism(0, 0.44, 0, 0.26, 0.2, 0.03, 16, hex('#3a3a3a'), 12);
  const cr = new Geo(), WD = hex('#A87444'), WD2 = hex('#7A5230');
  cr.box(0, 0, 0, 0.66, 0.66, 0.66, WD);
  for (const s of [-1, 1]) { cr.box(0, 0.2 * s, 0.335, 0.7, 0.08, 0.02, WD2); cr.box(0, 0.2 * s, -0.335, 0.7, 0.08, 0.02, WD2); cr.box(0.335, 0.2 * s, 0, 0.02, 0.08, 0.7, WD2); cr.box(-0.335, 0.2 * s, 0, 0.02, 0.08, 0.7, WD2); }
  MESH.prop_cone = geoToMesh(cone); MESH.prop_barrel = geoToMesh(bar); MESH.prop_crate = geoToMesh(cr);
}
function addProp(kind, x, z, yaw = 0) { const k = PKIND[kind]; const p = { kind, k, home: [x, z, yaw], p: [x, k.h[1] + 0.001, z], v: [0, 0, 0], w: [0, 0, 0], q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], awake: false, still: 0, moved: false, idle: 0 }; PROPS.push(p); }
function initProps() {
  buildProps(); PROPS.length = 0;
  for (const [x, z] of [[-8.6, 136.5], [-8.6, 132.5], [8.6, 136.5], [8.6, 132.5]]) addProp('cone', x, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; addProp('cone', 200 + Math.cos(a) * 13.4, 170 + Math.sin(a) * 13.4); }
  addProp('barrel', 193, 58); addProp('barrel', 207, 58); addProp('barrel', 193.2, 59.2);
  addProp('barrel', -20, -250); addProp('barrel', -21.2, -248.8); addProp('barrel', 20, -250); addProp('crate', 26, -254); addProp('crate', 26.9, -254.6, 0.4);
  for (const [x, z] of [[6.9, -186.4], [8.3, -186.4], [6.9, -189.2], [8.3, -189.2], [7.6, -191.8]]) addProp('cone', x, z);
  addProp('crate', -8.2, -120); addProp('crate', -8.3, -121.1, 0.3); addProp('crate', 8.3, -175); addProp('crate', 8.4, -176.2, 0.5);
  addProp('crate', -228.5, 113.1, 0.2); addProp('crate', -205, 126.9, 0.6); addProp('crate', -140.5, 113.1, 0.1); addProp('barrel', -113, 112.9);
}
// quaternion helpers [x,y,z,w]
function qRot(q, v) { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2]; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; }
function qInv(q) { return [-q[0], -q[1], -q[2], q[3]]; }
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function invIw(p, v) { const k = p.k, m = k.m, [hx, hy, hz] = k.h, I = [m / 3 * (hy * hy + hz * hz), m / 3 * (hx * hx + hz * hz), m / 3 * (hx * hx + hy * hy)]; const b = qRot(qInv(p.q), v); return qRot(p.q, [b[0] / I[0], b[1] / I[1], b[2] / I[2]]); }
function propImpulse(p, r, n, j) { p.v[0] += n[0] * j / p.k.m; p.v[1] += n[1] * j / p.k.m; p.v[2] += n[2] * j / p.k.m; const dw = invIw(p, cross3(r, [n[0] * j, n[1] * j, n[2] * j])); p.w[0] += dw[0]; p.w[1] += dw[1]; p.w[2] += dw[2]; }
function wake(p) { p.awake = true; p.still = 0; p.moved = true; p.idle = 0; }
function propStep(dt) {
  const c = GAME.car, cf = [-Math.sin(c.yaw), -Math.cos(c.yaw)], cr = [Math.cos(c.yaw), -Math.sin(c.yaw)];
  for (const p of PROPS) {
    const rad = Math.max(p.k.h[0], p.k.h[2]) * 1.05;
    // the player's car (oriented box 4.8 x 2.1) shoves props
    const dx = p.p[0] - c.x, dz = p.p[2] - c.z;
    if (Math.abs(dx) < 4 && Math.abs(dz) < 4 && p.p[1] < 1.5) {
      const lf = dx * cf[0] + dz * cf[1], lr = dx * cr[0] + dz * cr[1], qf = clamp(lf, -2.35, 2.35), qr = clamp(lr, -1.02, 1.02);
      let nx = dx - (cf[0] * qf + cr[0] * qr), nz = dz - (cf[1] * qf + cr[1] * qr), d = Math.hypot(nx, nz);
      if (d === 0) { nx = cr[0] * Math.sign(lr || 1); nz = cr[1] * Math.sign(lr || 1); } else { nx /= d; nz /= d; }
      if (d < rad) {
        const rx = c.x + cf[0] * qf + cr[0] * qr - c.x, rz = c.z + cf[1] * qf + cr[1] * qr - c.z;
        const vcx = c.vx + c.r * rz, vcz = c.vz - c.r * rx, vrel = (vcx - p.v[0]) * nx + (vcz - p.v[2]) * nz;
        p.p[0] += nx * (rad - d); p.p[2] += nz * (rad - d);
        if (vrel > 0) { const j = (1 + p.k.e) * vrel / (1 / p.k.m + 1 / VP.m); const up = 0.22 * vrel + 0.8, cp = [p.p[0] - nx * rad * 0.6, p.p[1] - p.k.h[1] * 0.4, p.p[2] - nz * rad * 0.6];
          propImpulse(p, [cp[0] - p.p[0], cp[1] - p.p[1], cp[2] - p.p[2]], [nx, 0, nz], j); p.v[1] = Math.max(p.v[1], up * (p.kind === 'cone' ? 1 : 0.6));
          c.vx -= nx * j / VP.m; c.vz -= nz * j / VP.m; wake(p); if (vrel > 6) GAME.emit('propHit', vrel); }
      }
    }
    // traffic bumps props aside too
    for (const t of TRAFFIC) { if (t.y > 1 || Math.abs(t.x - p.p[0]) > 6 || Math.abs(t.z - p.p[2]) > 6) continue; const k = obbContact(p.p[0], p.p[2], t.x, t.z, t.yaw, t.len / 2, t.wid / 2, rad); if (!k) continue; p.p[0] += k.nx * k.pen; p.p[2] += k.nz * k.pen; const tv = t.v * 1.05 + 0.5; p.v[0] = k.nx * tv; p.v[2] = k.nz * tv; p.v[1] = Math.max(p.v[1], 1.2); p.w[0] += k.nz * 3; p.w[2] -= k.nx * 3; wake(p); }
    if (!p.awake) continue;
    // integrate
    p.v[1] -= GRAV * dt; for (let i = 0; i < 3; i++) p.p[i] += p.v[i] * dt;
    const w = p.w, q = p.q, hq = [w[0] * dt / 2, w[1] * dt / 2, w[2] * dt / 2];
    const nq = [q[0] + hq[0] * q[3] + hq[1] * q[2] - hq[2] * q[1], q[1] + hq[1] * q[3] + hq[2] * q[0] - hq[0] * q[2], q[2] + hq[2] * q[3] + hq[0] * q[1] - hq[1] * q[0], q[3] - hq[0] * q[0] - hq[1] * q[1] - hq[2] * q[2]];
    const ql = Math.hypot(...nq); p.q = nq.map(x => x / ql);
    // ground contact at the box corners: impulse + friction, so props topple and settle
    const [hx, hy, hz] = p.k.h; let low = 0, contacts = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const r = qRot(p.q, [sx * hx, sy * hy, sz * hz]), y = p.p[1] + r[1]; if (y >= 0) continue; low = Math.min(low, y); contacts++;
      const vp = [p.v[0] + w[1] * r[2] - w[2] * r[1], p.v[1] + w[2] * r[0] - w[0] * r[2], p.v[2] + w[0] * r[1] - w[1] * r[0]];
      if (vp[1] < 0) { const n = [0, 1, 0], rn = cross3(r, n), K = 1 / p.k.m + cross3(invIw(p, rn), r)[1]; const j = -(1 + (vp[1] < -1.2 ? p.k.e : 0)) * vp[1] / K; propImpulse(p, r, n, j);
        const vt = [vp[0], 0, vp[2]], vtl = Math.hypot(vt[0], vt[2]); if (vtl > 1e-4) { const t = [-vt[0] / vtl, 0, -vt[2] / vtl], rt = cross3(r, t), Kt = 1 / p.k.m + (() => { const a = cross3(invIw(p, rt), r); return a[0] * t[0] + a[2] * t[2]; })(); propImpulse(p, r, t, Math.min(vtl / Math.max(Kt, 1e-6), 0.6 * j)); } }
    }
    if (low < 0) p.p[1] -= low * 0.9;
    const dA = Math.exp(-(contacts ? 1.6 : 0.3) * dt); w[0] *= dA; w[1] *= dA; w[2] *= dA; if (contacts) { p.v[0] *= Math.exp(-0.6 * dt); p.v[2] *= Math.exp(-0.6 * dt); }
    // walls and buildings
    for (const i of nearColliders(p.p[0], p.p[2])) { let nx, nz, d; if (i < 0 && W.circles[-1 - i].off) continue; if (i >= 0) { const b = W.boxes[i]; const qx = clamp(p.p[0], b.x0, b.x1), qz = clamp(p.p[2], b.z0, b.z1); nx = p.p[0] - qx; nz = p.p[2] - qz; d = Math.hypot(nx, nz); if (d === 0) continue; nx /= d; nz /= d; } else { const cc = W.circles[-1 - i]; nx = p.p[0] - cc.x; nz = p.p[2] - cc.z; const l = Math.hypot(nx, nz) || 1; d = l - cc.r; nx /= l; nz /= l; }
      if (d < rad) { p.p[0] += nx * (rad - d); p.p[2] += nz * (rad - d); const vn = p.v[0] * nx + p.v[2] * nz; if (vn < 0) { p.v[0] -= nx * vn * 1.3; p.v[2] -= nz * vn * 1.3; } } }
    // props knock each other
    for (const o of PROPS) { if (o === p) continue; const ddx = o.p[0] - p.p[0], ddz = o.p[2] - p.p[2]; if (Math.abs(ddx) > 1.2 || Math.abs(ddz) > 1.2 || Math.abs(o.p[1] - p.p[1]) > 1) continue; const dd = Math.hypot(ddx, ddz), rr = rad + Math.max(o.k.h[0], o.k.h[2]); if (dd < rr && dd > 1e-4) { const nx = ddx / dd, nz = ddz / dd, pen = (rr - dd) / 2; p.p[0] -= nx * pen; p.p[2] -= nz * pen; o.p[0] += nx * pen; o.p[2] += nz * pen; const vrel = (p.v[0] - o.v[0]) * nx + (p.v[2] - o.v[2]) * nz; if (vrel > 0) { const mA = p.k.m, mB = o.k.m, j = 1.3 * vrel / (1 / mA + 1 / mB); p.v[0] -= nx * j / mA; p.v[2] -= nz * j / mA; o.v[0] += nx * j / mB; o.v[2] += nz * j / mB; if (!o.awake) wake(o); } } }
    // sleep once settled
    const sp = Math.hypot(...p.v), wsp = Math.hypot(...w);
    if (contacts && sp < 0.08 && wsp < 0.15) { p.still += dt; if (p.still > 0.6) { p.awake = false; p.v = [0, 0, 0]; p.w = [0, 0, 0]; } } else p.still = 0;
    if (p.p[1] < -20) resetProp(p);
  }
}
function resetProp(p) { const [x, z, yaw] = p.home; p.p = [x, p.k.h[1] + 0.001, z]; p.v = [0, 0, 0]; p.w = [0, 0, 0]; p.q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]; p.awake = false; p.moved = false; p.idle = 0; }
const _PM = new Float32Array(16);
function propModel(p) {
  const [x, y, z, w] = p.q, m = _PM; m[3] = m[7] = m[11] = 0;
  m[0] = 1 - 2 * (y * y + z * z); m[1] = 2 * (x * y + z * w); m[2] = 2 * (x * z - y * w);
  m[4] = 2 * (x * y - z * w); m[5] = 1 - 2 * (x * x + z * z); m[6] = 2 * (y * z + x * w);
  m[8] = 2 * (x * z + y * w); m[9] = 2 * (y * z - x * w); m[10] = 1 - 2 * (x * x + y * y);
  m[12] = p.p[0]; m[13] = p.p[1]; m[14] = p.p[2]; m[15] = 1; return m;
}
// knocked props quietly return home once you're far away
function propHousekeeping(dt) { const c = GAME.car; for (const p of PROPS) { if (!p.moved || p.awake) continue; p.idle += dt; if (p.idle > 20 && Math.hypot(p.p[0] - c.x, p.p[2] - c.z) > 90 && Math.hypot(p.home[0] - c.x, p.home[1] - c.z) > 90) resetProp(p); } }

// ---------- the fixed-step driver + render interpolation ----------
updateCar = function (dt) {
  const c = GAME.car; PH.acc += Math.min(dt, 0.1); let n = 0, impact = 0;
  while (PH.acc >= PH.dt && n < 14) {
    c.px_ = c.x; c.pz_ = c.z; c.pyaw_ = c.yaw;
    impact = Math.max(impact, carStep(PH.dt)); trafficKnockStep(PH.dt); propStep(PH.dt); lampStep(PH.dt);
    PH.acc -= PH.dt; n++;
  }
  if (n === 14) PH.acc = 0;
  PH.alpha = PH.acc / PH.dt;
  const a = PH.alpha, v = Object.create(c);
  v.x = lerp(c.px_ ?? c.x, c.x, a); v.z = lerp(c.pz_ ?? c.z, c.z, a); v.yaw = (c.pyaw_ ?? c.yaw) + angDiff(c.pyaw_ ?? c.yaw, c.yaw) * a;
  if (!isFinite(v.x) || !isFinite(v.z) || !isFinite(v.yaw)) { v.x = c.x; v.z = c.z; v.yaw = c.yaw; }
  GAME.view = v;
  propHousekeeping(dt);
  if (impact > 5) { const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw); GAME.cam.shake = Math.min(1, impact / 18); for (let i = 0; i < 18; i++) FX.add.emit({ pos: [c.x + fx * 2, 0.6, c.z + fz * 2], vel: [(Math.random() - 0.5) * 9, 2 + Math.random() * 5, (Math.random() - 0.5) * 9], life: 0.5, size: 0.14, col: [1, 0.72, 0.28, 1], g: 14, drag: 1 }); GAME.emit('impact', impact); }
};
collideCar = collideWorld;
// wheelspin smoke on launches, handled with the existing FX pools
GAME.on('frame', () => { const c = GAME.car; if (!FX.alpha || !(c.wheelspin > 0.25) || c.speed > 25) return; const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw); for (const s of [-0.92, 0.92]) FX.alpha.emit({ pos: [c.x + rx * s - fx * 1.35, 0.3, c.z + rz * s - fz * 1.35], vel: [-fx * 2 + (Math.random() - 0.5), 0.9 + Math.random(), -fz * 2 + (Math.random() - 0.5)], life: 1.2, size: 0.8, grow: 2.4, drag: 1.4, col: [0.86, 0.85, 0.83, 0.45 * Math.min(1, c.wheelspin)] }); });

// ---------- draw props with the world ----------
{ const _dt = drawTrains; drawTrains = function (u) { _dt(u); const cam = GAME.cam; for (const p of PROPS) { if (Math.abs(p.p[0] - cam.pos[0]) > 220 || Math.abs(p.p[2] - cam.pos[2]) > 220) continue; drawMesh(u, MESH[p.k.mesh], propModel(p)); } }; }
{ const _it = initTrains; initTrains = function () { _it(); initProps(); }; }
{ const _tp = GAME.teleport; GAME.teleport = function (x, z, yaw) { _tp(x, z, yaw); const c = GAME.car; Object.assign(c, { r: 0, rev: false, thrS: 0, brkS: 0, strS: 0, pv: 0, rv: 0, pitch: 0, roll: 0, wheelspin: 0, axPrev: 0, px_: x, pz_: z, pyaw_: yaw }); PH.acc = 0; }; }

// ---------- adaptive resolution: hold the frame rate by trading pixels ----------
GAME.renderScale = 1;
const PERF = { t: 0, n: 0, sum: 0, cool: 2, good: 0 };
GAME.on('frame', dt => {
  if (GAME.phase === 'loading' || GAME.paused) return; PERF.sum += dt; PERF.n++; PERF.t += dt; PERF.cool -= dt;
  if (PERF.t < 1.0) return; const avg = PERF.sum / PERF.n; PERF.t = PERF.sum = PERF.n = 0; if (PERF.cool > 0) return;
  let s = GAME.renderScale;
  if (avg > 1 / 50 && s > 0.5) { s = Math.max(0.5, s * (avg > 1 / 30 ? 0.74 : 0.88)); PERF.good = 0; }
  else if (avg < 1 / 58) { if (++PERF.good >= 6 && s < 1) { s = Math.min(1, s * 1.1); PERF.good = 0; } } else PERF.good = 0;
  if (Math.abs(s - GAME.renderScale) > 0.02) { GAME.renderScale = s; PERF.cool = 2.5; resize(); }
});

// ---------- breakable street lamps and solid trees ----------
// A post hit above ~20 km/h shears off at its footing and topples as a rigid rod pivoting at the base
// (angular acceleration 3g/2L * sin θ), bounces once and settles; its light goes out. Slower hits are solid.
function breakLamp(L, c, vn) {
  L.down = true; L.rest = false; L.ang = 0.02; L.t = 0; L.col.off = true;
  const sp = Math.hypot(c.vx, c.vz) || 1; L.dir = [c.vx / sp, c.vz / sp]; L.w = clamp(vn * 0.11, 0.7, 3.2);
  const k = 1 - clamp(0.06 + vn * 0.004, 0.06, 0.16); c.vx *= k; c.vz *= k;
  for (let i = 0; i < 26; i++) FX.add.emit({ pos: [L.x, 0.5, L.z], vel: [(Math.random() - 0.5) * 7 + L.dir[0] * 4, 1 + Math.random() * 4, (Math.random() - 0.5) * 7 + L.dir[1] * 4], life: 0.5, size: 0.12, col: [1, 0.75, 0.3, 1], g: 14 });
  GAME.cam.shake = Math.max(GAME.cam.shake, 0.35); GAME.emit('lampHit', vn);
}
function lampStep(dt) {
  if (!W.lampPosts) return;
  for (const L of W.lampPosts) {
    if (!L.down || L.rest) continue;
    L.w += 1.5 * GRAV / L.h * Math.sin(L.ang) * dt; L.ang += L.w * dt;
    const lie = Math.PI / 2 - 0.035;
    if (L.ang >= lie) { L.ang = lie; if (L.w > 0.9) { L.w = -L.w * 0.22; if (!L.landed) { L.landed = true; const hx = L.x + L.dir[0] * L.h, hz = L.z + L.dir[1] * L.h; for (let i = 0; i < 22; i++) FX.alpha.emit({ pos: [hx, 0.3, hz], vel: [(Math.random() - 0.5) * 4, 0.6 + Math.random() * 2, (Math.random() - 0.5) * 4], life: 0.9, size: 0.1, col: [0.92, 0.95, 1, 0.9], g: 9 }); FX.alpha.emit({ pos: [hx, 0.4, hz], vel: [0, 0.6, 0], life: 1.4, size: 1.2, grow: 2.2, drag: 1.2, col: [0.8, 0.74, 0.64, 0.4] }); GAME.emit('lampLand', L); } } else { L.w = 0; L.rest = true; } }
  }
}
// knocked-down posts are put back once you're well away
GAME.on('frame', dt => { if (!W.lampPosts) return; const c = GAME.car; for (const L of W.lampPosts) { if (!L.down) continue; L.t += dt; if (L.rest && L.t > 25 && Math.hypot(L.x - c.x, L.z - c.z) > 90) { L.down = L.rest = L.landed = false; L.ang = L.w = 0; L.col.off = false; } } });
function shakeTree(cc, vn) {
  const t = cc.tag, now = GAME.t; if (t.last && now - t.last < 0.6) return; t.last = now;
  const n = Math.min(40, 10 + vn * 2);
  for (let i = 0; i < n; i++) FX.alpha.emit({ pos: [cc.x + (Math.random() - 0.5) * 2.4 * t.s, t.y + (Math.random() - 0.3) * 1.2 * t.s, cc.z + (Math.random() - 0.5) * 2.4 * t.s], vel: [(Math.random() - 0.5) * 2, -0.4 - Math.random(), (Math.random() - 0.5) * 2], life: 2.2 + Math.random(), size: 0.16, drag: 1.8, g: 1.2, col: [...t.col, 0.95], fade: 1 });
}
// lamp meshes (post + arm + lantern), arm along +X; drawn upright or tipped over about their footing
function buildLampMesh(h) { const G = new Geo(), D = hex('#3a3a3a'); G.prism(0, 0, 0, 0.14, 0.1, h, 6, D); G.beam([0, h - 0.1, 0], [1.4, h - 0.1, 0], 0.12, D); G.box(1.4, h - 0.3, 0, 0.7, 0.18, 0.4, COL.lampWarm, 1, 1.3); return G; }
{ const _it2 = initTrains; initTrains = function () { _it2(); MESH.lamp6 = geoToMesh(buildLampMesh(6)); MESH.lamp7 = geoToMesh(buildLampMesh(7)); }; }
function lampModel(L) {
  const yaw = Math.atan2(-L.fz, L.fx), base = M4.model(L.x, 0, L.z, 0, 0, 0, 1, 1, 1);
  if (!L.down) return M4.model(L.x, 0, L.z, yaw);
  // rotation about the horizontal axis perpendicular to the fall direction (Rodrigues), then the post's own yaw
  const ax = L.dir[1], az = -L.dir[0], th = L.ang, cs = Math.cos(th), sn = Math.sin(th), t = 1 - cs, R = new Float32Array(16);
  R[0] = cs + ax * ax * t; R[1] = az * sn; R[2] = ax * az * t; R[4] = -az * sn; R[5] = cs; R[6] = ax * sn; R[8] = ax * az * t; R[9] = -ax * sn; R[10] = cs + az * az * t; R[15] = 1;
  return M4.mul(M4.mul(base, R), M4.model(0, 0, 0, yaw));
}
{ const _dt2 = drawTrains; drawTrains = function (u) { _dt2(u); if (!W.lampPosts || !MESH.lamp7) return; const cam = GAME.cam;
    for (const L of W.lampPosts) { if (Math.abs(L.x - cam.pos[0]) > 300 || Math.abs(L.z - cam.pos[2]) > 300) continue; drawMesh(u, L.h <= 6 ? MESH.lamp6 : MESH.lamp7, lampModel(L), [1, 1, 1], L.down ? 0 : 1); } }; }
