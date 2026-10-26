'use strict';
window.addEventListener('error', e => { try { fetch('/__log', { method: 'POST', body: 'WINDOW ERROR: ' + (e.error ? e.error.stack : e.message) }).catch(() => {}); } catch {} });
window.addEventListener('unhandledrejection', e => { try { fetch('/__log', { method: 'POST', body: 'UNHANDLED REJECTION: ' + (e.reason ? (e.reason.stack || e.reason.message) : e.reason) }).catch(() => {}); } catch {} });
// ============================================================
// UI — boot, input, HUD, minimap, map, panels, quick view, audio
// ============================================================
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('sc_' + k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('sc_' + k, v); } catch (e) { } } };
const QUESTS = [
  { id: 'about', name: 'About me', hint: 'Old City Darwaza' }, { id: 'skills', name: 'Skills', hint: 'Chandni Bazaar' },
  { id: 'cases', name: 'Case studies', hint: 'Cyber-Chowk' }, { id: 'resume', name: 'Resume', hint: 'Railway Junction' }, { id: 'contact', name: 'Contact', hint: 'Vajra Setu' }
];
const TRAVEL = { about: [-8, -45, Math.PI / 2], skills: [-110, 120, Math.PI / 2], cases: [200, 98, Math.PI], resume: [0, -205, 0], contact: [150, 42, 0] };
const DISTRICTS = [
  { test: (x, z) => Math.hypot(x - 200, z - 170) < 70 || (x > 168 && x < 232 && z > 50 && z < 140), n: 'Cyber-Chowk', h: 'साइबर चौक' },
  { test: (x, z) => Math.abs(x - 150) < 9 && Math.abs(z) < 32, n: 'Vajra Setu', h: 'वज्र सेतु' },
  { test: (x, z) => Math.abs(x + 170) < 9 && Math.abs(z) < 32, n: 'Victoria Bridge', h: 'विक्टोरिया पुल' },
  { zone: 'OLD CITY', n: 'Old City', h: 'पुराना शहर' }, { zone: 'RESIDENTIAL DISTRICT', n: 'Residential District', h: 'आवासीय क्षेत्र' },
  { zone: 'ANCIENT TEMPLE COMPLEX', n: 'Ancient Temple Complex', h: 'प्राचीन मंदिर परिसर' }, { zone: 'MARKET DISTRICT', n: 'Market District', h: 'बाज़ार' },
  { zone: 'MODERN BUSINESS DISTRICT', n: 'Modern Business District', h: 'व्यापार केंद्र' }, { zone: 'CENTRAL PARK', n: 'Central Park', h: 'केंद्रीय उद्यान' }, { zone: 'RAILWAY JUNCTION', n: 'Railway Junction', h: 'रेलवे जंक्शन' }
];
const isCoarse = matchMedia('(pointer: coarse)').matches;
if (isCoarse) document.documentElement.classList.add('coarse');

// ---------- content renderers ----------
function skillIcon(icon) {
  if (icon === 'figma') return '<svg width="22" height="32" viewBox="0 0 38 57" fill="none"><path d="M19 28.5C19 23.25 23.25 19 28.5 19C33.75 19 38 23.25 38 28.5C38 33.75 33.75 38 28.5 38C23.25 38 19 33.75 19 28.5Z" fill="#1ABCFE"/><path d="M0 47.5C0 42.25 4.25 38 9.5 38H19V47.5C19 52.75 14.75 57 9.5 57C4.25 57 0 52.75 0 47.5Z" fill="#0ACF83"/><path d="M19 0V19H28.5C33.75 19 38 14.75 38 9.5C38 4.25 33.75 0 28.5 0H19Z" fill="#FF7262"/><path d="M0 9.5C0 14.75 4.25 19 9.5 19H19V0H9.5C4.25 0 0 4.25 0 9.5Z" fill="#F24E1E"/><path d="M0 28.5C0 33.75 4.25 38 9.5 38H19V19H9.5C4.25 19 0 23.25 0 28.5Z" fill="#A259FF"/></svg>';
  if (icon === 'xd') return '<span class="badge-app" style="background:#470137;color:#ff61f6">Xd</span>';
  if (icon === 'sketch') return '<svg width="28" height="26" viewBox="0 0 28 26" fill="none"><polygon points="14,1 27,9 22,25 6,25 1,9" fill="#FDB300"/><polygon points="14,1 27,9 14,25" fill="#EA6C00" opacity="0.45"/><polygon points="6,25 1,9 14,25" fill="#FFF" opacity="0.25"/></svg>';
  if (icon === 'ps') return '<span class="badge-app" style="background:#001e36;color:#31a8ff">Ps</span>';
  if (icon === 'ai') return '<span class="badge-app" style="background:#330000;color:#ff9a00">Ai</span>';
  if (icon === 'framer') return '<span class="badge-app" style="background:#0055ff;color:#fff">F</span>';
  if (icon === 'notion') return '<span class="badge-app" style="background:#ffffff;color:#000;font-family:serif;font-weight:900">N</span>';
  let path = '';
  if (icon === 'wireframe') path = '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>';
  else if (icon === 'prototype') path = '<path d="M3 3l7 18 3-7 7-3L3 3z"/>';
  else if (icon === 'research') path = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
  else if (icon === 'testing') path = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  else if (icon === 'systems') path = '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>';
  else if (icon === 'tokens') path = '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>';
  else if (icon === 'handoff') path = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>';
  else if (icon === 'ia') path = '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>';
  else if (icon === 'interaction') path = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>';
  else if (icon === 'a11y') path = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>';
  else if (icon === 'thinking') path = '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>';
  return `<span class="badge-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">${path}</svg></span>`;
}
const R = {
  about() {
    const A = PORTFOLIO.about;
    const paras = A.paragraphs.map((p, i) => `<p class="${i ? '' : 'lede'}">${esc(p).replace(/\*\*([^*]+)\*\*/g, '<strong class="about-hl">$1</strong>')}</p>`).join('');
    const tags = A.tags && A.tags.length ? `<div class="about-tags">${A.tags.map(t => `<span class="about-tag ${esc(t.type || 'neutral')}">${esc(t.name)}</span>`).join('')}</div>` : '';
    const facts = A.facts && A.facts.length ? `<div class="facts">${A.facts.map(f => `<div><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div>`).join('')}</div>` : '';
    return paras + tags + facts;
  },
  skills(inPanel = false) {
    return (inPanel ? `<p class="lede">Four stalls in Chandni Bazaar, one for each part of how I work.</p>` : '') +
      PORTFOLIO.skills.map(c => `
        <div class="skill-group">
          <div class="skill-sec-title">${esc(c.category)}</div>
          <div class="skills-grid">
            ${c.items.map(s => `
              <div class="skill-card">
                <div class="skill-icon-wrap">${skillIcon(s.icon)}</div>
                <div class="skill-name">${esc(s.name)}</div>
                <div class="skill-tag">${esc(s.tag || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
  },
  cases(i, withTitle = true) { const c = PORTFOLIO.caseStudies[i]; return `${c.cover ? `<figure class="case-cover"><img src="${esc(c.cover)}" alt="${esc(c.coverAlt || `${c.title} cover`)}"></figure>` : ''}${withTitle ? `<h2>${esc(c.title)}</h2>` : `<h3 style="margin-top:0;font-size:26px">${esc(c.title)}</h3>`}<p class="lede">${esc(c.summary)}</p><div class="case-meta"><span>Role <b>${esc(c.role)}</b></span><span>Duration <b>${esc(c.duration)}</b></span></div><h3>The problem</h3><p>${esc(c.problem)}</p><h3>Process</h3><ul class="steps">${c.process.map(s => `<li>${esc(s)}</li>`).join('')}</ul><h3>Outcome</h3><ul class="plain">${c.outcome.map(s => `<li>${esc(s)}</li>`).join('')}</ul>${c.link && c.link !== '#' ? `<p style="margin-top:18px"><a class="case-study-link" href="${esc(c.link)}">View case study <span aria-hidden="true">↗</span></a></p>` : ''}`; },
  resume() {
    const r = PORTFOLIO.resume;
    return `${r.summary ? `<p class="lede" style="margin-bottom:24px">${esc(r.summary)}</p>` : ''}<h3>Projects & Experience</h3>${r.experience.map(e => `<div class="job"><div class="when">${esc(e.start)} to ${esc(e.end)}</div><b>${esc(e.role)}</b>, ${esc(e.company)}<ul class="plain">${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`).join('')}<h3>Education</h3>${r.education.map(e => `<div class="job"><div class="when">${esc(e.years)}</div><b>${esc(e.degree)}</b>, ${esc(e.school)}</div>`).join('')}<div class="ticket"><div class="l"><span style="font-family:var(--f-label);font-weight:600">Platform 1 · PDF</span><b>Harshit Kumar Sinha — Resume</b></div><div class="r"><a href="${esc(r.pdfUrl)}" ${r.pdfUrl === '#' ? 'data-missing="1"' : 'target="_blank" rel="noopener"'}>Open PDF ↗</a></div></div>`;
  },
  contact() { const c = PORTFOLIO.contact; return `<p class="lede">Email is the fastest way to reach me. I reply within two working days.</p><div class="email"><code>${esc(c.email)}</code><button class="chip copy" data-email="${esc(c.email)}" style="cursor:pointer">Copy email</button></div><div class="links">${c.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div><h3>Send a message</h3><form class="msg" novalidate><label>Your name<input name="n" autocomplete="name"></label><label>Your email<input name="e" type="email" autocomplete="email"></label><label>Message<textarea name="m"></textarea></label><div class="err" aria-live="polite"></div><div><button class="btn btn-primary" type="submit">Send message</button></div></form>`; }
};
function wireContent(root) {
  root.querySelectorAll('.copy').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.email); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Select and copy the address'; } setTimeout(() => b.textContent = 'Copy email', 1800); });
  root.querySelectorAll('form.msg').forEach(f => f.onsubmit = e => { e.preventDefault(); const n = f.n.value.trim(), em = f.e.value.trim(), m = f.m.value.trim(), er = f.querySelector('.err');
    if (!n) { er.textContent = 'Enter your name.'; f.n.focus(); return; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { er.textContent = 'Enter a valid email address, like name@example.com.'; f.e.focus(); return; } if (!m) { er.textContent = 'Write a message before sending.'; f.m.focus(); return; }
    er.textContent = 'Opening your email app with the message ready. If nothing opens, copy the address above.'; location.href = `mailto:${PORTFOLIO.contact.email}?subject=${encodeURIComponent('Hello from ' + n)}&body=${encodeURIComponent(m + '\n\n' + n + ' (' + em + ')')}`; });
  root.querySelectorAll('a[data-missing]').forEach(a => a.onclick = e => { e.preventDefault(); toast('Add your resume PDF link in PORTFOLIO.resume.pdfUrl'); });
  root.querySelectorAll('a.case-study-link, a[href*="case-studies"]').forEach(a => a.addEventListener('click', () => {
    try {
      if (GAME && GAME.car) {
        sessionStorage.setItem('shatranj_car_state', JSON.stringify({
          x: GAME.car.x,
          z: GAME.car.z,
          yaw: GAME.car.yaw
        }));
      }
    } catch (e) {}
  }));
}

window.addEventListener('beforeunload', () => {
  try {
    if (GAME && GAME.car && (GAME.phase === 'driving' || GAME.phase === 'panel')) {
      sessionStorage.setItem('shatranj_car_state', JSON.stringify({
        x: GAME.car.x,
        z: GAME.car.z,
        yaw: GAME.car.yaw
      }));
    }
  } catch (e) {}
});

function dismissLoader(onDone) {
  const ld = $('#loader');
  if (!ld || ld.classList.contains('hidden')) {
    if (onDone) onDone();
    return;
  }
  ld.classList.add('fading');
  setTimeout(() => {
    ld.classList.add('hidden');
    ld.classList.remove('fading');
    if (onDone) onDone();
  }, 480);
}

function returnToRoad() {
  dismissLoader();
  $('#tourbar').classList.add('hidden');
  document.body.classList.remove('letterbox');
  resize();

  let savedCar = null;
  try {
    const raw = sessionStorage.getItem('shatranj_car_state');
    if (raw) savedCar = JSON.parse(raw);
  } catch (e) {}

  const c = GAME.car;
  if (savedCar && Number.isFinite(savedCar.x) && Number.isFinite(savedCar.z)) {
    Object.assign(c, { x: savedCar.x, z: savedCar.z, yaw: Number.isFinite(savedCar.yaw) ? savedCar.yaw : 0, vx: 0, vz: 0, speed: 0, auto: 0 });
  } else {
    Object.assign(c, { x: 200, z: 188, yaw: 0, vx: 0, vz: 0, speed: 0, auto: 0 });
  }
  c.px_ = c.x; c.pz_ = c.z; c.pyaw_ = c.yaw;
  if (typeof PH !== 'undefined') PH.acc = 0;
  GAME.view = c;

  CAMFX.orbit = null;
  CAMFX.tour = null;
  CAMFX.hero = null;
  GAME.phase = 'driving';

  const cam = GAME.cam;
  cam.pos = [c.x - Math.sin(c.yaw) * 6.6, 2.0, c.z - Math.cos(c.yaw) * 6.6];
  cam.look = [c.x, 0.8, c.z];
  cam.yawL = c.yaw;
  cam.orbitA = 0;
  cam.idle = 0;
  cam.off = null;
  cam.loff = null;

  $('#hud').classList.remove('hidden');
  if (!GAME.target) {
    const q = QUESTS.find(q => !GAME.visited.has(q.id));
    if (q) GAME.setTarget(q.id);
  }
  renderQuests();
  GAME.emit('driving');
  toast('Back on the road. Enjoy the drive!', 3500);
  try { $('#gl').focus(); } catch (e) {}
}

// ---------- boot ----------
let booted = false;
function setProgress(p, label) { const pct = Math.min(100, Math.round(p * 100)); $('#ldBar i').style.width = pct + '%'; $('#ldBar').setAttribute('aria-valuenow', pct); if (label) $('#ldStatus').textContent = label; }
async function boot() {
  const urlParams = new URLSearchParams(window.location.search);
  const shouldReturnToRoad = urlParams.get('return') === 'road' || 
                             urlParams.get('mode') === 'road' || 
                             urlParams.get('from') === 'wallvista' || 
                             urlParams.get('from') === 'game' || 
                             window.location.hash === '#road' || 
                             window.location.hash === '#drive';
  if (shouldReturnToRoad) {
    $('#ldStatus').textContent = 'Returning to the road...';
  }
  $('#qName').textContent = PORTFOLIO.profile.name; $('#qRole').textContent = PORTFOLIO.profile.role; $('#qTag').textContent = PORTFOLIO.profile.tagline;
  $('#ldName').textContent = PORTFOLIO.profile.name; document.querySelector('.ld-role').textContent = PORTFOLIO.profile.role;
  buildQuick(); buildQuests(); buildSpeedo(); applySettingsUI();
  GAME.reduced = store.get('motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full') === 'reduced';
  GAME.quality = store.get('quality', isCoarse ? 'low' : 'high'); GAME.tod = store.get('tod', 'auto'); GAME.minimapRotate = store.get('mm', 'rotate') === 'rotate'; GAME.assists = store.get('assist', 'on') === 'on'; GAME.brakeMode = store.get('brakeMode', 'progressive') === 'instant' ? 'instant' : 'progressive';
  applySettingsUI();
  try {
    const fontLoads = document.fonts ? Promise.all([document.fonts.load('600 40px Teko'), document.fonts.load('700 40px Rajdhani', 'शतरंज सिटी VAJRA'), document.fonts.load('500 16px Inter'), document.fonts.ready]).catch(() => { }) : Promise.resolve();
    await Promise.race([fontLoads, new Promise(r => setTimeout(r, 600))]);
    setProgress(0.08, 'Loading the city');
    await new Promise(r => requestAnimationFrame(r));
    await initGame($('#gl'), setProgress);
    buildMinimapBase(); startLoop(); booted = true;
    setProgress(1, 'Ready when you are');
    if (shouldReturnToRoad) {
      returnToRoad();
    } else {
      $('#btnStart').disabled = false; $('#ldStatus').textContent = 'Ready when you are'; $('#btnStart').focus();
    }
    $('#gl').addEventListener('webglcontextlost', e => { e.preventDefault(); openQuick(true); });
  } catch (err) {
    window.__lastErr = err.stack || err.message || String(err);
    try { fetch('/__log', { method: 'POST', body: 'BOOT ERROR: ' + window.__lastErr }).catch(() => {}); } catch {}
    const msg = err.message || '';
    if (msg === 'webgl1only') $('#ldStatus').textContent = 'WebGL 2 not available — trying WebGL 1 fallback.';
    else if (msg.startsWith('Unable to load case study cover:')) $('#ldStatus').textContent = 'The 3D city could not load the case-study cover. Opening the quick view instead.';
    else if (msg === 'canvas element not found') $('#ldStatus').textContent = 'Canvas element not found. Opening the quick view instead.';
    else $('#ldStatus').textContent = 'The 3D city needs WebGL. Opening the quick view instead.';
    console.warn(err);
    setTimeout(() => openQuick(true), 900);
  }
}
$('#btnStart').onclick = () => { if (!booted) return; dismissLoader(() => { resize(); if (store.get('tour', '0') !== '1' && !GAME.reduced) beginTour(); else { GAME.beginIntro(); } }); };
$('#btnQuick2').onclick = () => openQuick(!booted);

// ---------- tour ----------
const TOUR_CAPS = [['Ancient Temple Complex', 'प्राचीन मंदिर परिसर'], ['Old City', 'पुराना शहर'], ['Victoria Bridge', 'विक्टोरिया पुल'], ['Modern Business District', 'व्यापार केंद्र']];
let tourShot = -1;
function beginTour() { GAME.startTour(); tourShot = -1; document.body.classList.add('letterbox'); $('#tourbar').classList.remove('hidden'); $('#hud').classList.add('hidden'); $('#skipTour').focus(); }
function endTourUI() { document.body.classList.remove('letterbox'); $('#tourbar').classList.add('hidden'); store.set('tour', '1'); }
GAME.on('tourEnd', endTourUI);
$('#skipTour').onclick = () => { if (GAME.phase === 'tour') GAME.endTour(); };
GAME.on('driving', () => { $('#hud').classList.remove('hidden'); if (!GAME.target) { const q = QUESTS.find(q => !GAME.visited.has(q.id)); if (q) GAME.setTarget(q.id); } renderQuests(); toast('Follow the blue chevrons to ' + (QUESTS.find(q => q.id === GAME.target) || QUESTS[0]).name + ', or pick any quest.', 4200); });

// ---------- input ----------
const keys = new Set();
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'drift', ShiftLeft: 'boost', ShiftRight: 'boost', KeyN: 'boost', KeyB: 'ebrake' };
const touchState = { throttle: false, brake: false, ebrake: false, drift: false, boost: false, sl: false, sr: false, jx: 0, jy: 0 };
function syncInput() {
  const k = n => [...keys].some(c => KEYMAP[c] === n), pad = typeof PAD !== 'undefined' ? PAD : { thr: 0, brk: 0, steer: 0 };
  GAME.input.throttle = Math.max((k('up') || touchState.throttle || touchState.jy < -0.55) ? 1 : 0, pad.thr > 0.05 ? pad.thr : 0);
  GAME.input.brake = (k('down') || touchState.brake || touchState.jy > 0.6 || pad.brk > 0.3) ? 1 : 0;
  GAME.input.steer = clamp((k('left') ? 1 : 0) - (k('right') ? 1 : 0) + (touchState.sl ? 1 : 0) - (touchState.sr ? 1 : 0) - touchState.jx + (pad.steer || 0), -1, 1);
  GAME.input.drift = k('drift') || touchState.drift || !!pad.drift; GAME.input.boost = k('boost') || touchState.boost || !!pad.boost;
  GAME.input.ebrake = k('ebrake') || touchState.ebrake || !!pad.ebrake;
}
function overlayOpen() { return ['#panel', '#map', '#settings', '#help', '#quick'].find(s => !$(s).classList.contains('hidden')); }
addEventListener('keydown', e => {
  if (e.code === 'Escape') { const o = overlayOpen(); if (o === '#panel') closePanel(); else if (o === '#map') closeMap(); else if (o === '#settings') closeSettings(); else if (o === '#quick' && booted) closeQuick(); return; }
  if (overlayOpen() || !booted || !$('#loader').classList.contains('hidden')) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.offsetParent !== null) return;
  if (KEYMAP[e.code]) { keys.add(e.code); syncInput(); e.preventDefault(); }
  if (e.code === 'KeyE' || e.code === 'Enter') { if (GAME.nearLm && GAME.phase === 'driving') { GAME.enter(); e.preventDefault(); } }
  if (e.code === 'KeyM' && GAME.phase === 'driving') openMap();
  if (e.code === 'KeyE' || e.code === 'KeyW' || e.code === 'ArrowUp') audioKick();
});
addEventListener('keyup', e => { keys.delete(e.code); syncInput(); });
addEventListener('blur', () => { keys.clear(); syncInput(); });
document.addEventListener('visibilitychange', () => { GAME.paused = document.hidden || !$('#quick').classList.contains('hidden'); if (AUDIO.ctx) document.hidden ? AUDIO.ctx.suspend() : (GAME.sound && AUDIO.ctx.resume()); });
// touch controls
(() => {
  const joy = $('#joy'), knob = joy.querySelector('i'); let id = null;
  const move = e => { const r = joy.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } touchState.jx = Math.abs(dx) < 0.12 ? 0 : dx; touchState.jy = dy; const kr = joy.clientWidth * 0.3; knob.style.transform = `translate(calc(-50% + ${dx * kr}px), calc(-50% + ${dy * kr}px))`; syncInput(); };
  joy.addEventListener('pointerdown', e => { id = e.pointerId; try { joy.setPointerCapture(id); } catch (_) { } move(e); audioKick(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; touchState.jx = 0; touchState.jy = 0; knob.style.transform = ''; syncInput(); };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  document.querySelectorAll('.tb[data-k]').forEach(b => { const k = b.dataset.k; const on = v => { touchState[k] = v; b.classList.toggle('on', v); syncInput(); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { } on(true); audioKick(); }); b.addEventListener('pointerup', () => on(false)); b.addEventListener('pointercancel', () => on(false)); b.addEventListener('contextmenu', e => e.preventDefault()); });
  $('#tEnter').onclick = () => GAME.enter();
  const toggleBtn = $('#steerToggleBtn');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const next = DEV.steer === 'arrows' ? 'joy' : 'arrows';
      devSet('steer', next);
      toast(next === 'arrows' ? 'Switched to Arrow buttons' : 'Switched to Joystick');
    };
  }
})();

// ---------- HUD ----------
function buildQuests() { renderQuests(); $('#questToggle').onclick = () => { const q = $('#quest'); q.classList.toggle('collapsed'); $('#questToggle').textContent = q.classList.contains('collapsed') ? 'Show' : 'Hide'; $('#questToggle').setAttribute('aria-expanded', !q.classList.contains('collapsed')); }; $('#btnQuest').onclick = () => $('#quest').classList.toggle('open'); }
function routeLen() { let L = 0; const r = GAME.route; for (let i = 0; i < r.length - 1; i++) L += Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]); return L; }
const fmtD = m => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.max(10, Math.round(m / 10) * 10) + ' m';
function renderQuests() {
  $('#questList').innerHTML = QUESTS.map(q => { const done = GAME.visited.has(q.id), act = GAME.target === q.id; return `<li class="${done ? 'done' : ''}"><button data-q="${q.id}" aria-pressed="${act}" aria-label="${esc(q.name)}, ${esc(q.hint)}${done ? ', explored' : ''}. Set route."><span class="chk"></span><span class="nm">${esc(q.name)}</span><span class="dist">${act && GAME.route.length ? fmtD(routeLen()) : ''}</span></button></li>`; }).join('');
  $('#questList').querySelectorAll('button').forEach(b => b.onclick = () => { GAME.setTarget(b.dataset.q); renderQuests(); const q = QUESTS.find(q => q.id === b.dataset.q); toast(`Route set to ${q.name}, ${q.hint}`); });
  $('#expN').textContent = `${GAME.visited.size}/5`; $('#expBar').style.width = GAME.visited.size / 5 * 100 + '%';
}
let toastT = 0; function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function buildSpeedo() {
  const cx = 115, cy = 115, r = 92, a0 = 135, a1 = 405, pt = (a, rr) => [cx + Math.cos(a * Math.PI / 180) * rr, cy + Math.sin(a * Math.PI / 180) * rr];
  const arc = (from, to, rr) => { const [x0, y0] = pt(from, rr), [x1, y1] = pt(to, rr); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${rr} ${rr} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let ticks = ''; for (let i = 0; i <= 50; i++) { const a = a0 + (a1 - a0) * i / 50, big = i % 5 === 0, [x0, y0] = pt(a, r - (big ? 12 : 6)), [x1, y1] = pt(a, r); ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${i >= 40 ? '#E5484D' : '#fff'}" stroke-width="${big ? 2.4 : 1.2}" opacity="${big ? 0.95 : 0.6}"/>`; if (big) { const [tx, ty] = pt(a, r - 24); ticks += `<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}" text-anchor="middle" font-family="Teko, 'Arial Narrow', sans-serif" font-size="17" fill="${i >= 40 ? '#FF8A8E' : '#fff'}">${i / 5}</text>`; } }
  $('#speedo').innerHTML = `<defs><radialGradient id="sg" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="rgba(255,255,255,0.16)"/><stop offset="1" stop-color="rgba(14,18,32,0.55)"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="108" fill="url(#sg)" stroke="rgba(255,255,255,.85)" stroke-width="2"/>
    <path d="${arc(a0, a1, r + 7)}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="7" stroke-linecap="round"/>
    <path id="rpmArc" d="${arc(a0, a1, r + 7)}" fill="none" stroke="#3BA7FF" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/>
    <path d="${arc(a0 + (a1 - a0) * 0.8, a1, r + 7)}" fill="none" stroke="#E5484D" stroke-width="3" opacity=".9"/>
    ${ticks}
    <text id="spdN" x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="Teko, 'Arial Narrow', sans-serif" font-weight="600" font-size="62" fill="#fff">0</text>
    <text x="${cx}" y="${cy + 38}" text-anchor="middle" font-family="Rajdhani, sans-serif" font-weight="700" font-size="15" fill="#cfd8e6">km/h</text>
    <rect x="${cx - 16}" y="${cy + 46}" width="32" height="28" rx="7" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.6)"/>
    <text id="gearN" x="${cx}" y="${cy + 68}" text-anchor="middle" font-family="Teko, 'Arial Narrow', sans-serif" font-weight="600" font-size="26" fill="#fff">N</text>
    <g id="nitro" transform="translate(${cx - 44} ${cy - 44})"><path d="M8 2h8l-2 6h5l-9 12 2-8H7z" fill="#3B8FD8"/></g>
    <text id="boostPct" x="${cx - 20}" y="${cy - 29}" font-family="Rajdhani, sans-serif" font-weight="700" font-size="14" fill="#9fd0ff">100</text>`;
}
let mmBase, mapScale = 2; const MMR = 330;
function buildMinimapBase() {
  mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = MMR * 2 * mapScale; const x = mmBase.getContext('2d'); x.scale(mapScale, mapScale); x.translate(MMR, MMR);
  x.fillStyle = 'rgba(30,36,52,0.55)'; x.fillRect(-MMR, -MMR, MMR * 2, MMR * 2);
  for (const z of W.zones) { x.fillStyle = z.col + '55'; x.fillRect(z.x0, z.z0, z.x1 - z.x0, z.z1 - z.z0); }
  x.fillStyle = 'rgba(91,156,196,0.85)'; x.fillRect(-MMR, -32, MMR * 2, 64);
  x.fillStyle = 'rgba(255,255,255,0.16)'; for (const b of W.mapBld) x.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
  x.strokeStyle = 'rgba(255,255,255,0.92)'; x.lineCap = 'round';
  for (const e of W.edges) { if (!e.draw) continue; const a = W.nodes[e.a], b = W.nodes[e.b]; x.lineWidth = e.w * 0.62; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  x.lineWidth = 8; for (const [cx, cz, r] of [[0, 90, 16], [200, 170, 20.5]]) { x.beginPath(); x.arc(cx, cz, r, 0, 7); x.stroke(); }
}
function drawMinimap() {
  const cv = $('#mm'), x = cv.getContext('2d'), c = GAME.car, S = 1.9, rot = GAME.minimapRotate ? c.yaw : 0; x.clearRect(0, 0, 400, 400);
  x.save(); x.beginPath(); x.arc(200, 200, 200, 0, 7); x.clip(); x.translate(200, 200); x.rotate(rot);
  x.save(); x.scale(S / mapScale, S / mapScale); x.drawImage(mmBase, -(c.x + MMR) * mapScale, -(c.z + MMR) * mapScale); x.restore();
  if (GAME.route.length > 1) { x.save(); x.scale(S, S); x.translate(-c.x, -c.z); x.strokeStyle = '#4FC3F7'; x.lineWidth = 4.5; x.lineJoin = 'round'; x.lineCap = 'round'; x.beginPath(); GAME.route.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.restore(); }
  x.restore();
  const toMM = (wx, wz) => { const dx = (wx - c.x) * S, dz = (wz - c.z) * S, cs = Math.cos(rot), sn = Math.sin(rot); return [dx * cs - dz * sn, dx * sn + dz * cs]; };
  for (const lm of W.landmarks) { let [px, py] = toMM(lm.pin[0], lm.pin[2]); const l = Math.hypot(px, py); if (l > 176) { px *= 176 / l; py *= 176 / l; } const tg = GAME.target === lm.id, vis = GAME.visited.has(lm.id);
    x.beginPath(); x.arc(200 + px, 200 + py, tg ? 13 : 10, 0, 7); x.fillStyle = vis ? '#7FD89A' : lm.color; x.fill(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); }
  x.save(); x.translate(200, 200); x.rotate(GAME.minimapRotate ? 0 : -c.yaw); x.beginPath(); x.moveTo(0, -17); x.lineTo(11, 12); x.lineTo(0, 6); x.lineTo(-11, 12); x.closePath(); x.fillStyle = '#fff'; x.lineWidth = 3; x.strokeStyle = 'rgba(14,18,32,.7)'; x.stroke(); x.fill(); x.restore();
  const nx = 200 + Math.sin(rot) * 176, ny = 200 - Math.cos(rot) * 176; x.beginPath(); x.arc(nx, ny, 15, 0, 7); x.fillStyle = 'rgba(14,18,32,.8)'; x.fill(); x.fillStyle = '#fff'; x.font = '600 22px Teko, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', nx, ny + 2);
}
let lastDistrict = '', distT = 0, routeT = 0, questT = 0;
const HUDC = { mm: 1, el: null };
function updateHUD(dt) {
  if (!HUDC.el) HUDC.el = { spd: $('#spdN'), gear: $('#gearN'), arc: $('#rpmArc'), bar: $('#boostBar'), bn: $('#boostN'), bp: $('#boostPct'), nitro: $('#nitro') };
  const c = GAME.car; if ($('#hud').classList.contains('hidden')) return;
  const kmh = Math.round(c.speed * 3.6), rp = Math.round(clamp(c.rpm / 10, 0, 1) * 200) / 2, b = Math.round(c.boost), red = c.rpm > 8;
  if (HUDC.kmh !== kmh) { HUDC.kmh = kmh; HUDC.el.spd.textContent = kmh; } if (HUDC.gear !== c.gear) { HUDC.gear = c.gear; HUDC.el.gear.textContent = c.gear; }
  if (HUDC.rp !== rp) { HUDC.rp = rp; HUDC.el.arc.setAttribute('stroke-dasharray', `${rp} 100`); } if (HUDC.red !== red) { HUDC.red = red; HUDC.el.arc.setAttribute('stroke', red ? '#E5484D' : '#3BA7FF'); }
  if (HUDC.b !== b) { HUDC.b = b; HUDC.el.bar.style.width = b + '%'; HUDC.el.bn.textContent = b; HUDC.el.bp.textContent = b; HUDC.el.nitro.setAttribute('opacity', c.boost > 10 ? 1 : 0.35); }
  HUDC.mm += dt; if (HUDC.mm >= 1 / 30) { HUDC.mm = 0; drawMinimap(); }
  const near = GAME.nearLm && GAME.phase === 'driving';
  if (near) { const { lm, i } = GAME.nearLm; const nm = lm.id === 'cases' ? (PORTFOLIO.caseStudies[i] || {}).title : lm.name; const verb = lm.id === 'cases' ? 'open' : 'enter'; $('#prompt').innerHTML = DEV.touchOn ? `Tap Enter to ${verb} ${esc(nm)}` : `Press <kbd>E</kbd> to ${verb} ${esc(nm)}`; document.documentElement.style.setProperty('--zone', lm.color); }
  if (near && DEV.touchOn) { const { lm, i } = GAME.nearLm; const nm = lm.id === 'cases' ? (PORTFOLIO.caseStudies[i] || {}).title : lm.name; const tx = (lm.id === 'cases' ? 'Open ' : 'Enter ') + nm; if ($('#tEnter').textContent !== tx) $('#tEnter').textContent = tx; }
  $('#prompt').classList.toggle('hidden', !near); $('#tEnter').classList.toggle('hidden', !near);
  routeT += dt; if (routeT > 0.6 && GAME.phase === 'driving') { routeT = 0; GAME.refreshRoute(); }
  questT += dt; if (questT > 1) { questT = 0; const d = $('#questList .dist'); const act = $(`#questList button[aria-pressed=true] .dist`); if (act) act.textContent = GAME.route.length ? fmtD(routeLen()) : ''; }
  distT += dt; if (distT > 0.5) { distT = 0; let found = null; for (const d of DISTRICTS) { if (d.test ? d.test(c.x, c.z) : W.zones.some(z => z.name === d.zone && c.x > z.x0 && c.x < z.x1 && c.z > z.z0 && c.z < z.z1)) { found = d; break; } }
    const key = found ? found.n : ''; if (key && key !== lastDistrict) { const el = $('#district'); el.querySelector('b').textContent = found.n; el.querySelector('span').textContent = found.h; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400); } lastDistrict = key; }
}

// ---------- panels ----------
let panelLm = null, caseI = 0, lastFocus = null;
function restoreFocus(root) { const a = document.activeElement; if (a && root.contains(a)) a.blur(); const t = lastFocus; if (t && t.focus && t.offsetParent !== null && !t.closest('.ov,#quick')) t.focus({ preventScroll: true }); else $('#gl').focus({ preventScroll: true }); }
GAME.on('openPanel', ({ lm, i }) => openPanel(lm, i));
function openPanel(lm, i = 0) {
  panelLm = lm; caseI = i; lastFocus = document.activeElement; const card = $('#card'); card.style.setProperty('--zone', lm.color); document.documentElement.style.setProperty('--zone', lm.color);
  $('#panelArt').style.backgroundImage = `url(${IMG[lm.img]})`; $('#panelArt').style.backgroundPosition = ({ about: '24% 50%', skills: '50% 50%', cases: '50% 50%', resume: '50% 50%', contact: '50% 50%' })[lm.id] || 'center'; $('#panelDistrict').textContent = lm.district; $('#panelTitle').textContent = lm.name;
  fillPanel(); $('#panel').classList.remove('hidden'); $('#hud').classList.add('hidden'); $('#panelBody').focus();
  if (!GAME.visited.has(lm.id)) { GAME.visited.add(lm.id); if (GAME.target === lm.id) { const nx = QUESTS.find(q => !GAME.visited.has(q.id)); GAME.setTarget(nx ? nx.id : null); } renderQuests(); GAME.pendingToast = GAME.visited.size === 5 ? 'You have explored all of Shatranj City. Thanks for driving by.' : null; }
  playChime();
}
function fillPanel() { const id = panelLm.id; $('#panelBody').innerHTML = id === 'cases' ? R.cases(caseI) : (id === 'skills' ? '<p class="lede">Four stalls in Chandni Bazaar, one for each part of how I work.</p>' : '') + R[id](false); wireContent($('#panelBody')); $('#pager').classList.toggle('hidden', id !== 'cases'); $('#pageN').textContent = `${caseI + 1} of ${PORTFOLIO.caseStudies.length}`; $('#panelBody').scrollTop = 0; }
$('#prevCase').onclick = () => { caseI = (caseI - 1 + PORTFOLIO.caseStudies.length) % PORTFOLIO.caseStudies.length; fillPanel(); };
$('#nextCase').onclick = () => { caseI = (caseI + 1) % PORTFOLIO.caseStudies.length; fillPanel(); };
function closePanel() { if ($('#panel').classList.contains('hidden')) return; $('#panel').classList.add('hidden'); $('#hud').classList.remove('hidden'); GAME.exit(); restoreFocus($('#panel')); if (GAME.pendingToast) { toast(GAME.pendingToast, 4200); GAME.pendingToast = null; } else if (GAME.target) toast('Next stop: ' + QUESTS.find(q => q.id === GAME.target).name); }
$('#panelX').onclick = closePanel; $('#backRoad').onclick = closePanel;
$('#panel').addEventListener('mousedown', e => { if (e.target.id === 'panel') closePanel(); });
function trapFocus(root, e) { if (e.key !== 'Tab') return; const f = [...root.querySelectorAll('button,a[href],input,textarea,[tabindex="0"]')].filter(el => el.offsetParent !== null && !el.disabled); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); } }
['#panel', '#map', '#settings', '#quick'].forEach(s => $(s).addEventListener('keydown', e => trapFocus($(s), e)));

// ---------- quick view ----------
function buildQuick() {
  const secs = [['About me', R.about()], ['Skills', R.skills(false)], ['Case studies', PORTFOLIO.caseStudies.map((c, i) => `<div class="case">${R.cases(i, false)}</div>`).join('')], ['Resume', R.resume()], ['Contact', R.contact()]];
  $('#qSections').innerHTML = secs.map(([t, h]) => `<section><h2>${t}</h2><div class="body">${h}</div></section>`).join(''); wireContent($('#qSections'));
}
function openQuick(noGL) { lastFocus = document.activeElement; $('#quick').classList.remove('hidden'); $('#noglNote').classList.toggle('hidden', !noGL); $('#qDrive').classList.remove('hidden'); GAME.paused = true; $('#quick').scrollTop = 0; $('#qDrive').focus(); }
function closeQuick() { $('#quick').classList.add('hidden'); GAME.paused = false; restoreFocus($('#quick')); }
$('#btnQuick').onclick = () => openQuick(false);
$('#qDrive').onclick = () => { closeQuick(); if (booted) { if (!$('#loader').classList.contains('hidden') && !$('#loader').classList.contains('fading')) $('#btnStart').click(); } else { boot(); } };
$('#qResume').onclick = () => { const s = [...document.querySelectorAll('#qSections section')][3]; s && s.scrollIntoView({ behavior: GAME.reduced ? 'auto' : 'smooth' }); };

// ---------- map ----------
function openMap() { if (!booted) return; lastFocus = document.activeElement; $('#map').classList.remove('hidden'); drawBigMap(); $('#mapX').focus(); }
function closeMap() { $('#map').classList.add('hidden'); restoreFocus($('#map')); }
$('#btnMap').onclick = openMap; $('#minimap').onclick = openMap; $('#mapX').onclick = closeMap; $('#map').addEventListener('mousedown', e => { if (e.target.id === 'map') closeMap(); });
$('#replayTour').onclick = () => { closeMap(); if (GAME.phase === 'driving') beginTour(); };
function drawBigMap() {
  const wrap = $('#mapWrap'), cv = $('#mapCv'), dpr = Math.min(2, devicePixelRatio || 1), W_ = wrap.clientWidth, H_ = wrap.clientHeight; cv.width = W_ * dpr; cv.height = H_ * dpr;
  const x = cv.getContext('2d'); x.scale(dpr, dpr); const s = Math.min(W_, H_) / 690, ox = W_ / 2, oy = H_ / 2; const P = (wx, wz) => [ox + wx * s, oy + wz * s];
  x.fillStyle = '#EADBC0'; x.fillRect(0, 0, W_, H_);
  x.save(); x.translate(ox, oy); x.scale(s, s);
  for (const z of W.zones) { x.fillStyle = z.col + '66'; x.fillRect(z.x0, z.z0, z.x1 - z.x0, z.z1 - z.z0); }
  x.fillStyle = '#7FB3D1'; x.fillRect(-330, -32, 660, 64);
  x.fillStyle = 'rgba(80,60,30,0.2)'; for (const b of W.mapBld) x.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
  x.lineCap = 'round'; for (const pass of [0, 1]) for (const e of W.edges) { if (!e.draw) continue; const a = W.nodes[e.a], b = W.nodes[e.b]; x.lineWidth = e.w * 0.8 + (pass ? 0 : 3); x.strokeStyle = pass ? '#FBF6EC' : 'rgba(60,45,25,.55)'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  for (const pass of [0, 1]) for (const [cx, cz, r] of [[0, 90, 16], [200, 170, 20.5]]) { x.lineWidth = pass ? 10 : 13; x.strokeStyle = pass ? '#FBF6EC' : 'rgba(60,45,25,.55)'; x.beginPath(); x.arc(cx, cz, r, 0, 7); x.stroke(); }
  if (GAME.route.length > 1) { x.strokeStyle = '#1E88C8'; x.lineWidth = 5; x.beginPath(); GAME.route.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }
  x.restore();
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${Math.round(clamp(W_ / 70, 11, 15))}px Rajdhani, 'Arial Narrow', sans-serif`; x.lineJoin = 'round';
  for (const [t, lx, lz] of [['OLD CITY', -60, -150], ['RESIDENTIAL', -215, -236], ['TEMPLE COMPLEX', 208, -236], ['MARKET DISTRICT', -200, 178], ['BUSINESS DISTRICT', 120, 286], ['CENTRAL PARK', 0, 250], ['RAILWAY JUNCTION', -78, -290], ['CYBER-CHOWK', 200, 214], ['RIVER', -262, 0]]) { const [px, py] = P(lx, lz); x.lineWidth = 4; x.strokeStyle = 'rgba(245,236,218,.9)'; x.strokeText(t, px, py); x.fillStyle = 'rgba(42,32,18,.82)'; x.fillText(t, px, py); }
  const c = GAME.car, [cx, cy] = P(c.x, c.z); x.save(); x.translate(cx, cy); x.rotate(-c.yaw); x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 9); x.lineTo(0, 4); x.lineTo(-8, 9); x.closePath(); x.fillStyle = '#0A5AA8'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); x.restore();
  wrap.querySelectorAll('.ft').forEach(n => n.remove());
  for (const lm of W.landmarks) { const [px, py] = P(lm.pin[0], lm.pin[2]); x.beginPath(); x.arc(px, py, 8, 0, 7); x.fillStyle = GAME.visited.has(lm.id) ? '#4FA35A' : lm.color; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.stroke();
    const b = document.createElement('button'); b.className = 'ft'; b.style.left = px + 'px'; b.style.top = (py - 12) + 'px'; b.textContent = lm.name; b.setAttribute('aria-label', `Fast travel to ${lm.name}, ${lm.district}`); b.onclick = () => fastTravel(lm.id); wrap.appendChild(b); }
}
function fastTravel(id) { closeMap(); const t = TRAVEL[id]; $('#fade').classList.add('on'); setTimeout(() => { GAME.teleport(t[0], t[1], t[2]); GAME.setTarget(id); renderQuests(); $('#fade').classList.remove('on'); toast('Fast travelled to ' + QUESTS.find(q => q.id === id).name); }, GAME.reduced ? 0 : 300); }

// ---------- settings ----------
function applySettingsUI() { const vals = { cam: GAME.camMode, hud: DEV.hud, steer: DEV.steer, tc: DEV.tc, tod: GAME.tod, quality: GAME.quality, sound: GAME.sound ? 'on' : 'off', mm: GAME.minimapRotate ? 'rotate' : 'north', motion: GAME.reduced ? 'reduced' : 'full', assist: GAME.assists === false ? 'off' : 'on', brakeMode: GAME.brakeMode || 'progressive' }; document.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', vals[sg.dataset.set] === b.dataset.v))); }
document.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { const k = sg.dataset.set, v = b.dataset.v;
  if (k === 'tod') { GAME.tod = v; store.set('tod', v); } if (k === 'quality') { store.set('quality', v); if (booted) GAME.setQuality(v); else GAME.quality = v; } if (k === 'sound') setSound(v === 'on'); if (k === 'mm') { GAME.minimapRotate = v === 'rotate'; store.set('mm', v); } if (k === 'motion') { GAME.reduced = v === 'reduced'; store.set('motion', v); }
  if (k === 'assist') { GAME.assists = v === 'on'; store.set('assist', v); } if (k === 'brakeMode') { GAME.brakeMode = v; store.set('brakeMode', v); } if (k === 'cam') { GAME.setCamMode(v); return; } if (k === 'hud' || k === 'steer' || k === 'tc') devSet(k, v);
  applySettingsUI(); }));
function openSettings() { lastFocus = document.activeElement; $('#settings').classList.remove('hidden'); $('#setX').focus(); }
function closeSettings() { $('#settings').classList.add('hidden'); restoreFocus($('#settings')); }
$('#btnSettings').onclick = openSettings; $('#setX').onclick = closeSettings; $('#settings').addEventListener('mousedown', e => { if (e.target.id === 'settings') closeSettings(); });
$('#btnFull').onclick = () => { const d = document; try { const r = !d.fullscreenElement ? (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen || (() => { })).call(d.documentElement) : d.exitFullscreen(); if (r && r.catch) r.catch(() => toast('Full screen is not available here')); } catch (e) { toast('Full screen is not available here'); } };

// ---------- audio (off by default) ----------
const AUDIO = {};
function setSound(on) { GAME.sound = on; $('#btnSound').setAttribute('aria-pressed', on); $('#btnSound').setAttribute('aria-label', on ? 'Sound on' : 'Sound off'); $('#sndWave').setAttribute('d', on ? 'M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14' : 'M16 9l5 6M21 9l-5 6'); if (on) initAudio(); if (AUDIO.ctx) on ? AUDIO.ctx.resume() : AUDIO.ctx.suspend(); applySettingsUI(); }
$('#btnSound').onclick = () => setSound(!GAME.sound);
function initAudio() {
  if (AUDIO.ctx) return; const C = new (window.AudioContext || window.webkitAudioContext)(); AUDIO.ctx = C; const master = C.createGain(); master.gain.value = 0.55; master.connect(C.destination);
  const o1 = C.createOscillator(), o2 = C.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const eg = C.createGain(); eg.gain.value = 0.0;
  o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(master); o1.start(); o2.start();
  const nb = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = C.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6; const sq = C.createGain(); sq.gain.value = 0; ns.connect(bp); bp.connect(sq); sq.connect(master);
  const wb = C.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 700; wb.Q.value = 0.8; const wg = C.createGain(); wg.gain.value = 0; ns.connect(wb); wb.connect(wg); wg.connect(master); ns.start();
  Object.assign(AUDIO, { o1, o2, lp, eg, sq, wg, wb, master });
}
function audioKick() { if (GAME.sound && AUDIO.ctx && AUDIO.ctx.state !== 'running') AUDIO.ctx.resume(); }
function updateAudio() { if (!GAME.sound || !AUDIO.ctx) return; const c = GAME.car, t = AUDIO.ctx.currentTime, f = 42 + c.rpm * 30; AUDIO.o1.frequency.setTargetAtTime(f, t, 0.05); AUDIO.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05); AUDIO.lp.frequency.setTargetAtTime(500 + c.rpm * 320 + (c.boosting ? 900 : 0), t, 0.08);
  const run = GAME.phase !== 'tour' && GAME.phase !== 'loading'; AUDIO.eg.gain.setTargetAtTime(run ? 0.05 + (c.throttle ? 0.05 : 0) : 0, t, 0.1); AUDIO.sq.gain.setTargetAtTime(c.drifting && run ? 0.07 : 0, t, 0.06); AUDIO.wg.gain.setTargetAtTime(c.boosting ? 0.18 : clamp((c.speed - 20) / 60, 0, 0.08), t, 0.12); AUDIO.wb.frequency.setTargetAtTime(500 + c.speed * 30, t, 0.2); }
function playChime() { if (!GAME.sound || !AUDIO.ctx) return; const C = AUDIO.ctx, t = C.currentTime; [659, 988].forEach((f, i) => { const o = C.createOscillator(), g = C.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.12, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.6); o.connect(g); g.connect(AUDIO.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.7); }); }
GAME.on('gulal', () => { if (!GAME.sound || !AUDIO.ctx) return; const t = AUDIO.ctx.currentTime; AUDIO.wg.gain.setValueAtTime(0.3, t); AUDIO.wg.gain.setTargetAtTime(0, t + 0.05, 0.2); });

// ---------- 2D overlay: speed streaks + lens flare ----------
const fxc = $('#fx'), fx2 = fxc.getContext('2d'); const streaks = [];
function sizeFX() { const d = Math.min(2, devicePixelRatio || 1); fxc.width = innerWidth * d; fxc.height = innerHeight * d; fx2.setTransform(d, 0, 0, d, 0, 0); }
sizeFX(); addEventListener('resize', () => { sizeFX(); if (!$('#map').classList.contains('hidden')) drawBigMap(); });
const FXD = { dirty: true };
function drawFX(dt) {
  const w = innerWidth, h = innerHeight, c = GAME.car; if (FXD.dirty) { fx2.clearRect(0, 0, w, h); FXD.dirty = false; } if (!booted || GAME.phase === 'loading') return;
  const k = GAME.reduced ? 0 : clamp((c.speed - 26) / 22, 0, 1) + (c.boosting ? 0.4 : 0);
  if (k > 0.02 && GAME.phase === 'driving') { const n = Math.floor(k * 5); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r0 = 0.32 + Math.random() * 0.25; streaks.push({ a, r: r0, v: 1.6 + Math.random() * 1.6, l: 0.06 + Math.random() * 0.12, life: 0.35 }); } }
  fx2.lineCap = 'round'; if (streaks.length) FXD.dirty = true;
  for (let i = streaks.length - 1; i >= 0; i--) { const s = streaks[i]; s.life -= dt; s.r += s.v * dt; if (s.life <= 0 || s.r > 1.2) { streaks.splice(i, 1); continue; } const cx = w / 2, cy = h * 0.55, R = Math.hypot(w, h) / 2; const x0 = cx + Math.cos(s.a) * s.r * R, y0 = cy + Math.sin(s.a) * s.r * R * 0.8, x1 = cx + Math.cos(s.a) * (s.r + s.l) * R, y1 = cy + Math.sin(s.a) * (s.r + s.l) * R * 0.8; fx2.strokeStyle = c.boosting ? `rgba(200,230,255,${s.life * 1.3})` : `rgba(255,255,255,${s.life})`; fx2.lineWidth = 1.5; fx2.beginPath(); fx2.moveTo(x0, y0); fx2.lineTo(x1, y1); fx2.stroke(); }
  // lens flare toward the sun in golden light
  const m = GAME.mood, vp = GAME.lastVP; if (!m || !vp || GAME.reduced) return; const warm = 1 - (GAME.neonW || 0); if (warm < 0.3 || m.sunSize < 0.0005 || m.night > 0.5) return;
  const e = GAME.cam.pos, sp = [e[0] + m.sunDir[0] * 1000, e[1] + m.sunDir[1] * 1000, e[2] + m.sunDir[2] * 1000];
  const cx_ = vp[0] * sp[0] + vp[4] * sp[1] + vp[8] * sp[2] + vp[12], cy_ = vp[1] * sp[0] + vp[5] * sp[1] + vp[9] * sp[2] + vp[13], cw = vp[3] * sp[0] + vp[7] * sp[1] + vp[11] * sp[2] + vp[15];
  if (cw <= 0) return; const nx = cx_ / cw, ny = cy_ / cw; if (Math.abs(nx) > 1.15 || Math.abs(ny) > 1.15) return;
  const vis = GAME.sunVis == null ? 1 : GAME.sunVis; if (vis < 0.05) return;
  const sx = (nx * 0.5 + 0.5) * w, sy = (1 - (ny * 0.5 + 0.5)) * h, a = warm * vis * (1 - Math.max(Math.abs(nx), Math.abs(ny)) * 0.6); FXD.dirty = true;
  let g = fx2.createRadialGradient(sx, sy, 0, sx, sy, 180); g.addColorStop(0, `rgba(255,246,220,${0.55 * a})`); g.addColorStop(0.3, `rgba(255,200,120,${0.18 * a})`); g.addColorStop(1, 'rgba(255,200,120,0)'); fx2.fillStyle = g; fx2.fillRect(sx - 180, sy - 180, 360, 360);
  fx2.save(); fx2.translate(sx, sy); fx2.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { fx2.rotate(Math.PI / 4 + 0.05); const L = i % 2 ? 90 : 170; const gr = fx2.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, `rgba(255,240,210,${0.35 * a})`); gr.addColorStop(1, 'rgba(255,240,210,0)'); fx2.fillStyle = gr; fx2.fillRect(0, -1.2, L, 2.4); } fx2.restore();
  fx2.globalCompositeOperation = 'lighter'; const dx = w / 2 - sx, dy = h / 2 - sy; [[0.45, 26, '120,200,255'], [0.8, 14, '255,160,90'], [1.25, 42, '140,255,190'], [1.6, 20, '200,140,255']].forEach(([t, r, col]) => { const gx = sx + dx * t, gy = sy + dy * t; const gg = fx2.createRadialGradient(gx, gy, 0, gx, gy, r); gg.addColorStop(0, `rgba(${col},${0.16 * a})`); gg.addColorStop(0.7, `rgba(${col},${0.08 * a})`); gg.addColorStop(1, `rgba(${col},0)`); fx2.fillStyle = gg; fx2.beginPath(); fx2.arc(gx, gy, r, 0, 7); fx2.fill(); }); fx2.globalCompositeOperation = 'source-over';
}
// sun occlusion probe: one pixel read back asynchronously (PBO + fence), so the GPU is never stalled
let probeT = 0; const SUNQ = { pbo: null, sync: null };
function probeSun(dt) {
  if (SUNQ.sync) { const st = gl.clientWaitSync(SUNQ.sync, 0, 0); if (st === gl.TIMEOUT_EXPIRED) return; gl.deleteSync(SUNQ.sync); SUNQ.sync = null;
    const buf = new Uint8Array(4); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, SUNQ.pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, buf); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const lum = (buf[0] + buf[1] + buf[2]) / 765; GAME.sunVis = damp(GAME.sunVis == null ? 1 : GAME.sunVis, lum > 0.86 ? 1 : 0, 8, 0.25); return; }
  probeT += dt; if (probeT < 0.25) return; probeT = 0; const m = GAME.mood, vp = GAME.lastVP; if (!m || !vp || m.night > 0.5) return;
  const e = GAME.cam.pos, sp = [e[0] + m.sunDir[0] * 1000, e[1] + m.sunDir[1] * 1000, e[2] + m.sunDir[2] * 1000];
  const X = vp[0] * sp[0] + vp[4] * sp[1] + vp[8] * sp[2] + vp[12], Y = vp[1] * sp[0] + vp[5] * sp[1] + vp[9] * sp[2] + vp[13], Wc = vp[3] * sp[0] + vp[7] * sp[1] + vp[11] * sp[2] + vp[15]; if (Wc <= 0) { GAME.sunVis = 0; return; }
  const nx = X / Wc, ny = Y / Wc; if (Math.abs(nx) > 1 || Math.abs(ny) > 1) { GAME.sunVis = 0.6; return; }
  try {
    if (!SUNQ.pbo) { SUNQ.pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, SUNQ.pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ); }
    const px = clamp(Math.floor((nx * 0.5 + 0.5) * gl.canvas.width), 0, gl.canvas.width - 1), py = clamp(Math.floor((ny * 0.5 + 0.5) * gl.canvas.height), 0, gl.canvas.height - 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, SUNQ.pbo); gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    SUNQ.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
  } catch (err) { GAME.sunVis = 1; }
}

// ---------- per-frame UI hook ----------
GAME.on('frame', dt => {
  if (GAME.phase === 'tour' && CAMFX.tour) { const s = Math.floor(CAMFX.tour.t / CAMFX.tour.len); if (s !== tourShot && s < TOUR_CAPS.length) { tourShot = s; const cap = TOUR_CAPS[s]; $('#tourCap').innerHTML = `<span>Shatranj City</span>${esc(cap[0])}`; if (s > 0) { $('#fade').classList.add('on'); setTimeout(() => $('#fade').classList.remove('on'), 160); } } }
  probeSun(dt); updateHUD(dt); updateAudio(); drawFX(dt);
});
window.__game = { GAME, W, TRAFFIC, openPanel, openQuick, R };
