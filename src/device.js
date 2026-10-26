'use strict';
// ============================================================
// DEVICE — form factors, control schemes, camera look-around,
// full screen, gamepad and the controls reference
// ============================================================
const HTML = document.documentElement;
const DEV = { touchCap: false, touchOn: false, ff: 'desk', steer: store.get('steer', 'arrows'), tc: store.get('tc', 'auto'), hud: store.get('hud', 'full'), usedKeys: false, immersive: false };
function detectDevice() {
  const w = innerWidth, h = innerHeight, s = Math.min(w, h), isPortrait = h > w;
  DEV.touchCap = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover) and (pointer: fine)').matches);
  DEV.touchOn = DEV.tc === 'on' || (DEV.tc === 'auto' && DEV.touchCap && !DEV.usedKeys);
  DEV.ff = DEV.touchOn ? (s < 600 ? (isPortrait ? 'phone-p' : 'phone-l') : (isPortrait ? 'tablet-p' : 'tablet')) : (w < 900 || h < 620 ? 'compact' : 'desk');
  HTML.classList.remove('ff-desk', 'ff-compact', 'ff-tablet', 'ff-tablet-p', 'ff-phone-l', 'ff-phone-p'); HTML.classList.add('ff-' + DEV.ff);
  HTML.classList.toggle('touch', DEV.touchOn); HTML.classList.toggle('touch-cap', DEV.touchCap || DEV.tc === 'on');
  HTML.classList.toggle('steer-arrows', DEV.steer === 'arrows'); HTML.classList.toggle('hud-min', DEV.hud === 'min' || DEV.immersive);
  const rotEl = $('#rotateScreen');
  if (rotEl) {
    const showRotate = isPortrait && (DEV.touchCap || DEV.touchOn || s < 820);
    rotEl.classList.toggle('active', showRotate);
  }
}
function devSet(k, v) {
  if (k === 'steer') { DEV.steer = v; store.set('steer', v); }
  if (k === 'tc') { DEV.tc = v; DEV.usedKeys = false; store.set('tc', v); }
  if (k === 'hud') { DEV.hud = v; store.set('hud', v); }
  detectDevice();
}
addEventListener('resize', detectDevice); addEventListener('orientationchange', () => setTimeout(detectDevice, 200));
// a physical keyboard or controller on a touch device hides the on-screen controls; touching the screen brings them back
addEventListener('keydown', e => {
  if (KEYMAP[e.code] && DEV.tc === 'auto' && DEV.touchCap && !DEV.usedKeys && booted && $('#loader').classList.contains('hidden')) { DEV.usedKeys = true; detectDevice(); toast('Keyboard detected, on-screen controls hidden'); }
}, true);
addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && DEV.usedKeys) { DEV.usedKeys = false; detectDevice(); } }, true);

// ---------- camera: change rig, drag to look around, wheel or pinch to zoom ----------
function camCycle() { GAME.cycleCam(); }
GAME.on('camMode', m => { store.set('cam', m); applySettingsUI(); toast('Camera: ' + GAME.camName()); });
$('#btnCam').onclick = camCycle;
(() => {
  const cv = $('#gl'), pts = new Map(); let pinch0 = 0, zoom0 = 1;
  const pinchDist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cv.addEventListener('pointerdown', e => { if (GAME.phase !== 'driving' || overlayOpen()) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch (_) { } GAME.look.drag = true; GAME.look.since = 0; if (pts.size === 2) { pinch0 = pinchDist(); zoom0 = GAME.look.zoom; } });
  cv.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; const L = GAME.look; L.since = 0;
    if (pts.size >= 2) { const d = pinchDist(); if (pinch0 > 0 && d > 0) L.zoom = clamp(zoom0 * pinch0 / d, 0.6, 1.9); return; }
    const k = e.pointerType === 'touch' ? 0.009 : 0.006; L.yaw = clamp(L.yaw - dx * k, -Math.PI, Math.PI); L.pitch = clamp(L.pitch + dy * k * 0.7, -0.35, 0.9); });
  const up = e => { if (!pts.delete(e.pointerId)) return; if (pts.size < 2) pinch0 = 0; if (!pts.size) { GAME.look.drag = false; GAME.look.since = 0; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  cv.addEventListener('wheel', e => { if (GAME.phase !== 'driving' || overlayOpen()) return; e.preventDefault(); GAME.look.zoom = clamp(GAME.look.zoom * Math.exp(e.deltaY * 0.0012), 0.6, 1.9); GAME.look.since = 0; }, { passive: false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
})();

// ---------- full screen (with an immersive fallback where the browser blocks it) ----------
const SVG_FS_IN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const SVG_FS_OUT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function autoLockLandscape() {
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    } else if (screen.lockOrientation) {
      screen.lockOrientation('landscape');
    } else if (screen.mozLockOrientation) {
      screen.mozLockOrientation('landscape');
    } else if (screen.msLockOrientation) {
      screen.msLockOrientation('landscape');
    }
  } catch (_) {}
}
const lockLandscape = autoLockLandscape;

function enterGameMobile() {
  autoLockLandscape();
  if (DEV.touchCap && !isFS()) {
    const req = HTML.requestFullscreen || HTML.webkitRequestFullscreen;
    if (req) {
      try {
        const p = req.call(HTML, { navigationUI: 'hide' });
        if (p && p.then) {
          p.then(() => { autoLockLandscape(); updateFSBtn(); }).catch(() => {});
        } else {
          autoLockLandscape();
          updateFSBtn();
        }
      } catch (_) {}
    }
  }
}
function setImmersive(on, quiet) { DEV.immersive = on; detectDevice(); updateFSBtn(); if (on && !quiet) toast(/iPhone|iPod/.test(navigator.userAgent) ? 'Immersive view is on. For true full screen on iPhone, tap Share, then Add to Home Screen.' : 'Full screen is blocked here, so the view switched to immersive mode. ' + (DEV.touchOn ? 'Tap the full screen button again to exit.' : 'Press F again to exit.'), 4600); }
function toggleFullscreen() {
  if (isFS()) { const x = document.exitFullscreen || document.webkitExitFullscreen; if (x) { const p = x.call(document); if (p && p.catch) p.catch(() => { }); } return; }
  if (DEV.immersive) { setImmersive(false); return; }
  const req = HTML.requestFullscreen || HTML.webkitRequestFullscreen, enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!req || !enabled) { setImmersive(true); return; }
  try { const p = req.call(HTML, { navigationUI: 'hide' }); if (p && p.then) p.then(() => { updateFSBtn(); autoLockLandscape(); }).catch(() => setImmersive(true)); else { autoLockLandscape(); setTimeout(() => { if (!isFS()) setImmersive(true); else updateFSBtn(); }, 400); } } catch (_) { setImmersive(true); }
}
function updateFSBtn() { const on = isFS() || DEV.immersive; const b = $('#btnFull'); b.innerHTML = on ? SVG_FS_OUT : SVG_FS_IN; b.setAttribute('aria-label', on ? 'Exit full screen (F)' : 'Full screen (F)'); b.setAttribute('aria-pressed', on); $('#setFull').textContent = on ? 'Exit full screen' : 'Full screen'; }
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if (isFS() && DEV.immersive) DEV.immersive = false; detectDevice(); updateFSBtn(); setTimeout(() => { if (booted) resize(); }, 60); }));
$('#btnFull').onclick = toggleFullscreen; $('#setFull').onclick = toggleFullscreen;

// ---------- controls reference ----------
const HELP = {
  kb: [['W / ↑', 'Accelerate'], ['S / ↓', 'Brake, then reverse'], ['A D / ← →', 'Steer'], ['Space', 'Handbrake: stops the car, hold and steer to drift'], ['Shift / N', 'Nitro Boost with exhaust flame animation'], ['E / Enter', 'Enter a landmark'], ['C', 'Change camera'], ['Mouse drag', 'Look around'], ['Mouse wheel', 'Zoom the camera'], ['M', 'City map'], ['F', 'Full screen'], ['H', 'Show these controls'], ['Esc', 'Close a panel']],
  touch: [['Joystick or arrows', 'Steer (switch in Settings)'], ['Drive', 'Accelerate'], ['Brake', 'Brake, then reverse'], ['Boost', 'Boost'], ['Handbrake', 'Stops the car; hold and steer to drift'], ['Enter', 'Appears when you reach a landmark'], ['Drag the screen', 'Look around'], ['Pinch', 'Zoom the camera'], ['Camera button', 'Change camera'], ['Minimap', 'Open the city map']],
  pad: [['Left stick', 'Steer'], ['Right trigger', 'Accelerate'], ['Left trigger', 'Brake, then reverse'], ['X / Square', 'Handbrake: stops the car, steer to drift'], ['RB / R1', 'Boost'], ['A / Cross', 'Enter a landmark'], ['B / Circle', 'Close a panel'], ['Y / Triangle', 'Change camera'], ['Right stick', 'Look around'], ['View / Share', 'City map'], ['Menu / Options', 'Settings']]
};
function showHelpTab(tab) { $('#help').querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab)); $('#helpList').innerHTML = HELP[tab].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(''); }
function openHelp(tab) { lastFocus = document.activeElement; if (!$('#settings').classList.contains('hidden')) $('#settings').classList.add('hidden'); showHelpTab(tab || (PAD.connected ? 'pad' : DEV.touchOn ? 'touch' : 'kb')); $('#help').classList.remove('hidden'); $('#helpX').focus(); }
function closeHelp() { $('#help').classList.add('hidden'); restoreFocus($('#help')); }
$('#help').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showHelpTab(b.dataset.tab));
$('#openHelp').onclick = () => openHelp(); $('#helpX').onclick = closeHelp;
$('#help').addEventListener('mousedown', e => { if (e.target.id === 'help') closeHelp(); });
$('#help').addEventListener('keydown', e => trapFocus($('#help'), e));
// extra hotkeys: C camera, F full screen, H help
addEventListener('keydown', e => {
  if (e.code === 'Escape' && !$('#help').classList.contains('hidden')) { closeHelp(); return; }
  if (overlayOpen() || !booted || !$('#loader').classList.contains('hidden') || e.repeat) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.offsetParent !== null) return;
  if (e.code === 'KeyC' && GAME.phase === 'driving') camCycle();
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === 'KeyH' || e.code === 'Slash') openHelp();
});

// ---------- gamepad ----------
const PAD = { thr: 0, brk: 0, steer: 0, drift: false, boost: false, prev: [], active: false, connected: false };
addEventListener('gamepadconnected', () => { PAD.connected = true; toast('Controller connected. Right trigger drives, left stick steers.', 3600); });
addEventListener('gamepaddisconnected', () => { PAD.connected = false; Object.assign(PAD, { thr: 0, brk: 0, steer: 0, drift: false, boost: false, active: false }); syncInput(); });
function pollPad(dt) {
  if (!navigator.getGamepads) return; let p = null; for (const g of navigator.getGamepads()) if (g && g.connected) { p = g; break; }
  if (!p) return; PAD.connected = true;
  const bv = i => { const b = p.buttons[i]; return b ? (b.value || (b.pressed ? 1 : 0)) : 0; }, pr = i => bv(i) > 0.5, edge = i => pr(i) && !PAD.prev[i], ax = i => { const v = p.axes[i] || 0; return Math.abs(v) < 0.16 ? 0 : v; };
  PAD.thr = bv(7); PAD.brk = bv(6); PAD.steer = clamp(-ax(0) + (pr(14) ? 1 : 0) - (pr(15) ? 1 : 0), -1, 1); PAD.drift = pr(2); PAD.boost = pr(5); PAD.ebrake = pr(1);
  const o = overlayOpen() || (!$('#help').classList.contains('hidden') ? '#help' : null);
  if (!o && GAME.phase === 'driving') { if (edge(0)) GAME.enter(); if (edge(3)) camCycle(); if (edge(8)) openMap(); if (edge(9)) openSettings(); }
  else if (o && (edge(1) || edge(9))) { ({ '#panel': closePanel, '#map': closeMap, '#settings': closeSettings, '#help': closeHelp, '#quick': closeQuick })[o](); }
  const rx = ax(2), ry = ax(3); if ((rx || ry) && GAME.phase === 'driving') { const L = GAME.look; L.yaw = clamp(L.yaw - rx * dt * 2.6, -Math.PI, Math.PI); L.pitch = clamp(L.pitch + ry * dt * 1.6, -0.35, 0.9); L.since = 0; }
  PAD.active = PAD.thr > 0.05 || PAD.brk > 0.05 || PAD.steer !== 0 || PAD.drift || PAD.boost || rx !== 0 || ry !== 0;
  PAD.prev = p.buttons.map(b => b.pressed);
  if (PAD.active && DEV.touchOn && DEV.tc === 'auto' && DEV.touchCap) { DEV.usedKeys = true; detectDevice(); }
  syncInput();
}

// ---------- rotate hint, landscape locking + per-frame hooks ----------
if (store.get('rot', '0') !== '1') $('#rotateHint').classList.add('show');
$('#rotateX').onclick = () => { $('#rotateHint').classList.remove('show'); store.set('rot', '1'); };
const btnRot = $('#btnAutoRotate');
if (btnRot) {
  btnRot.onclick = () => {
    enterGameMobile();
    autoLockLandscape();
    setTimeout(() => { detectDevice(); if (booted) resize(); }, 300);
  };
}
addEventListener('pointerdown', () => { autoLockLandscape(); }, { once: true, passive: true });
if (screen.orientation) {
  try {
    screen.orientation.addEventListener('change', () => {
      setTimeout(() => { detectDevice(); if (booted) resize(); }, 150);
    });
  } catch (_) {}
}
GAME.on('frame', dt => { pollPad(dt); HTML.classList.toggle('playing', GAME.phase === 'driving' && !$('#hud').classList.contains('hidden')); });
GAME.camMode = CAM_MODES[store.get('cam', 'chase')] ? store.get('cam', 'chase') : 'chase';
detectDevice(); updateFSBtn();
window.__game.DEV = DEV;
window.__game.toggleFullscreen = toggleFullscreen;
window.__game.openHelp = openHelp;
window.__game.autoLockLandscape = autoLockLandscape;
window.__game.enterGameMobile = enterGameMobile;
boot();
