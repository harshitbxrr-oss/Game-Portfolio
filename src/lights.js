'use strict';
// ============================================================
// CAR LIGHTS & CONTROLS — headlights (auto / on / high beam / off)
// that really light the road, brake, tail and reversing lamps,
// indicators with self-cancel, hazards after a big hit, and a horn.
// ============================================================
const LIGHT_MODES = ['auto', 'on', 'high', 'off'];
const LIGHT_NAMES = { auto: 'Headlights: auto', on: 'Headlights: on', high: 'Headlights: high beam', off: 'Headlights: off' };
const LT = { mode: LIGHT_MODES.includes(store.get('lights', 'auto')) ? store.get('lights', 'auto') : 'auto', ind: 'off', yaw0: 0, blinkT: 0, blinkOn: false, hazardT: 0, horn: false };
GAME.hornT = 0;
function headState() { const dark = GAME.mood ? GAME.mood.night : 0; const on = LT.mode === 'on' || LT.mode === 'high' || (LT.mode === 'auto' && dark > 0.3); return { on, high: LT.mode === 'high', dark }; }
function brakeLit() { const c = GAME.car; return GAME.phase !== 'loading' && ((c.brakeCmd || 0) > 0.08 || (GAME.phase !== 'driving' && c.speed > 0.5)); }

// ---------- actions ----------
function cycleLights() { LT.mode = LIGHT_MODES[(LIGHT_MODES.indexOf(LT.mode) + 1) % LIGHT_MODES.length]; store.set('lights', LT.mode); toast(LIGHT_NAMES[LT.mode] + (LT.mode === 'auto' ? ', on after dark' : '')); clickSound(1400); updateCarCtl(); }
function setIndicator(side) { LT.ind = LT.ind === side ? 'off' : side; LT.yaw0 = GAME.car.yaw; LT.blinkT = 0; clickSound(900); updateCarCtl(); }
function hornOn(v) { if (LT.horn === v) return; LT.horn = v; if (v) { GAME.hornT = 1.2; hornSound(true); } else hornSound(false); $('#btnHorn').classList.toggle('on', v); }

// ---------- per frame: blinking, self-cancel, hazard timer ----------
GAME.on('frame', dt => {
  const c = GAME.car;
  LT.hazardT = Math.max(0, LT.hazardT - dt); GAME.hornT = LT.horn ? 1.2 : Math.max(0, GAME.hornT - dt);
  const active = LT.ind !== 'off' || LT.hazardT > 0;
  if (active) { LT.blinkT += dt; const on = (LT.blinkT % 0.72) < 0.38; if (on !== LT.blinkOn) { LT.blinkOn = on; tickSound(on); updateCarCtl(); } } else if (LT.blinkOn) { LT.blinkOn = false; updateCarCtl(); }
  // indicators switch themselves off once the turn is done and the wheel straightens
  if (LT.ind !== 'off') { const turned = angDiff(LT.yaw0, c.yaw); if (((LT.ind === 'left' && turned > 0.6) || (LT.ind === 'right' && turned < -0.6)) && Math.abs(c.strS || 0) < 0.15) { LT.ind = 'off'; updateCarCtl(); } }
  positionCarCtl();
});
GAME.on('driving', () => setTimeout(() => positionCarCtl(true), 50));
addEventListener('resize', () => setTimeout(() => positionCarCtl(true), 120));
GAME.on('impact', v => { if (v > 12) { LT.hazardT = 4; LT.blinkT = 0; } });
// emergency stop signal: hazards flash after a hard instant stop, like modern cars
GAME.on('ebrake', () => { LT.hazardT = 3.5; LT.blinkT = 0; });

// ---------- render hooks ----------
const _v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
GAME.lightUniforms = function (u, carM) {
  const st = headState(), c = GAME.car, spot = new Float32Array(16);
  if (st.on) {
    const o = M4.xf(carM, [0, 0, 0]);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, P = M4.xf(carM, [s * 0.62, 0.52, -2.2]), D = V3.norm(_v3sub(M4.xf(carM, [s * 0.05, st.high ? -0.02 : -0.075, -1]), o));
      spot.set([P[0], P[1], P[2], st.high ? 120 : 58, D[0], D[1], D[2], Math.cos(st.high ? 0.3 : 0.44)], i * 8);
    }
    gl.uniform4fv(u.u_spot, spot); gl.uniform3fv(u.u_spotCol, st.high ? [2.5, 2.4, 2.2] : [2.1, 1.98, 1.78]); gl.uniform1f(u.u_spotOn, 0.35 + 0.65 * st.dark);
  } else gl.uniform1f(u.u_spotOn, 0);
  // rear glow: brake (red, strong), reversing (white), running lights (faint red)
  const k = 0.3 + 0.7 * st.dark, braking = brakeLit(), R = M4.xf(carM, [0, 0.55, 3.0]);
  let col = [0, 0, 0], rad = 0;
  if (c.rev) { col = [1.0 * k, 1.0 * k, 1.05 * k]; rad = 8; } else if (braking) { col = [1.7 * k, 0.16 * k, 0.1 * k]; rad = 9; } else if (st.on) { col = [0.5 * k, 0.05 * k, 0.04 * k]; rad = 4.5; }
  gl.uniform4f(u.u_pt, R[0], R[1], R[2], rad); gl.uniform3fv(u.u_ptCol, col);
};
GAME.drawCarLights = function (u, carM) {
  const st = headState(), c = GAME.car, blink = LT.blinkOn, haz = LT.hazardT > 0;
  drawMesh(u, MESH.car_head, carM, [1, 1, 1], st.on ? (st.high ? 1.7 : 1.25) : 0.04);
  drawMesh(u, MESH.car_tail, carM, [1, 1, 1], brakeLit() ? 1.6 : st.on ? 0.24 : 0.15);
  drawMesh(u, MESH.car_rev, carM, [1, 1, 1], c.rev ? 1.3 : 0.03);
  drawMesh(u, MESH.car_indL, carM, [1, 1, 1], blink && (LT.ind === 'left' || haz) ? 1.6 : 0.05);
  drawMesh(u, MESH.car_indR, carM, [1, 1, 1], blink && (LT.ind === 'right' || haz) ? 1.6 : 0.05);
  // switching back off the emissive multiplier for everything drawn after the car
  gl.uniform1f(u.u_emisMul, 1);
};
GAME.drawBeams = function (fu, carM) {
  const st = headState(); if (!st.on || st.dark < 0.2) return;
  const a = (st.high ? 0.95 : 0.7) * clamp((st.dark - 0.2) / 0.5, 0, 1);
  for (const s of [-1, 1]) drawFlat(fu, MESH.beam, M4.mul(carM, M4.model(s * 0.62, 0.52, -2.22, -s * 0.05, st.high ? -0.02 : -0.075, 0, st.high ? 1.25 : 1)), [1, 1, 1, a]);
};

// ---------- HUD: indicator arrows, headlight switch, horn (buttons, all devices) ----------
document.querySelector('#hud').insertAdjacentHTML('beforeend', `
<div class="carctl" id="carctl" role="group" aria-label="Car controls">
  <button class="cc" id="btnIndL" aria-pressed="false" aria-label="Left indicator (Z)"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M10 5 3 12l7 7v-4h10V9H10z" fill="currentColor"/></svg></button>
  <button class="cc" id="btnLights" aria-label="Headlights (L)"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5C6 5 3 8.5 3 12s3 7 8 7c1.2 0 2-1 2-2.5v-9C13 6 12.2 5 11 5z" fill="currentColor" stroke="none"/><path id="beamLines" d="M16 8h6M16 12h6M16 16h6"/></svg><span id="lightsLbl">A</span></button>
  <button class="cc" id="btnHorn" aria-label="Horn (H, hold)"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 10v4h3l6 4V6L6 10H3zm13-2.5v9a4.5 4.5 0 0 0 0-9z"/></svg></button>
  <button class="cc" id="btnIndR" aria-pressed="false" aria-label="Right indicator (X)"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M14 5l7 7-7 7v-4H4V9h10z" fill="currentColor"/></svg></button>
</div>`);
document.head.insertAdjacentHTML('beforeend', `<style>
.carctl{position:fixed;display:flex;gap:6px;align-items:center;justify-content:center;pointer-events:auto;z-index:12;transform:translateX(-50%)}
.cc{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(14,18,32,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;display:grid;place-items:center;padding:0;position:relative;touch-action:none;-webkit-user-select:none;user-select:none}
.cc:hover{background:rgba(14,18,32,.7)}
.cc.blink{color:#FFB020;border-color:#FFB020;box-shadow:0 0 14px rgba(255,176,32,.6)}
.cc.lit{color:#7FD4FF;border-color:#7FD4FF}.cc.hi{color:#BDEBFF;border-color:#BDEBFF;box-shadow:0 0 14px rgba(125,210,255,.55)}
.cc.on{background:rgba(59,143,216,.75)}
.cc span{position:absolute;right:-2px;bottom:-2px;min-width:16px;height:16px;border-radius:8px;background:#0E1220;border:1px solid rgba(255,255,255,.4);font:700 10px/14px Rajdhani,system-ui,sans-serif;text-align:center;padding:0 3px}
.hud-min .carctl{opacity:.85}
@media (max-width:420px){.cc{width:38px;height:38px}}
</style>`);
function updateCarCtl() {
  const st = headState(), haz = LT.hazardT > 0;
  $('#btnIndL').classList.toggle('blink', LT.blinkOn && (LT.ind === 'left' || haz)); $('#btnIndR').classList.toggle('blink', LT.blinkOn && (LT.ind === 'right' || haz));
  $('#btnIndL').setAttribute('aria-pressed', LT.ind === 'left'); $('#btnIndR').setAttribute('aria-pressed', LT.ind === 'right');
  const b = $('#btnLights'); b.classList.toggle('lit', st.on && !st.high); b.classList.toggle('hi', st.high);
  $('#lightsLbl').textContent = { auto: 'A', on: 'On', high: 'Hi', off: 'Off' }[LT.mode];
  b.setAttribute('aria-label', LIGHT_NAMES[LT.mode] + ' (L)');
  $('#beamLines').setAttribute('d', st.high ? 'M16 6h6M16 10h6M16 14h6M16 18h6' : st.on ? 'M16 9l6 1M16 13l6 1.5M16 17l6 2' : '');
}
// keep the group just above the speedometer, wherever the layout puts it
let ccT = 0;
function positionCarCtl(force) {
  const now = performance.now(); if (force !== true && now - ccT < 300) return; ccT = now; const sp = $('#speedo'), g = $('#carctl');
  if (!sp || $('#hud').classList.contains('hidden')) { g.style.display = 'none'; return; } g.style.display = 'flex';
  const r = sp.getBoundingClientRect(), gw = g.offsetWidth || 200, top = Math.max(8, r.top - 50); g.style.left = clamp(r.left + r.width / 2, gw / 2 + 8, innerWidth - gw / 2 - 8) + 'px'; g.style.top = top + 'px';
  if (r.top < 120) { g.style.top = (r.bottom + 6) + 'px'; }
  updateCarCtl();
}
$('#btnIndL').onclick = () => setIndicator('left'); $('#btnIndR').onclick = () => setIndicator('right'); $('#btnLights').onclick = cycleLights;
{ const h = $('#btnHorn'); h.addEventListener('pointerdown', e => { e.preventDefault(); h.setPointerCapture(e.pointerId); hornOn(true); audioKick(); }); for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) h.addEventListener(ev, () => hornOn(false)); h.addEventListener('contextmenu', e => e.preventDefault()); }

// ---------- keys: L lights, Z/X indicators, H horn (hold); help moves to ? ----------
addEventListener('keydown', e => {
  if (overlayOpen() || !booted || !$('#loader').classList.contains('hidden')) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.offsetParent !== null) return;
  if (GAME.phase !== 'driving') return;
  if (e.code === 'KeyH') { e.stopImmediatePropagation(); if (!e.repeat) { hornOn(true); audioKick(); } return; }
  if (e.repeat) return;
  if (e.code === 'KeyL') cycleLights(); if (e.code === 'KeyZ') setIndicator('left'); if (e.code === 'KeyX') setIndicator('right');
}, true);
addEventListener('keyup', e => { if (e.code === 'KeyH') hornOn(false); });
addEventListener('blur', () => hornOn(false));
// controller: D-pad up = lights, L3 / R3 = indicators, LB = horn
{ const prev = []; GAME.on('frame', () => { if (!navigator.getGamepads || GAME.phase !== 'driving') return; let p = null; for (const g of navigator.getGamepads()) if (g && g.connected) { p = g; break; } if (!p) return;
  const pr = i => !!(p.buttons[i] && p.buttons[i].pressed), edge = i => pr(i) && !prev[i];
  if (edge(12)) cycleLights(); if (edge(10)) setIndicator('left'); if (edge(11)) setIndicator('right'); if (pr(4) !== LT.horn && (pr(4) || prev[4])) hornOn(pr(4));
  for (let i = 0; i < p.buttons.length; i++) prev[i] = pr(i); }); }
// controls reference
{
  HELP.kb = HELP.kb.filter(r => r[0] !== 'H').concat([['B', 'Instant brake (hold)'], ['L', 'Headlights: auto, on, high beam, off'], ['Z / X', 'Left / right indicator'], ['H (hold)', 'Horn'], ['?', 'Show these controls']]);
  HELP.touch = HELP.touch.concat([['Stop (red)', 'Instant brake'], ['Arrow buttons', 'Indicators (above the speedometer)'], ['Headlight button', 'Auto, on, high beam, off'], ['Horn button', 'Hold to sound the horn']]);
  HELP.pad = HELP.pad.concat([['B / Circle (hold)', 'Instant brake'], ['D-pad up', 'Headlights'], ['L3 / R3', 'Left / right indicator'], ['LB / L1', 'Horn']]);
}

// ---------- sounds (only when sound is on) ----------
function clickSound(f) { if (!GAME.sound || !AUDIO.ctx) return; const C = AUDIO.ctx, t = C.currentTime, o = C.createOscillator(), g = C.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05); o.connect(g); g.connect(AUDIO.master); o.start(t); o.stop(t + 0.06); }
function tickSound(on) { clickSound(on ? 1250 : 850); }
let HORN = null;
function hornSound(on) {
  if (!GAME.sound || !AUDIO.ctx) return; const C = AUDIO.ctx, t = C.currentTime;
  if (on && !HORN) { const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.03); lp.connect(g); g.connect(AUDIO.master);
    const os = [415, 523].map(f => { const o = C.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp); o.start(t); return o; }); HORN = { g, os }; }
  else if (!on && HORN) { const h = HORN; HORN = null; h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + 0.06); h.os.forEach(o => o.stop(t + 0.08)); }
}
window.__game.LT = LT; window.__game.cycleLights = cycleLights; window.__game.setIndicator = setIndicator; window.__game.hornOn = hornOn;

// ---------- steering sensitivity (Settings) ----------
GAME.steerSens = 1; // every session starts at 100%; changes apply until the game is closed
{ const ss = $('#steerSens'), so = $('#steerSensVal');
  const show = () => { const pct = Math.round(GAME.steerSens * 100); ss.value = pct; so.textContent = pct + '%'; ss.setAttribute('aria-valuetext', pct + '%, ' + (pct < 85 ? 'gentle' : pct > 120 ? 'sharp' : 'normal')); };
  ss.addEventListener('input', () => { GAME.steerSens = clamp(ss.value / 100, 0.5, 1.8); show(); });
  ss.addEventListener('change', () => toast('Steering sensitivity ' + Math.round(GAME.steerSens * 100) + '%'));
  show(); }
window.__game.setSteerSens = v => { GAME.steerSens = clamp(v, 0.5, 1.8); const ss = $('#steerSens'); ss.value = Math.round(GAME.steerSens * 100); ss.dispatchEvent(new Event('input')); };
