'use strict';
// ============================================================
// GAME — VAJRA-S1, physics, camera, traffic, FX, render
// ============================================================
const MOODS = {
  golden: { skyTop: '#9FB0BC', skyMid: '#D9C7A6', skyHor: '#EFD3A0', sunDir: [-0.74, 0.2, 0.52], sunCol: [1.10, 0.92, 0.68], sunGlow: '#E2A252', sunSize: 0.0015,
    ambSky: [0.52, 0.5, 0.52], ambGnd: [0.38, 0.3, 0.23], fogCol: '#E5C28F', fog: [80, 1250], water: '#5E5446', night: 0, wet: 0, clouds: 0.55, bloom: 0.2, emis: 0.8 },
  midday: { skyTop: '#4F8FD8', skyMid: '#8DB6E0', skyHor: '#C9DCEB', sunDir: [-0.3, 0.85, -0.43], sunCol: [1.06, 1.03, 0.98], sunGlow: '#FFFFFF', sunSize: 0.0012,
    ambSky: [0.4, 0.45, 0.54], ambGnd: [0.3, 0.27, 0.22], fogCol: '#D6E2EA', fog: [120, 1400], water: '#2F5C78', night: 0, wet: 0, clouds: 0.65, bloom: 0.18, emis: 0.7 },
  neon: { skyTop: '#262A6E', skyMid: '#3A3A94', skyHor: '#5242B1', sunDir: [-0.35, 0.75, -0.45], sunCol: [0.26, 0.24, 0.46], sunGlow: '#A73CCD', sunSize: 0.0,
    ambSky: [0.3, 0.28, 0.58], ambGnd: [0.12, 0.1, 0.22], fogCol: '#3A3180', fog: [50, 1250], water: '#161a44', night: 1, wet: 1, clouds: 0.35, bloom: 0.95, emis: 1.3 }
};
function moodVec(m) {
  const c = h => typeof h === 'string' ? hex(h) : h;
  const sunD = V3.norm(m.sunDir);
  const moonD = m.moonDir ? V3.norm(m.moonDir) : V3.norm([-sunD[0], -sunD[1] + 0.12, -sunD[2]]);
  return {
    skyTop: c(m.skyTop), skyMid: c(m.skyMid), skyHor: c(m.skyHor),
    sunDir: sunD, sunCol: m.sunCol, sunGlow: c(m.sunGlow), sunSize: m.sunSize,
    moonDir: moonD, moonCol: m.moonCol || [0.88, 0.94, 1.0], moonSize: m.moonSize !== undefined ? m.moonSize : 0.0018,
    ambSky: m.ambSky, ambGnd: m.ambGnd, fogCol: c(m.fogCol), fog: m.fog.slice(), water: c(m.water),
    night: m.night, wet: m.wet, clouds: m.clouds !== undefined ? m.clouds : 0.58, bloom: m.bloom, emis: m.emis
  };
}
function mixMood(a, b, t) {
  const o = {};
  for (const k in a) {
    const va = a[k], vb = b[k];
    o[k] = (Array.isArray(va) && Array.isArray(vb)) ? va.map((v, i) => lerp(v, vb[i], t)) : lerp(va, (vb !== undefined ? vb : va), t);
  }
  o.sunDir = V3.norm(o.sunDir);
  if (o.moonDir) o.moonDir = V3.norm(o.moonDir);
  return o;
}

const GAME = {
  phase: 'loading', t: 0, quality: 'high', tod: 'auto', reduced: false, sound: false, minimapRotate: true,
  car: { x: 0, z: 154, yaw: 0, vx: 0, vz: 0, steer: 0, boost: 100, boosting: false, drifting: false, roll: 0, pitch: 0, spin: 0, speed: 0, vf: 0, rpm: 0, gear: 'N', lastImpact: 0, auto: 0 },
  cam: { pos: [0, 3, 170], look: [0, 1, 150], yawL: 0, fov: 60, shake: 0, idle: 0, orbitA: 0 },
  input: { throttle: 0, brake: 0, steer: 0, drift: false, boost: false },
  visited: new Set(), activeLm: null, nearLm: null, target: null, route: [],
  mood: null, events: {}
};
GAME.on = (e, f) => (GAME.events[e] = GAME.events[e] || []).push(f);
GAME.emit = (e, d) => (GAME.events[e] || []).forEach(f => f(d));

let P = {}, MESH = {}, TEX = {}, QUAD, statics;

// ---------- car + vehicle meshes ----------
// ---------- realistic pedestrian archetypes (6 culturally authentic roles with human anatomy) ----------
function buildPedArchetype(arch, ci = 0) {
  const skinCols = [hex('#9e6c4e'), hex('#8d5e3e'), hex('#825438'), hex('#926242'), hex('#8f5f40'), hex('#88583b')];
  const lipCols = [hex('#8b4343'), hex('#7c3a3a'), hex('#924c4c'), hex('#7f3d3d'), hex('#844242'), hex('#783838')];
  const skin = skinCols[arch % skinCols.length];
  const lips = lipCols[arch % skinCols.length];
  const hair = hex('#141210'), gold = hex('#e5b042');

  const Gbody = new Geo();
  const Ghead = new Geo(), Gjaw = new Geo();
  const Gthigh = new Geo(), Gshin = new Geo();
  const GarmUpL = new Geo(), GarmLowL = new Geo();
  const GarmUpR = new Geo(), GarmLowR = new Geo();

  // Ultra-realistic sculpted human facial anatomy & features (eyes, whites, pupils, eyelids, nose, lips, ears)
  function addHumanFace(Gh, Gj, sCol, hCol, lCol, archId) {
    // Sculpted neck & throat
    Gh.prism(0, 0, 0, 0.052, 0.048, 0.09, 8, sCol);
    if (archId !== 0) Gh.box(0, 0.045, 0.040, 0.016, 0.022, 0.010, sCol); // Adam's apple for males

    // Cranium & facial structure
    Gh.prism(0, 0.11, -0.01, 0.095, 0.092, 0.16, 8, sCol);
    Gh.box(0, 0.13, 0.045, 0.145, 0.10, 0.08, sCol); // Cheekbones & temples

    // Eyes: white sclera, dark iris/pupil, catchlight glint, eyelid crease, arched eyebrow
    for (const s of [-1, 1]) {
      // Eye socket rim
      Gh.box(s * 0.038, 0.142, 0.084, 0.028, 0.020, 0.012, hex('#281a14'));
      // Sclera (pure clean eye white)
      Gh.box(s * 0.038, 0.142, 0.088, 0.024, 0.015, 0.008, hex('#f8f9fa'));
      // Dark expressive iris & pupil
      Gh.box(s * 0.038, 0.142, 0.094, 0.013, 0.013, 0.006, hex('#110c08'));
      // Catchlight glint
      Gh.box(s * 0.036, 0.145, 0.097, 0.004, 0.004, 0.003, hex('#ffffff'), 1, 0.5);
      // Eyelid line
      Gh.box(s * 0.038, 0.151, 0.090, 0.026, 0.005, 0.008, hex('#1e1410'));
      // Arched eyebrow
      Gh.beam([s * 0.022, 0.158, 0.088], [s * 0.054, 0.160, 0.082], 0.009, hCol);
      // Sculpted ear
      Gh.box(s * 0.10, 0.125, -0.01, 0.018, 0.046, 0.028, sCol);
      Gh.box(s * 0.098, 0.098, -0.01, 0.014, 0.016, 0.020, sCol);
    }

    // Sculpted human nose with defined nasal bridge and nostrils
    Gh.beam([0, 0.152, 0.085], [0, 0.125, 0.108], 0.018, sCol);
    Gh.box(0, 0.120, 0.110, 0.022, 0.018, 0.020, sCol); // Nose tip
    Gh.box(-0.014, 0.118, 0.104, 0.010, 0.012, 0.012, sCol); // Left nostril
    Gh.box(0.014, 0.118, 0.104, 0.010, 0.012, 0.012, sCol); // Right nostril

    // Upper lip with cupid's bow
    Gh.box(0, 0.106, 0.094, 0.012, 0.014, 0.008, sCol); // Philtrum
    Gh.box(0, 0.098, 0.096, 0.036, 0.009, 0.012, lCol); // Upper lip

    // Animated articulated lower jaw & chin (mouth moves while talking!)
    Gj.box(0, 0.006, 0.070, 0.034, 0.010, 0.012, lCol); // Lower lip
    Gj.prism(0, -0.025, 0.020, 0.065, 0.078, 0.065, 6, sCol); // Jawline
    Gj.box(0, -0.015, 0.060, 0.032, 0.030, 0.025, sCol); // Rounded chin
  }

  addHumanFace(Ghead, Gjaw, skin, hair, lips, arch);

  if (arch === 0) { // 1. Traditional Saree (Woman with pleated saree, pallu, bindi, gajra, bangles)
    const sareeCols = [hex('#9b1e36'), hex('#186355'), hex('#1e3f8b'), hex('#8b1e6d')];
    const border = hex('#f2b238'), saree = sareeCols[ci % sareeCols.length];
    // Midriff + fitted choli blouse
    Gbody.prism(0, 0.82, 0, 0.18, 0.18, 0.08, 8, skin);
    Gbody.prism(0, 0.90, 0, 0.19, 0.22, 0.44, 8, saree);
    // Diagonal draped pallu across chest to left shoulder, flowing down back
    Gbody.beam([0.16, 0.88, 0.10], [-0.20, 1.34, -0.04], 0.12, border);
    Gbody.beam([-0.20, 1.34, -0.04], [-0.18, 0.65, -0.14], 0.14, saree);
    // Gold necklace around neck
    Gbody.annulus(0, 1.32, 0, 0.065, 0.085, 8, gold, 11);

    // Facial cosmetics: red bindi, gold nose stud, jhumka earrings, jasmine gajra
    Ghead.box(0, 0.165, 0.096, 0.016, 0.020, 0.010, hex('#b71c1c'), 0, 0.5); // Bindi
    Ghead.box(0.016, 0.122, 0.108, 0.006, 0.006, 0.006, gold, 11); // Gold nath
    for (const s of [-1, 1]) {
      Ghead.prism(s * 0.105, 0.085, -0.01, 0.012, 0.024, 0.032, 6, gold, 11); // Dangling jhumkas
    }
    // Hair bun with white jasmine gajra
    Ghead.prism(0, 0.18, -0.02, 0.12, 0.11, 0.13, 8, hair);
    Ghead.prism(0, 0.08, -0.12, 0.07, 0.07, 0.09, 8, hair);
    Ghead.prism(0, 0.08, -0.12, 0.088, 0.088, 0.05, 10, hex('#ffffff'), 0, 0.25);

    // FULL TWO-JOINT LEG ARTICULATION FOR SAREE: Pleated silk wrap + bells + footwear!
    Gthigh.box(0, -0.19, 0, 0.13, 0.38, 0.14, saree);
    Gthigh.box(0, -0.19, 0.07, 0.13, 0.38, 0.02, border);

    Gshin.box(0, -0.16, 0, 0.12, 0.32, 0.13, saree);
    Gshin.box(0, -0.32, 0, 0.135, 0.06, 0.145, border);
    Gshin.box(0, -0.34, 0, 0.11, 0.025, 0.12, hex('#c0c8d0'), 11); // Silver payal anklet
    Gshin.box(0, -0.38, 0.05, 0.10, 0.06, 0.19, border); // Traditional sandals

    // Articulated arms with gold bangles
    for (const armUp of [GarmUpL, GarmUpR]) {
      armUp.box(0, -0.14, 0, 0.085, 0.28, 0.085, saree);
    }
    for (const armLow of [GarmLowL, GarmLowR]) {
      armLow.box(0, -0.12, 0, 0.075, 0.22, 0.075, skin);
      armLow.box(0, -0.22, 0, 0.08, 0.04, 0.08, gold, 11); // Bangles
      armLow.box(0, -0.26, 0.01, 0.06, 0.08, 0.06, skin);
    }
  } else {
    let pantCol = hex('#f4f1ea'), shoeCol = hex('#4a2b15'), topCol = hex('#f5ead4');
    if (arch === 1) { // 2. Royal Kurta-Pyjama & Rajasthani Pagri
      topCol = hex('#f5ead4'); pantCol = hex('#f4f1ea'); shoeCol = hex('#4a2b15');
      Gbody.prism(0, 0.82, 0, 0.21, 0.22, 0.23, 8, topCol);
      Gbody.prism(0, 0.52, 0, 0.23, 0.21, 0.30, 8, topCol);
      Gbody.prism(0, 1.05, 0, 0.22, 0.24, 0.32, 8, topCol);
      Gbody.box(0, 1.18, 0, 0.44, 0.36, 0.26, hex('#7d1b28'));
      Gbody.box(0, 1.18, 0.135, 0.03, 0.34, 0.02, gold, 11);
      Gbody.prism(0, 1.34, 0, 0.085, 0.085, 0.05, 8, hex('#7d1b28'));

      // Curled Rajasthani mustache & royal Pagri turban with jewel sarpech
      Ghead.box(0, 0.105, 0.105, 0.085, 0.022, 0.02, hair);
      Ghead.beam([-0.04, 0.105, 0.10], [-0.065, 0.122, 0.09], 0.012, hair);
      Ghead.beam([0.04, 0.105, 0.10], [0.065, 0.122, 0.09], 0.012, hair);
      Ghead.prism(0, 0.22, -0.01, 0.165, 0.155, 0.15, 10, hex('#e25b1d'));
      Ghead.box(0, 0.35, 0.08, 0.12, 0.10, 0.08, hex('#e25b1d'));
      Ghead.box(0, 0.31, 0.15, 0.03, 0.06, 0.02, gold, 11, 0.5);
      Ghead.box(0, 0.11, -0.15, 0.06, 0.26, 0.03, hex('#e25b1d'));
    } else if (arch === 2) { // 3. Chai-Wallah & Market Vendor
      topCol = hex('#dcd7ce'); pantCol = hex('#e0dad0'); shoeCol = hex('#2e2620');
      Gbody.prism(0, 0.82, 0, 0.21, 0.23, 0.54, 8, topCol);
      Gbody.beam([0.16, 0.85, 0.12], [0.18, 1.36, -0.02], 0.10, hex('#1f4e8b'));
      Gbody.beam([0.18, 1.36, -0.02], [0.16, 0.90, -0.14], 0.10, hex('#1f4e8b'));
      Gbody.box(0, 0.94, 0.11, 0.34, 0.26, 0.04, hex('#a69375'));
      Gbody.box(0, 1.05, 0, 0.44, 0.04, 0.24, hex('#857357'));

      // Bandana, salt-and-pepper hair, stubble in jaw
      Ghead.prism(0, 0.20, 0, 0.13, 0.13, 0.07, 8, hex('#b71c1c'));
      Ghead.prism(0, 0.27, 0, 0.11, 0.08, 0.06, 8, hair);
      Gjaw.box(0, -0.02, 0.05, 0.065, 0.04, 0.04, hex('#28201a'));
    } else if (arch === 3) { // 4. Modern Urban Youth / Techie
      topCol = hex('#e65100'); pantCol = hex('#1e2530'); shoeCol = hex('#ffffff');
      Gbody.prism(0, 0.82, 0, 0.22, 0.25, 0.54, 8, topCol);
      Gbody.box(0, 0.92, 0.13, 0.28, 0.16, 0.04, hex('#c2410c'));
      Gbody.prism(0, 1.30, -0.10, 0.12, 0.10, 0.12, 8, topCol);
      Gbody.box(0, 1.10, -0.16, 0.28, 0.36, 0.14, hex('#1a1c20'));

      // Taper haircut & glowing headphones
      Ghead.prism(0, 0.19, -0.01, 0.115, 0.095, 0.11, 8, hair);
      Ghead.annulus(0, 0.14, 0, 0.10, 0.145, 10, hex('#22252a'));
      Ghead.box(-0.13, 0.12, 0, 0.04, 0.08, 0.06, hex('#61f1f6'), 1, 1.8);
      Ghead.box(0.13, 0.12, 0, 0.04, 0.08, 0.06, hex('#61f1f6'), 1, 1.8);
    } else if (arch === 4) { // 5. Tech & Design Professional
      topCol = hex('#1c2536'); pantCol = hex('#a89886'); shoeCol = hex('#1a1412');
      Gbody.prism(0, 0.82, 0, 0.21, 0.24, 0.54, 8, topCol);
      Gbody.box(0, 1.20, 0.12, 0.22, 0.26, 0.02, hex('#141c29'));
      Gbody.prism(0, 1.25, 0.06, 0.08, 0.10, 0.14, 6, hex('#e8eef5'));
      Gbody.beam([-0.18, 1.34, 0.08], [0.18, 0.88, -0.06], 0.04, hex('#3e2723'));
      Gbody.box(0.24, 0.80, 0, 0.08, 0.24, 0.26, hex('#3e2723'));
      Gbody.box(0.28, 0.80, 0, 0.02, 0.04, 0.04, gold, 11);

      // Trimmed hair & stylish spectacles
      Ghead.prism(0, 0.19, -0.01, 0.11, 0.09, 0.10, 8, hair);
      Ghead.box(0, 0.145, 0.105, 0.15, 0.025, 0.015, hex('#181818'));
      Ghead.box(-0.038, 0.145, 0.108, 0.036, 0.024, 0.005, hex('#60a5fa'), 1, 0.4);
      Ghead.box(0.038, 0.145, 0.108, 0.036, 0.024, 0.005, hex('#60a5fa'), 1, 0.4);
    } else if (arch === 5) { // 6. Bazaar Merchant & Artisan
      topCol = hex('#d97724'); pantCol = hex('#e5e7eb'); shoeCol = hex('#5c3a21');
      Gbody.prism(0, 0.82, 0, 0.22, 0.23, 0.54, 8, topCol);
      Gbody.box(0, 1.15, 0.12, 0.16, 0.26, 0.03, hex('#fbbf24'));

      // Mustache & embroidered topi skullcap
      Ghead.box(0, 0.105, 0.105, 0.075, 0.022, 0.02, hair);
      Ghead.prism(0, 0.20, 0, 0.125, 0.115, 0.09, 8, hex('#7f1d1d'));
      Ghead.annulus(0, 0.17, 0, 0.10, 0.13, 8, gold, 11);
    }

    // Articulated legs: Thigh + Shin with Ankle and Shoe
    Gthigh.box(0, -0.19, 0, 0.12, 0.38, 0.13, pantCol);
    Gshin.box(0, -0.18, 0, 0.10, 0.36, 0.11, pantCol);
    Gshin.box(0, -0.38, 0.05, 0.105, 0.07, 0.20, shoeCol);
    if (arch === 1) Gshin.box(0, -0.35, 0.15, 0.05, 0.05, 0.06, gold, 11);

    // Upper Arms
    GarmUpL.box(0, -0.14, 0, 0.085, 0.28, 0.085, topCol);
    GarmUpR.box(0, -0.14, 0, 0.085, 0.28, 0.085, topCol);

    // Forearms + Hands + Props
    GarmLowL.box(0, -0.12, 0, 0.075, 0.22, 0.075, arch === 2 ? skin : topCol);
    GarmLowL.box(0, -0.26, 0.01, 0.06, 0.08, 0.06, skin);

    GarmLowR.box(0, -0.12, 0, 0.075, 0.22, 0.075, arch === 2 ? skin : topCol);
    GarmLowR.box(0, -0.26, 0.01, 0.06, 0.08, 0.06, skin);

    if (arch === 2) { // Chai kettle & cutting glasses rack
      GarmLowL.box(0, -0.26, 0.14, 0.24, 0.03, 0.16, hex('#c0c0c0'), 11);
      for (let c = 0; c < 3; c++) GarmLowL.prism(-0.06 + c * 0.06, -0.24, 0.14, 0.022, 0.026, 0.05, 6, hex('#d49b43'), 11);
      GarmLowR.prism(0, -0.25, 0.14, 0.08, 0.07, 0.14, 8, hex('#d4af37'), 11);
      GarmLowR.beam([0, -0.22, 0.20], [0, -0.12, 0.28], 0.024, hex('#d4af37'), 11);
      GarmLowR.beam([0, -0.17, 0.08], [0, -0.09, 0.14], 0.02, hex('#b8860b'), 11);
    } else if (arch === 3) { // Glowing phone
      GarmLowL.box(0, -0.26, 0.08, 0.08, 0.14, 0.015, hex('#111315'));
      GarmLowL.box(0, -0.26, 0.075, 0.07, 0.13, 0.01, hex('#61f1f6'), 1, 2.0);
    } else if (arch === 4) { // Tablet folio
      GarmLowL.box(0, -0.24, 0.08, 0.03, 0.24, 0.18, hex('#20262e'));
    } else if (arch === 5) { // Market crate
      GarmLowL.box(0.12, -0.24, 0.20, 0.32, 0.14, 0.22, hex('#8b5a2b'));
      GarmLowL.prism(0.12, -0.17, 0.20, 0.12, 0.02, 0.12, 6, hex('#e53935'));
    }
  }

  return { Gbody, Ghead, Gjaw, Gthigh, Gshin, GarmUpL, GarmLowL, GarmUpR, GarmLowR };
}
function buildPed(cloth, alt) {
  return buildPedArchetype(alt ? 0 : 1, 0).Gbody;
}

// ---------- 3D floating animated speech bubble for speaking NPCs ----------
function buildSpeechBubble() {
  const G = new Geo(), W_ = hex('#ffffff'), BL = hex('#2563eb');
  // Pill-shaped bubble body
  G.prism(0, 0, 0, 0.16, 0.16, 0.10, 10, W_, 1, 1.4);
  // Bubble pointer tail angled towards mouth
  G.tri([0, -0.06, 0.05], [-0.035, 0.01, 0.05], [0.035, 0.01, 0.05], W_, 1, 1.4);
  // 3 glowing animated speaking dots (ellipsis "...")
  for (const dx of [-0.06, 0, 0.06]) {
    G.prism(dx, 0.05, 0.055, 0.016, 0.016, 0.022, 8, BL, 1, 2.5);
  }
  return G;
}

function buildPin() { const G = new Geo(), c = [1, 1, 1]; G.prism(0, 0, 0, 0.02, 0.9, 2.2, 12, c, 1, 1.6); G.prism(0, 2.2, 0, 0.9, 1.25, 0.7, 12, c, 1, 1.6); G.prism(0, 2.9, 0, 1.25, 0.9, 0.7, 12, c, 1, 1.6); G.prism(0, 3.6, 0, 0.9, 0.05, 0.5, 12, c, 1, 1.6); return G; }

// ---------- flat geometry builders (pos3 + col4) ----------
function ringVerts(r0, r1, seg, c) { const v = []; for (let i = 0; i < seg; i++) { const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832, P = (r, a) => [Math.cos(a) * r, 0, Math.sin(a) * r]; const q = [P(r0, a0), P(r1, a0), P(r1, a1), P(r0, a1)], al = [0, c[3], c[3], 0]; for (const k of [0, 1, 2, 0, 2, 3]) v.push(...q[k], c[0], c[1], c[2], al[k]); } return v; }
function staticFlat(verts) { const m = dynMesh([[0, 3], [1, 4]]); const d = new Float32Array(verts); uploadDyn(m, d, verts.length / 7); return m; }
function softRect(wi, li, wo, lo, c) {
  const v = [], I = [[-wi / 2, -li / 2], [wi / 2, -li / 2], [wi / 2, li / 2], [-wi / 2, li / 2]], O = [[-wo / 2, -lo / 2], [wo / 2, -lo / 2], [wo / 2, lo / 2], [-wo / 2, lo / 2]];
  const put = (p, a) => v.push(p[0], 0, p[1], c[0], c[1], c[2], a);
  for (const k of [0, 1, 2, 0, 2, 3]) put(I[k], c[3]);
  for (let e = 0; e < 4; e++) { const n = (e + 1) % 4; put(I[e], c[3]); put(O[e], 0); put(O[n], 0); put(I[e], c[3]); put(O[n], 0); put(I[n], c[3]); }
  return v;
}
function rectVerts(w, l, c, soft) { const v = []; const n = soft ? 6 : 1; for (let i = 0; i < n; i++) { const s = soft ? 1 - i / n : 1, a = c[3] / n * (soft ? 1 : n); const x = w / 2 * s, z = l / 2 * s; const q = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]]; for (const k of [0, 1, 2, 0, 2, 3]) v.push(...q[k], c[0], c[1], c[2], a); } return v; }

// ---------- particles ----------
class Particles {
  constructor(max, additive) { this.max = max; this.add = additive; this.n = 0; this.a = []; this.buf = new Float32Array(max * 6 * 9); this.mesh = dynMesh([[0, 3], [1, 2], [2, 4]]); }
  emit(o) { if (this.a.length >= this.max) this.a.shift(); this.a.push(Object.assign({ life: 1, age: 0, size: 0.5, grow: 0, drag: 1, g: 0, col: [1, 1, 1, 1], fade: 1 }, o)); }
  update(dt) { for (const p of this.a) { p.age += dt; p.vel[1] -= p.g * dt; const d = Math.exp(-p.drag * dt); p.vel[0] *= d; p.vel[1] *= d; p.vel[2] *= d; p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt; p.pos[2] += p.vel[2] * dt; if (p.pos[1] < 0.05 && p.g > 0) { p.pos[1] = 0.05; p.vel[1] *= -0.3; } p.size += p.grow * dt; } this.a = this.a.filter(p => p.age < p.life); }
  build(R, U) { let k = 0; const b = this.buf; for (const p of this.a) { const t = p.age / p.life, al = p.col[3] * (p.fade ? (1 - t) * Math.min(1, t * 8 + 0.2) : 1), s = p.size / 2; const c = p.pos;
      const corners = [[-1, -1, 0, 1], [1, -1, 1, 1], [1, 1, 1, 0], [-1, 1, 0, 0]];
      for (const i of [0, 1, 2, 0, 2, 3]) { const [sx, sy, u, v] = corners[i]; b[k++] = c[0] + (R[0] * sx + U[0] * sy) * s; b[k++] = c[1] + (R[1] * sx + U[1] * sy) * s; b[k++] = c[2] + (R[2] * sx + U[2] * sy) * s; b[k++] = u; b[k++] = v; b[k++] = p.col[0]; b[k++] = p.col[1]; b[k++] = p.col[2]; b[k++] = al; } }
    uploadDyn(this.mesh, b, this.a.length * 6); }
}

// ---------- traffic, peds ----------
function offsetLoop(pts, closed, off) {
  if (pts.length === 2) { const [a, b] = pts, l = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], L = [d[1] * off, -d[0] * off]; pts = [[a[0] + L[0], a[1] + L[1]], [b[0] + L[0], b[1] + L[1]], [b[0] - L[0], b[1] - L[1]], [a[0] - L[0], a[1] - L[1]]]; off = 0.001; }
  const n = pts.length, out = [];
  const dirAt = i => { const a = pts[i], b = pts[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  for (let i = 0; i < n; i++) { const d1 = dirAt((i - 1 + n) % n), d2 = dirAt(i); let lx = (d1[1] + d2[1]) / 2, lz = (-d1[0] - d2[0]) / 2; const l = Math.hypot(lx, lz); if (l < 0.2) { out.push([pts[i][0], pts[i][1]]); continue; } lx /= l; lz /= l; const dotp = lx * d2[1] + lz * -d2[0]; const s = off / Math.max(0.5, dotp); out.push([pts[i][0] + lx * s, pts[i][1] + lz * s]); }
  const segs = []; let L = 0; for (let i = 0; i < n; i++) { const a = out[i], b = out[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l, s0: L }); L += l; }
  return { segs, L };
}
function samplePath(P, s) { s = ((s % P.L) + P.L) % P.L; for (const g of P.segs) if (s <= g.s0 + g.l) { const t = (s - g.s0) / (g.l || 1); return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t, Math.atan2(-(g.b[0] - g.a[0]), -(g.b[1] - g.a[1]))]; } const g = P.segs[0]; return [g.a[0], g.a[1], 0]; }
const TRAFFIC = [], PEDS = [];
const BIRDS = [];
const DRAGONS = [];
const DRAGON_ROAM_POINTS = [
  { x: 0, z: -30, alt: 395, desc: 'Cyber Chowk Stratosphere' },
  { x: -140, z: -90, alt: 405, desc: 'Central Plaza Stratosphere' },
  { x: 140, z: -60, alt: 410, desc: 'East Galleria Stratosphere' },
  { x: 0, z: -270, alt: 440, desc: 'North Citadel Stratosphere' },
  { x: -240, z: -250, alt: 430, desc: 'Northwest Bastion Stratosphere' },
  { x: 260, z: -260, alt: 435, desc: 'Northeast Fortress Stratosphere' },
  { x: 0, z: 230, alt: 385, desc: 'Vajra Setu River Bridge Stratosphere' },
  { x: -280, z: 240, alt: 400, desc: 'Southwest River Delta Stratosphere' },
  { x: 290, z: 220, alt: 400, desc: 'Southeast River Bend Stratosphere' },
  { x: 330, z: -120, alt: 450, desc: 'Tech Towers Stratosphere' },
  { x: 360, z: 90, alt: 430, desc: 'East Skyline Stratosphere' },
  { x: -330, z: 70, alt: 415, desc: 'Chandni Bazaar Stratosphere' },
  { x: -350, z: -140, alt: 445, desc: 'West Ridge Stratosphere' },
  { x: -360, z: -350, alt: 480, desc: 'Northwest Cloudfront Stratosphere' },
  { x: 360, z: -350, alt: 480, desc: 'Northeast Cloudfront Stratosphere' },
  { x: 360, z: 350, alt: 460, desc: 'Southeast Horizon Stratosphere' },
  { x: -360, z: 350, alt: 460, desc: 'Southwest Horizon Stratosphere' }
];
const SERPENT = { x: -300, z: 0, dir: 1, speed: 4.8, segs: 22, phase: 0 };

function initEcosystem() {
  BIRDS.length = 0;

  // 1. River Sea Gulls: roaming the long river canyon, Vajra Setu bridge, and river rapids
  for (let i = 0; i < 22; i++) {
    const isRoaming = (i % 3 === 0);
    BIRDS.push({
      flock: 'gull',
      mesh: 'bird_gull',
      mode: isRoaming ? 'roam' : 'orbit',
      x: -350 + i * 32,
      z: -35 + (i % 4) * 20,
      cx: -200 + (i % 6) * 65,
      cz: -15 + (i % 3) * 15,
      r: 45 + (i % 4) * 35,
      driftSp: 3.5,
      driftDir: i * 0.9,
      baseY: 24 + (i % 5) * 3.2,
      y: 24 + (i % 5) * 3.2,
      wavePh: i * 0.75,
      waveAmp: 2.2,
      waveFreq: 0.8,
      speed: isRoaming ? (14.0 + (i % 4) * 2.0) : (0.28 + (i % 5) * 0.035),
      yaw: (i % 2 === 0 ? 0 : Math.PI) + (i % 5) * 0.2,
      ph: i * 0.55,
      flap: i * 1.2,
      flapCycle: i * 0.7,
      flapFreq: 1.7,
      flapSpeed: 13.0,
      glideThresh: -0.10,
      scale: 0.55 // Sleek sea gull
    });
  }

  // 2. High-Altitude Soaring Eagles / Raptors: majestic thermal flight across the entire sky
  for (let i = 0; i < 14; i++) {
    BIRDS.push({
      flock: 'eagle',
      mesh: 'bird_eagle',
      mode: 'orbit',
      cx: -180 + (i % 4) * 110,
      cz: -160 + Math.floor(i / 4) * 110,
      r: 110 + (i % 3) * 45,
      driftSp: 4.8,
      driftDir: i * 1.35,
      baseY: 65 + (i % 4) * 7.0,
      y: 65 + (i % 4) * 7.0,
      wavePh: i * 1.2,
      waveAmp: 1.6,
      waveFreq: 0.4,
      speed: 0.14 + (i % 3) * 0.02,
      ph: i * 1.4,
      flap: i * 0.8,
      flapCycle: i * 1.5,
      flapFreq: 0.95,
      flapSpeed: 8.5,
      glideThresh: 0.25,
      scale: 1.15 // Large majestic raptor
    });
  }

  // 3. Indian Green Parakeets (Tota): fast synchronized V-flocks darting across parks & boulevards
  for (let i = 0; i < 18; i++) {
    const flockId = Math.floor(i / 9);
    const posInV = (i % 9);
    const vSide = (posInV % 2 === 0 ? 1 : -1) * Math.ceil(posInV / 2);
    BIRDS.push({
      flock: 'parrot',
      mesh: 'bird_parrot',
      mode: 'roam',
      flockGroup: flockId,
      x: (flockId === 0 ? -180 : 180) + vSide * 2.8,
      z: (flockId === 0 ? 120 : -80) + Math.abs(vSide) * 3.2,
      yaw: flockId === 0 ? 0.35 : -2.6,
      baseY: 22 + (i % 3) * 2.5,
      y: 22 + (i % 3) * 2.5,
      wavePh: i * 0.9,
      waveAmp: 1.2,
      waveFreq: 1.4,
      speed: 21.0 + (i % 3) * 1.2,
      turnAgility: 0.25,
      ph: i * 0.8,
      flap: i * 1.8,
      flapCycle: i * 0.4,
      flapFreq: 2.8,
      flapSpeed: 19.0,
      glideThresh: -0.35,
      scale: 0.44 // Vivid emerald parakeet
    });
  }

  // 4. Cyber Chowk Pigeons & Doves: swirling around modern glass skyscrapers & sky overpasses
  for (let i = 0; i < 18; i++) {
    BIRDS.push({
      flock: 'dove',
      mesh: 'bird_dove',
      mode: 'orbit',
      cx: 200 + (i % 3) * 28 - 28,
      cz: 170 + Math.floor(i / 3) * 24 - 48,
      r: 32 + (i % 4) * 18,
      driftSp: 2.5,
      driftDir: i * 0.8,
      baseY: 32 + (i % 4) * 4.5,
      y: 32 + (i % 4) * 4.5,
      wavePh: i * 0.85,
      waveAmp: 1.8,
      waveFreq: 0.9,
      speed: 0.30 + (i % 4) * 0.04,
      ph: i * 0.7,
      flap: i * 1.4,
      flapCycle: i * 0.6,
      flapFreq: 2.1,
      flapSpeed: 15.0,
      glideThresh: -0.15,
      scale: 0.48 // Lilac-grey city dove
    });
  }

  // 5. Old City Barn Swallows: agile acrobats skimming ancient fort battlements & temple spires
  for (let i = 0; i < 18; i++) {
    BIRDS.push({
      flock: 'swallow',
      mesh: 'bird_swallow',
      mode: 'orbit',
      cx: -25 + (i % 4) * 42,
      cz: -85 + Math.floor(i / 4) * 35,
      r: 42 + (i % 3) * 22,
      driftSp: 3.2,
      driftDir: i * 1.1,
      baseY: 26 + (i % 4) * 3.5,
      y: 26 + (i % 4) * 3.5,
      wavePh: i * 1.0,
      waveAmp: 2.4,
      waveFreq: 1.2,
      speed: 0.36 + (i % 4) * 0.05,
      ph: i * 0.85,
      flap: i * 1.6,
      flapCycle: i * 0.5,
      flapFreq: 2.4,
      flapSpeed: 17.5,
      glideThresh: -0.12,
      scale: 0.40 // Agile scissor-tail swallow
    });
  }

  DRAGONS.length = 0;

  const dragonConfigs = [
    // 1. Midnight Dark Blue Ice Dragon: Agile Sky Scout (Emits DARK BLUE ICE breath) - inner high-sky circular orbit
    { id: 'obsidian', element: 'ice',
      bodyMesh: 'dragon_body_obsidian', headMesh: 'dragon_head_obsidian',
      tail1Mesh: 'dragon_tail1_obsidian', tail2Mesh: 'dragon_tail2_obsidian',
      wingL: 'dragonWingL_obsidian', wingR: 'dragonWingR_obsidian', mesh: 'dragon_obsidian',
      cx: 0, cz: -10, radius: 125, orbitSpeed: 0.16, dir: 1, baseAlt: 210, altAmp: 8, altFreq: 0.32, phaseOffset: 0.0,
      flapSpeedBase: 3.2, tailFreq: 4.2, scale: 36.0 },
    // 2. Crimson Red Fire Dragon: Heavy Molten Wyrm (Emits RED FIRE breath) - counter-clockwise circular orbit in high sky
    { id: 'volcanic', element: 'fire',
      bodyMesh: 'dragon_body_volcanic', headMesh: 'dragon_head_volcanic',
      tail1Mesh: 'dragon_tail1_volcanic', tail2Mesh: 'dragon_tail2_volcanic',
      wingL: 'dragonWingL_volcanic', wingR: 'dragonWingR_volcanic', mesh: 'dragon_volcanic',
      cx: 0, cz: -10, radius: 165, orbitSpeed: 0.125, dir: -1, baseAlt: 235, altAmp: 9, altFreq: 0.28, phaseOffset: 1.8,
      flapSpeedBase: 1.8, tailFreq: 2.4, scale: 40.0 },
    // 3. Deep Sapphire Dark Blue Ice Dragon: High Cloud Navigator (Emits DARK BLUE ICE breath) - wide clockwise circular orbit
    { id: 'jade', element: 'ice',
      bodyMesh: 'dragon_body_jade', headMesh: 'dragon_head_jade',
      tail1Mesh: 'dragon_tail1_jade', tail2Mesh: 'dragon_tail2_jade',
      wingL: 'dragonWingL_jade', wingR: 'dragonWingR_jade', mesh: 'dragon_jade',
      cx: 0, cz: -10, radius: 205, orbitSpeed: 0.10, dir: 1, baseAlt: 260, altAmp: 10, altFreq: 0.24, phaseOffset: 3.6,
      flapSpeedBase: 2.4, tailFreq: 3.4, scale: 42.0 },
    // 4. Scarlet Red Fire Dragon: Celestial Sky Sovereign (Emits RED FIRE breath) - apex stratospheric circular orbit
    { id: 'gold', element: 'fire',
      bodyMesh: 'dragon_body_gold', headMesh: 'dragon_head_gold',
      tail1Mesh: 'dragon_tail1_gold', tail2Mesh: 'dragon_tail2_gold',
      wingL: 'dragonWingL_gold', wingR: 'dragonWingR_gold', mesh: 'dragon_gold',
      cx: 0, cz: -10, radius: 245, orbitSpeed: 0.082, dir: -1, baseAlt: 285, altAmp: 11, altFreq: 0.20, phaseOffset: 5.2,
      flapSpeedBase: 1.4, tailFreq: 2.2, scale: 46.0 }
  ];
  for (const dc of dragonConfigs) {
    const initBreathT = dc.id === 'volcanic' ? 0.2 : dc.id === 'gold' ? 2.4 : dc.id === 'obsidian' ? 1.2 : 3.6;
    const a = dc.phaseOffset || 0;
    const initX = dc.cx + dc.radius * Math.cos(a);
    const initZ = dc.cz + dc.radius * Math.sin(a);
    const initY = dc.baseAlt + Math.sin(a * dc.altFreq) * dc.altAmp;
    const vx = -Math.sin(a) * dc.dir;
    const vz = Math.cos(a) * dc.dir;
    const initYaw = Math.atan2(-vx, -vz);
    DRAGONS.push({
      ...dc,
      x: initX,
      y: initY,
      z: initZ,
      orbitAngle: a,
      wingPh: Math.random() * 6.28,
      flightT: Math.random() * 200,
      breathT: initBreathT,
      yaw: initYaw,
      pitch: 0,
      roll: -dc.dir * 0.28,
      smoothFlap: 0,
      smoothPitch: 0,
      smoothSweep: 0,
      glideWeight: 0
    });
  }
}

const TALK_GROUPS = {};
// ---------- GPS route (Dijkstra on road graph) ----------
function nearestNode(x, z) { let best = null, bd = 1e9; for (const k in W.nodes) { const n = W.nodes[k], d = Math.hypot(n[0] - x, n[1] - z); if (d < bd) { bd = d; best = k; } } return best; }
function routeTo(tx, tz) {
  const s = nearestNode(GAME.car.x, GAME.car.z), t = nearestNode(tx, tz); const dist = {}, prev = {}, Q = new Set(Object.keys(W.nodes)); for (const k of Q) dist[k] = 1e12; dist[s] = 0;
  const adj = {}; for (const e of W.edges) { const a = W.nodes[e.a], b = W.nodes[e.b], l = Math.hypot(a[0] - b[0], a[1] - b[1]); (adj[e.a] = adj[e.a] || []).push([e.b, l]); (adj[e.b] = adj[e.b] || []).push([e.a, l]); }
  while (Q.size) { let u = null, ud = 1e13; for (const k of Q) if (dist[k] < ud) { ud = dist[k]; u = k; } if (!u || u === t) break; Q.delete(u); for (const [v, l] of adj[u] || []) if (dist[u] + l < dist[v]) { dist[v] = dist[u] + l; prev[v] = u; } }
  const path = []; let u = t; while (u) { path.unshift(W.nodes[u]); if (u === s) break; u = prev[u]; }
  const pts = [[GAME.car.x, GAME.car.z], ...path, [tx, tz]];
  // drop leading nodes that sit behind the car (avoids routing backwards to the nearest junction)
  while (pts.length > 2) { const a = pts[0], b = pts[1], c = pts[2]; const back = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0; if (back || Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) pts.splice(1, 1); else break; }
  return pts;
}

// ---------- init ----------
async function initGame(canvas, onProgress, fontLoads) {
  if (!canvas) throw new Error('canvas element not found');
  const glConfigs = [
    { powerPreference: 'high-performance', preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false },
    { powerPreference: 'default', preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false },
    { preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: false, preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false },
    { preserveDrawingBuffer: true },
    { antialias: false, alpha: false, preserveDrawingBuffer: true }
  ];
  for (const cfg of glConfigs) {
    try {
      gl = canvas.getContext('webgl2', cfg);
      if (gl) break;
    } catch {}
  }
  if (!gl) {
    try {
      gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || canvas.getContext('experimental-webgl');
      if (gl) throw new Error('webgl1only');
    } catch (e) {
      if (e.message === 'webgl1only') throw e;
    }
  }
  if (!gl) throw new Error('nowebgl2');
  P.main = compile(SH.mainVS, SH.mainFS); P.tex = compile(SH.texVS, SH.texFS); P.flat = compile(SH.flatVS, SH.flatFS); P.part = compile(SH.partVS, SH.partFS);
  P.sky = compile(SH.skyVS, SH.skyFS); P.bright = compile(SH.quadVS, SH.brightFS); P.blur = compile(SH.quadVS, SH.blurFS); P.comp = compile(SH.quadVS, SH.compFS);
  onProgress(0.25, 'Compiling shaders');
  await new Promise(r => setTimeout(r, 0));

  const rng = mulberry(20260923);
  const G = buildWorld(rng);
  onProgress(0.55, 'Raising Shatranj City');
  await new Promise(r => setTimeout(r, 0));

  statics = chunkGeo(G, 110);
  initVehicleMeshes();
  MESH.water = geoToMesh(buildWaterGeo());
  MESH.speechBubble = geoToMesh(buildSpeechBubble());
  MESH.pedArchs = [];
  for (let a = 0; a < 6; a++) {
    const parts = buildPedArchetype(a, a);
    MESH.pedArchs.push({
      body: geoToMesh(parts.Gbody),
      head: parts.Ghead && parts.Ghead.count > 0 ? geoToMesh(parts.Ghead) : null,
      jaw: parts.Gjaw && parts.Gjaw.count > 0 ? geoToMesh(parts.Gjaw) : null,
      thigh: parts.Gthigh && parts.Gthigh.count > 0 ? geoToMesh(parts.Gthigh) : null,
      shin: parts.Gshin && parts.Gshin.count > 0 ? geoToMesh(parts.Gshin) : null,
      armUpL: parts.GarmUpL && parts.GarmUpL.count > 0 ? geoToMesh(parts.GarmUpL) : null,
      armLowL: parts.GarmLowL && parts.GarmLowL.count > 0 ? geoToMesh(parts.GarmLowL) : null,
      armUpR: parts.GarmUpR && parts.GarmUpR.count > 0 ? geoToMesh(parts.GarmUpR) : null,
      armLowR: parts.GarmLowR && parts.GarmLowR.count > 0 ? geoToMesh(parts.GarmLowR) : null
    });
  }
  MESH.peds = MESH.pedArchs.map(a => a.body);
  MESH.pin = geoToMesh(buildPin());
  onProgress(0.78, 'Tuning the VAJRA-S1');

  // quads + flat meshes
  QUAD = (() => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0, 1, 0.5, -0.5, 0, 1, 1, 0.5, 0.5, 0, 1, 0, -0.5, -0.5, 0, 0, 1, 0.5, 0.5, 0, 1, 0, -0.5, 0.5, 0, 0, 0]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null); return { vao }; })();
  MESH.ring = staticFlat(ringVerts(7.6, 8.8, 64, [1, 1, 1, 1]).concat(ringVerts(0, 8.8, 64, [1, 1, 1, 0.18])));
  MESH.shadow = staticFlat(softRect(1.7, 4.2, 2.7, 5.4, [0, 0, 0, 0.55])); MESH.glow = staticFlat(softRect(1.6, 4.0, 4.2, 7.0, [0.37, 0.95, 0.96, 0.55]));
  MESH.marks = dynMesh([[0, 3], [1, 4]]); MESH.marksBuf = new Float32Array(420 * 6 * 7); MESH.marksN = 0; MESH.marksHead = 0;
  MESH.trail = dynMesh([[0, 3], [1, 4]]); MESH.trailBuf = new Float32Array(6 * 30 * 6 * 7);
  MESH.gps = dynMesh([[0, 3], [1, 4]]); MESH.gpsBuf = new Float32Array(40 * 9 * 7);

  onProgress(0.88, 'Lighting the lanterns');
  if (fontLoads) await Promise.race([fontLoads, new Promise(r => setTimeout(r, 100))]);

  // textures
  for (const s of W.signs) s.tex = texFromCanvas(s.cv);
  TEX.labels = {}; for (const lm of W.landmarks) TEX.labels[lm.id] = texFromCanvas(labelCanvas(lm));
  TEX.holos = await Promise.all(PORTFOLIO.caseStudies.map(async (cs, i) => texFromCanvas(await holoCanvas(cs, i))));
  TEX.holoBack = texFromCanvas(holoBackCanvas());
  TEX.plate = texFromCanvas(textCanvas(256, 64, (x, w, h) => { x.fillStyle = '#F4F1EA'; x.fillRect(0, 0, w, h); x.strokeStyle = '#17181C'; x.lineWidth = 4; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#17181C'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 44px ${FONT_D}`; x.fillText('VAJRA-S1', w / 2, h / 2 + 4); }));
  TEX.decal = texFromCanvas(textCanvas(512, 96, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#E8892B'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `italic 700 72px ${FONT_D}`; x.fillText('VAJRA-S1', w / 2, h / 2 + 6); }));
  const lm = W.landmarks.find(l => l.id === 'resume'); TEX.boardCv = document.createElement('canvas'); TEX.boardCv.width = 1024; TEX.boardCv.height = 474; drawBoard(TEX.boardCv, 1); TEX.board = texFromCanvas(TEX.boardCv); lm.boardFlip = -1;

  initTraffic(rng); initEcosystem();
  GAME.mood = moodVec(MOODS.golden);
  resize(); addEventListener('resize', resize);
  onProgress(1, 'Ready');
}
// split the static city into spatial chunks so off-screen and fogged-out parts are never drawn
function chunkGeo(G, cell) {
  const buckets = new Map(), P = G.p, n = P.length / 9;
  for (let t = 0; t < n; t++) {
    const o = t * 9; let span = 0;
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) span = Math.max(span, Math.abs(P[o + a * 3] - P[o + b * 3]), Math.abs(P[o + a * 3 + 2] - P[o + b * 3 + 2]));
    const cx = (P[o] + P[o + 3] + P[o + 6]) / 3, cz = (P[o + 2] + P[o + 5] + P[o + 8]) / 3, key = span > cell ? 'big' : Math.floor(cx / cell) + ',' + Math.floor(cz / cell);
    let b = buckets.get(key); if (!b) { b = { p: [], n: [], c: [], m: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; buckets.set(key, b); }
    for (let v = 0; v < 3; v++) { const vi = t * 3 + v; for (let a = 0; a < 3; a++) { const x = P[vi * 3 + a]; b.p.push(x); b.n.push(G.n[vi * 3 + a]); b.c.push(G.c[vi * 3 + a]); if (x < b.min[a]) b.min[a] = x; if (x > b.max[a]) b.max[a] = x; } b.m.push(G.m[vi * 2], G.m[vi * 2 + 1]); }
  }
  return [...buckets.values()].map(b => { const g = new Geo(); g.p = b.p; g.n = b.n; g.c = b.c; g.m = b.m; return Object.assign(geoToMesh(g), { min: b.min, max: b.max }); });
}
function frustumPlanes(m) { const r = i => [m[i], m[4 + i], m[8 + i], m[12 + i]], r0 = r(0), r1 = r(1), r2 = r(2), r3 = r(3), P = []; for (const [s, q] of [[1, r0], [-1, r0], [1, r1], [-1, r1], [1, r2], [-1, r2]]) P.push([r3[0] + s * q[0], r3[1] + s * q[1], r3[2] + s * q[2], r3[3] + s * q[3]]); return P; }
function boxVisible(P, mn, mx) { for (const p of P) { if (p[0] * (p[0] > 0 ? mx[0] : mn[0]) + p[1] * (p[1] > 0 ? mx[1] : mn[1]) + p[2] * (p[2] > 0 ? mx[2] : mn[2]) + p[3] < 0) return false; } return true; }
const IDENT = M4.ident(), _M = new Float32Array(16);
function resize() {
  const cv = gl.canvas;
  const isHigh = GAME.quality === 'high' || GAME.quality === 'ultra';
  const targetDpr = isHigh ? Math.min(devicePixelRatio || 1, 1.35) : 1.0;
  const dpr = Math.max(1, targetDpr * (GAME.renderScale || 1));
  cv.width = Math.max(2, Math.floor(cv.clientWidth * dpr));
  cv.height = Math.max(2, Math.floor(cv.clientHeight * dpr));
  if (isHigh) setupTargets(cv.width, cv.height);
  else { if (RT.del) RT.del(); RT.ok = false; }
}

// ---------- textures for landmarks ----------
function labelCanvas(lm) { return textCanvas(1024, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `600 150px ${FONT_D}`; x.lineWidth = 16; x.strokeStyle = 'rgba(10,14,30,0.75)'; x.strokeText(lm.name.toUpperCase(), w / 2, h / 2 + 18); x.fillStyle = '#ffffff'; x.fillText(lm.name.toUpperCase(), w / 2, h / 2 + 18); x.fillStyle = lm.color; x.fillRect(w / 2 - 120, h - 30, 240, 10); }); }
async function holoCanvas(cs, i) {
  const cover = cs.cover ? await loadCaseStudyCover(cs.cover) : null;
  return textCanvas(1024, 2048, (x, w, h) => {
    // 1. Deep midnight glass obsidian background
    x.fillStyle = '#050914';
    x.fillRect(0, 0, w, h);
    const bgG = x.createLinearGradient(0, 0, 0, h);
    bgG.addColorStop(0, '#091224');
    bgG.addColorStop(0.35, '#060c1a');
    bgG.addColorStop(0.7, '#040812');
    bgG.addColorStop(1, '#020408');
    x.fillStyle = bgG;
    x.fillRect(0, 0, w, h);

    // Subtle tech grid dots
    x.fillStyle = 'rgba(56, 189, 248, 0.05)';
    for (let gx = 40; gx < w; gx += 48) {
      for (let gy = 40; gy < h; gy += 48) {
        x.fillRect(gx, gy, 3, 3);
      }
    }

    // 2. High-contrast neon frame and corner brackets
    x.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    x.lineWidth = 4;
    x.strokeRect(16, 16, w - 32, h - 32);
    const bLen = 60;
    x.strokeStyle = cs.accent || '#38BDF8';
    x.lineWidth = 10;
    [[16, 16, 1, 1], [w - 16, 16, -1, 1], [16, h - 16, 1, -1], [w - 16, h - 16, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      x.beginPath();
      x.moveTo(cx, cy + sy * bLen);
      x.lineTo(cx, cy);
      x.lineTo(cx + sx * bLen, cy);
      x.stroke();
    });

    // 3. Top Header Bar
    x.save();
    x.fillStyle = 'rgba(2, 132, 199, 0.25)';
    x.beginPath(); x.roundRect(36, 32, 440, 60, 14); x.fill();
    x.strokeStyle = cs.accent || '#38BDF8'; x.lineWidth = 2.5; x.stroke();
    x.fillStyle = '#FFFFFF'; x.font = `800 32px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('✦ CASE STUDY 0' + (i + 1) + ' · ' + (i === 0 ? 'AR 3D PREVIEW' : (i === 1 ? 'EDTECH PLATFORM' : 'WEBGL 3D ENGINE')), 36 + 220, 32 + 30);

    x.fillStyle = 'rgba(129, 140, 248, 0.25)';
    x.beginPath(); x.roundRect(w - 384, 32, 348, 60, 14); x.fill();
    x.strokeStyle = 'rgba(129, 140, 248, 0.85)'; x.lineWidth = 2.5; x.stroke();
    x.fillStyle = '#E0E7FF'; x.font = `800 26px ${FONT_D}`; x.textAlign = 'center';
    x.fillText('PORTFOLIO HIGHLIGHT · 2026', w - 384 + 174, 32 + 30);
    x.restore();

    // 4. GIANT HERO COVER IMAGE SHOWCASE (Takes dominant top half)
    const cardX = 36, cardY = 108, cardW = w - 72, cardH = 920;
    x.save();
    x.fillStyle = '#081020';
    x.beginPath(); x.roundRect(cardX, cardY, cardW, cardH, 22); x.fill();
    x.strokeStyle = cs.accent || '#38BDF8'; x.lineWidth = 3.5; x.stroke();

    // Card top title bar
    x.fillStyle = cs.accent || '#38BDF8'; x.font = '700 32px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('✳', cardX + 24, cardY + 36);
    x.fillStyle = '#FFFFFF'; x.font = `800 34px ${FONT_D}`;
    x.fillText((cs.title || 'Project').toUpperCase() + ' · LIVE PREVIEW', cardX + 58, cardY + 36);
    x.fillStyle = '#38BDF8'; x.font = `700 24px ${FONT_D}`; x.textAlign = 'right';
    x.fillText('HIGH-FIDELITY MOBILE UI', cardX + cardW - 24, cardY + 36);

    // Hero Viewport for Cover
    const imgX = cardX + 16, imgY = cardY + 64, imgW = cardW - 32, imgH = 760;
    if (cover) {
      x.save();
      x.beginPath(); x.roundRect(imgX, imgY, imgW, imgH, 16); x.clip();
      x.fillStyle = '#ffffff';
      x.fillRect(imgX, imgY, imgW, imgH);
      // Zoom in cleanly on the focal artwork
      const srcCropX = i === 0 ? 120 : 0;
      const srcCropY = i === 0 ? 10 : 0;
      const srcCropW = i === 0 ? (cover.width - 240) : cover.width;
      const srcCropH = i === 0 ? (cover.height - 20) : cover.height;
      x.drawImage(cover, srcCropX, srcCropY, srcCropW, srcCropH, imgX, imgY, imgW, imgH);
      x.restore();
      x.strokeStyle = 'rgba(56, 189, 248, 0.6)'; x.lineWidth = 3;
      x.beginPath(); x.roundRect(imgX, imgY, imgW, imgH, 16); x.stroke();

      // Floating feature pills over image
      const pills0 = i === 0 
        ? [['✦ 3D Room Visualizer', 40, imgY + imgH - 70], ['✓ Verified Pros', 380, imgY + imgH - 70], ['⚡ Instant Quotes', 640, imgY + imgH - 70]]
        : [['🏎 Custom 3D Engine', 40, imgY + imgH - 70], ['⚡ 60 FPS WebGL 2', 380, imgY + imgH - 70], ['📍 Cyber Metropolis', 640, imgY + imgH - 70]];
      pills0.forEach(([pTxt, px, py]) => {
        x.fillStyle = 'rgba(7, 12, 24, 0.92)';
        x.beginPath(); x.roundRect(px, py, 260, 50, 12); x.fill();
        x.strokeStyle = 'rgba(56, 189, 248, 0.8)'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#FFFFFF'; x.font = `800 24px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(pTxt, px + 130, py + 25);
      });
    } else if (i === 1) { // High-fidelity procedural mobile UI mockup for Home Tutor Pro
      const heroG = x.createLinearGradient(imgX, imgY, imgX, imgY + imgH);
      heroG.addColorStop(0, '#0f172a'); heroG.addColorStop(1, '#060a12');
      x.fillStyle = heroG;
      x.beginPath(); x.roundRect(imgX, imgY, imgW, imgH, 16); x.fill();
      x.strokeStyle = 'rgba(236, 72, 153, 0.5)'; x.lineWidth = 3; x.stroke();

      // Smartphone frame inside viewport
      const phW = 440, phH = 680, phX = imgX + (imgW - phW) / 2, phY = imgY + 40;
      x.fillStyle = '#1e293b';
      x.beginPath(); x.roundRect(phX, phY, phW, phH, 32); x.fill();
      x.strokeStyle = '#ec4899'; x.lineWidth = 3; x.stroke();

      // Phone screen
      const scX = phX + 16, scY = phY + 16, scW = phW - 32, scH = phH - 32;
      x.fillStyle = '#0f172a';
      x.beginPath(); x.roundRect(scX, scY, scW, scH, 20); x.fill();

      // Phone top speaker notch
      x.fillStyle = '#334155';
      x.beginPath(); x.roundRect(phX + phW / 2 - 40, scY + 8, 80, 8, 4); x.fill();

      // App Header inside screen
      x.fillStyle = '#FFFFFF'; x.font = `800 28px ${FONT_D}`; x.textAlign = 'left';
      x.fillText('Home Tutor Pro', scX + 20, scY + 48);
      x.fillStyle = '#ec4899'; x.font = `800 22px ${FONT_D}`; x.textAlign = 'right';
      x.fillText('⚡ NEW DELHI', scX + scW - 20, scY + 48);

      // Search bar
      x.fillStyle = '#1e293b';
      x.beginPath(); x.roundRect(scX + 16, scY + 68, scW - 32, 44, 10); x.fill();
      x.fillStyle = '#94a3b8'; x.font = `600 18px ${FONT_D}`; x.textAlign = 'left';
      x.fillText('🔍 Search Math, Physics, SAT...', scX + 32, scY + 92);

      // Featured Tutor Card 1
      const tcY = scY + 128;
      x.fillStyle = '#1e293b';
      x.beginPath(); x.roundRect(scX + 16, tcY, scW - 32, 230, 14); x.fill();
      x.strokeStyle = 'rgba(236, 72, 153, 0.4)'; x.lineWidth = 1.5; x.stroke();

      // Avatar circle
      x.fillStyle = '#ec4899';
      x.beginPath(); x.arc(scX + 54, tcY + 44, 24, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#FFFFFF'; x.font = `800 20px ${FONT_D}`; x.textAlign = 'center';
      x.fillText('AP', scX + 54, tcY + 50);

      x.textAlign = 'left';
      x.fillStyle = '#FFFFFF'; x.font = `800 22px ${FONT_D}`;
      x.fillText('Dr. Ananya Patel', scX + 90, tcY + 38);
      x.fillStyle = '#f59e0b'; x.font = `700 18px ${FONT_D}`;
      x.fillText('★ 4.9 (128 reviews) · Verified Master', scX + 90, tcY + 60);

      // Subject chips
      [['Calculus', 0], ['Physics', 96], ['CBSE/IB', 188]].forEach(([chip, ox]) => {
        x.fillStyle = '#0f172a';
        x.beginPath(); x.roundRect(scX + 32 + ox, tcY + 84, 84, 28, 6); x.fill();
        x.fillStyle = '#38bdf8'; x.font = `700 15px ${FONT_D}`; x.textAlign = 'center';
        x.fillText(chip, scX + 32 + ox + 42, tcY + 102);
      });

      // Price & CTA inside tutor card
      x.textAlign = 'left';
      x.fillStyle = '#10b981'; x.font = `800 22px ${FONT_D}`;
      x.fillText('₹850 / hr', scX + 32, tcY + 154);
      x.fillStyle = '#94a3b8'; x.font = `600 15px ${FONT_D}`;
      x.fillText('● Next slot: Tomorrow 5 PM', scX + 32, tcY + 178);

      x.fillStyle = '#ec4899';
      x.beginPath(); x.roundRect(scX + scW - 160, tcY + 138, 128, 44, 10); x.fill();
      x.fillStyle = '#FFFFFF'; x.font = `800 18px ${FONT_D}`; x.textAlign = 'center';
      x.fillText('Book Trial →', scX + scW - 96, tcY + 164);

      // Floating feature badges
      [['🎓 Top 5% Verified Tutors', 40, imgY + imgH - 70], ['📍 GPS Location Match', 380, imgY + imgH - 70], ['🛡 100% Escrow Protected', 640, imgY + imgH - 70]].forEach(([pTxt, px, py]) => {
        x.fillStyle = 'rgba(7, 12, 24, 0.92)';
        x.beginPath(); x.roundRect(px, py, 260, 50, 12); x.fill();
        x.strokeStyle = 'rgba(236, 72, 153, 0.8)'; x.lineWidth = 2; x.stroke();
        x.fillStyle = '#FFFFFF'; x.font = `800 22px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(pTxt, px + 130, py + 25);
      });
    }

    // 3 Pills inside Cover Card Footer
    const pillY = cardY + cardH - 72, pW = (cardW - 48) / 3;
    const pills = i === 0 
      ? ['📱 3D AR PREVIEW', '🎨 VERIFIED PROS', '🔒 SECURE ESCROW'] 
      : (i === 1 ? ['🎓 TOP TUTORS', '📍 GPS MATCHING', '⚡ TRIAL BOOKING'] : ['🏎 3D WEBGL ENGINE', '🏙 SHATRANJ METROPOLIS', '🕹 INTERACTIVE HUD']);
    pills.forEach((pText, pi) => {
      const px = cardX + 16 + pi * (pW + 8);
      x.fillStyle = 'rgba(15, 23, 42, 0.96)';
      x.beginPath(); x.roundRect(px, pillY, pW, 52, 10); x.fill();
      x.strokeStyle = cs.accent || '#38BDF8'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#FFFFFF'; x.font = `800 24px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(pText, px + pW / 2, pillY + 26);
    });
    x.restore();

    // 5. LARGE VISIBLE HEADLINE & VALUE PROP
    x.fillStyle = '#FFFFFF'; x.font = `900 110px ${FONT_D}`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.shadowColor = 'rgba(0,0,0,0.95)'; x.shadowBlur = 18;
    x.fillText(cs.title.toUpperCase(), 36, 1120);
    x.shadowBlur = 0;
    x.fillStyle = cs.accent || '#38BDF8'; x.fillRect(36, 1134, 260, 10);

    // High-contrast large summary
    x.fillStyle = '#F8FAFC'; x.font = `700 46px ${FONT_D}`;
    wrap(x, cs.summary, 36, 1195, w - 72, 58, 3);

    // 6. Impact Metrics Row (3 Large High-Contrast Cards)
    const metaY = 1380, metaW = (w - 72 - 16) / 3;
    const metas = i === 0 
      ? [['8 WEEKS', 'TIMELINE', '#38BDF8'], ['13 SCREENS', 'UI WORKFLOWS', '#FBBF24'], ['SOLO UX/UI', 'DESIGN ROLE', '#34D399']] 
      : (i === 1 ? [['TOP 5%', 'VERIFIED TUTORS', '#EC4899'], ['1-CLICK', 'TRIAL BOOKING', '#38BDF8'], ['4.9 ★', 'FAMILY RATING', '#FBBF24']] 
      : [['60 FPS', 'WEBGL 2 ENGINE', '#10B981'], ['12+ KM²', 'CYBER WORLD', '#38BDF8'], ['FULL HUD', 'INTERACTIVE UX', '#FBBF24']]);
    metas.forEach(([val, lbl, col], mi) => {
      const mx = 36 + mi * (metaW + 8);
      x.fillStyle = '#0a1326'; x.beginPath(); x.roundRect(mx, metaY, metaW, 160, 16); x.fill();
      x.strokeStyle = 'rgba(56, 189, 248, 0.45)'; x.lineWidth = 2.5; x.stroke();
      x.fillStyle = col; x.font = `900 68px ${FONT_D}`; x.textAlign = 'center';
      x.fillText(val, mx + metaW / 2, metaY + 76);
      x.fillStyle = '#FFFFFF'; x.font = `800 24px ${FONT_D}`;
      x.fillText(lbl, mx + metaW / 2, metaY + 124);
    });

    // 7. Problem Statement & UX Strategy Box
    const probY = 1570, probH = 170;
    x.fillStyle = '#07101f';
    x.beginPath(); x.roundRect(36, probY, w - 72, probH, 18); x.fill();
    x.strokeStyle = 'rgba(56, 189, 248, 0.5)'; x.lineWidth = 2.5; x.stroke();
    x.fillStyle = '#FBBF24'; x.font = `800 28px ${FONT_D}`; x.textAlign = 'left';
    x.fillText('✦ PROBLEM STATEMENT & UX STRATEGY', 60, probY + 44);
    x.fillStyle = '#FFFFFF'; x.font = `700 34px sans-serif`;
    wrap(x, cs.problem, 60, probY + 92, w - 120, 44, 2);

    // 8. GIANT INTERACTIVE CTA BUTTON (Massive, high-contrast, impossible to miss)
    const btnY = 1770, btnH = 180;
    const btnG = x.createLinearGradient(36, btnY, w - 36, btnY + btnH);
    btnG.addColorStop(0, '#0284c7'); btnG.addColorStop(1, '#312e81');
    x.fillStyle = btnG;
    x.beginPath(); x.roundRect(36, btnY, w - 72, btnH, 24); x.fill();
    x.strokeStyle = '#38BDF8'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#FFFFFF'; x.font = `900 64px ${FONT_D}`; x.textAlign = 'center';
    x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 14;
    x.fillText('▶  PRESS [ E ] TO OPEN FULL CASE STUDY', w / 2, btnY + 76);
    x.shadowBlur = 0;
    x.fillStyle = '#BAE6FD'; x.font = `800 32px ${FONT_D}`;
    x.fillText('Interactive Prototype · High-Fidelity UI Screens · Design System ↗', w / 2, btnY + 132);

    x.fillStyle = '#94A3B8'; x.font = `700 24px ${FONT_D}`; x.textAlign = 'center';
    x.fillText('SHATRANJ CITY · CYBER-CHOWK INTERCHANGE · CASE STUDY 0' + (i + 1) + ' OF 03', w / 2, 2012);
  });
}
function loadCaseStudyCover(path) {
  return new Promise((resolve) => {
    if (!path) { resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.warn('Cover image at ' + path + ' could not be loaded, using stylized fallback.');
      resolve(null);
    };
    try {
      if (path.startsWith('data:')) {
        image.src = path;
      } else {
        image.src = new URL(path, document.baseURI).href;
      }
    } catch {
      resolve(null);
    }
  });
}
function holoBackCanvas() {
  return textCanvas(1024, 2048, (x, w, h) => {
    // Solid dark titanium armor chassis
    x.fillStyle = '#060a14';
    x.fillRect(0, 0, w, h);
    const bgG = x.createLinearGradient(0, 0, 0, h);
    bgG.addColorStop(0, '#0c1527');
    bgG.addColorStop(0.5, '#060a14');
    bgG.addColorStop(1, '#040710');
    x.fillStyle = bgG;
    x.fillRect(0, 0, w, h);

    // Carbon heat sink ribs
    x.fillStyle = 'rgba(15, 23, 42, 0.75)';
    for (let y = 140; y < h - 140; y += 32) {
      x.fillRect(80, y, w - 160, 14);
    }

    // Outer cyber border & brackets
    x.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    x.lineWidth = 4;
    x.strokeRect(16, 16, w - 32, h - 32);
    const bLen = 60;
    x.strokeStyle = '#38BDF8';
    x.lineWidth = 10;
    [[16, 16, 1, 1], [w - 16, 16, -1, 1], [16, h - 16, 1, -1], [w - 16, h - 16, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      x.beginPath();
      x.moveTo(cx, cy + sy * bLen);
      x.lineTo(cx, cy);
      x.lineTo(cx + sx * bLen, cy);
      x.stroke();
    });

    x.fillStyle = '#38BDF8'; x.font = `800 34px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('SHATRANJ CITY // HOLO INTERCHANGE', w / 2, 92);
    x.fillStyle = '#94A3B8'; x.font = `700 22px ${FONT_D}`;
    x.fillText('TERMINAL NODE · REAR HOUSING CHASSIS', w / 2, 126);

    // Center Hexagonal Cyber Shield Crest
    const cx = w / 2, cy = h / 2;
    x.save();
    x.fillStyle = '#0d172e';
    x.beginPath();
    for (let a = 0; a < 6; a++) {
      const rad = a * Math.PI / 3;
      const px = cx + Math.cos(rad) * 190, py = cy + Math.sin(rad) * 190;
      if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = '#38BDF8'; x.lineWidth = 4; x.stroke();

    x.strokeStyle = 'rgba(56, 189, 248, 0.3)'; x.lineWidth = 2.5;
    x.beginPath(); x.arc(cx, cy, 145, 0, Math.PI * 2); x.stroke();

    x.fillStyle = '#FFFFFF'; x.font = `900 48px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('VAJRA', cx, cy - 22);
    x.fillStyle = '#38BDF8'; x.font = `800 26px ${FONT_D}`;
    x.fillText('DESIGN SYSTEMS', cx, cy + 26);
    x.restore();

    // Bottom diagnostic telemetry
    x.fillStyle = '#0b1324';
    x.beginPath(); x.roundRect(100, h - 170, w - 200, 90, 16); x.fill();
    x.strokeStyle = 'rgba(56, 189, 248, 0.7)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#FFFFFF'; x.font = `800 28px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('FIBER BACKHAUL · ULTRA-HD FEED ACTIVE', w / 2, h - 138);
    x.fillStyle = '#38BDF8'; x.font = `700 22px ${FONT_D}`;
    x.fillText('60 FPS // 4K REFRESH // DRIVE TO FRONT TO INTERACT', w / 2, h - 106);
  });
}
function wrap(x, text, px, py, maxW, lh, maxL) { const words = String(text).split(' '); let line = '', n = 0; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > maxW && line) { x.fillText(line, px, py); py += lh; line = wd; if (++n >= maxL) return; } else line = t; } if (line) x.fillText(line, px, py); }
function drawBoard(cv, progress) {
  const x = cv.getContext('2d'), w = cv.width, h = cv.height, R = PORTFOLIO.resume;
  x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2a2a2e'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = '#E9CF5C'; x.font = `600 44px ${FONT_D}`; x.textBaseline = 'middle'; x.fillText('DEPARTURES', 28, 44); x.font = `600 34px ${FONT_H}`; x.fillText('प्रस्थान', 250, 46);
  x.fillStyle = '#9a9a9a'; x.font = `500 24px ${FONT_D}`; x.fillText('YEARS', 28, 96); x.fillText('DESTINATION', 180, 96); x.fillText('ROLE', 610, 96);
  const rows = R.experience.map(e => [e.start + '–' + e.end, e.company, e.role]).concat(R.education.map(e => [e.years, e.school, e.degree])).slice(0, 5);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  rows.forEach((r, i) => { const y = 150 + i * 62; [[r[0], 28, 150], [r[1], 180, 420], [r[2], 610, 390]].forEach(([t, px, mw]) => { t = String(t).toUpperCase(); const n = Math.min(t.length, Math.floor(mw / 22)); for (let k = 0; k < n; k++) { const cx = px + k * 22; x.fillStyle = '#1c1c20'; x.fillRect(cx, y - 24, 20, 48); x.fillStyle = '#000'; x.fillRect(cx, y - 1, 20, 2); const settled = k / n < progress * 1.4 - (i * 0.1); const ch = settled ? t[k] : chars[Math.floor(Math.random() * chars.length)]; x.fillStyle = '#F2D46A'; x.font = `600 34px ${FONT_D}`; x.textAlign = 'center'; x.fillText(ch, cx + 10, y + 3); x.textAlign = 'left'; } }); });
}

// ---------- physics ----------
const CARR = 1.05, CAROFF = 1.35;
function collideCar(c) {
  let impact = 0; const f = [-Math.sin(c.yaw), -Math.cos(c.yaw)];
  for (const s of [CAROFF, -CAROFF, 0]) {
    const px = c.x + f[0] * s, pz = c.z + f[1] * s;
    for (const i of nearColliders(px, pz)) {
      let nx, nz, d, r = CARR;
      if (i >= 0) { const b = W.boxes[i]; const qx = clamp(px, b.x0, b.x1), qz = clamp(pz, b.z0, b.z1); nx = px - qx; nz = pz - qz; d = Math.hypot(nx, nz); if (d === 0) { const opts = [[px - b.x0, -1, 0], [b.x1 - px, 1, 0], [pz - b.z0, 0, -1], [b.z1 - pz, 0, 1]].sort((a, b) => a[0] - b[0]); nx = opts[0][1]; nz = opts[0][2]; d = -opts[0][0]; } else { nx /= d; nz /= d; } }
      else { const cc = W.circles[-1 - i]; nx = px - cc.x; nz = pz - cc.z; d = Math.hypot(nx, nz) - cc.r; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; }
      if (d < r) { const pen = r - d; c.x += nx * pen; c.z += nz * pen; const vn = c.vx * nx + c.vz * nz; if (vn < 0) { c.vx -= nx * vn * 1.15; c.vz -= nz * vn * 1.15; impact = Math.max(impact, -vn); const k = 1 - 0.3 * clamp(-vn / 14, 0, 1); c.vx *= k; c.vz *= k; } }
    }
  }
  impact = Math.max(impact, collideMovers(c));
  return impact;
}
function surfaceAt(x, z) { for (const zn of W.zones) if (x > zn.x0 && x < zn.x1 && z > zn.z0 && z < zn.z1 && /OLD|MARKET|TEMPLE/.test(zn.name)) return 'dust'; return 'asphalt'; }
const GEARS = [0, 12, 21, 30, 40, 60];
function updateCar(dt) {
  const c = GAME.car, inp = GAME.input;
  const locked = GAME.phase !== 'driving';
  let thr = locked ? 0 : inp.throttle, brk = locked ? 0 : inp.brake, str = locked ? 0 : inp.steer, hb = !locked && inp.drift;
  if (c.auto > 0) { thr = c.vf < 8 ? 0.7 : 0; c.auto -= dt; }
  if (GAME.phase === 'entering' || GAME.phase === 'panel') brk = 1;
  let fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
  const wantBoost = inp.boost && !locked && (c.boosting ? c.boost > 0 : c.boost > 5);
  if (wantBoost) thr = Math.max(thr, 1.0);
  const canBoost = wantBoost;
  c.boosting = canBoost; const maxF = canBoost ? 52 : 38;
  if (thr > 0) { if (vf < -0.5) vf += 22 * dt; else { const a = canBoost ? 17 : 12.5 * (1 - Math.pow(clamp(vf / maxF, 0, 1), 2.2)); vf += a * thr * dt; } }
  if (brk > 0) { if (vf > 0.5) vf -= 26 * dt; else if (!locked) vf = Math.max(vf - 9 * dt, -12); else vf = damp(vf, 0, 6, dt); }
  if (!thr && !brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.4 + Math.abs(vf) * 0.07) * dt);
  if (vf > maxF) vf = damp(vf, maxF, 1.2, dt);
  if (hb) vf -= Math.sign(vf) * 3.5 * dt;
  c.boost = clamp(c.boost + (canBoost ? -25 : 12) * dt, 0, 100);
  // steering (A = +1 = left = yaw increases)
  const sp = Math.abs(vf), maxSteer = lerp(0.55, 0.16, clamp(sp / 40, 0, 1)) * (hb ? 1.35 : 1);
  c.steer = damp(c.steer, str * maxSteer, 9, dt);
  const slip = Math.atan2(Math.abs(vl), Math.max(1, Math.abs(vf)));
  let yawRate = vf / 2.75 * Math.tan(c.steer); if (hb) yawRate *= 1.3;
  if (slip > 0.55) yawRate *= Math.max(0.15, 1 - (slip - 0.55) * 2.2); // keep drifts controllable, no spin-outs
  const yawCap = hb ? 2.1 : 1.8; yawRate = clamp(yawRate, -yawCap, yawCap);
  let wx = fx * vf + rx * vl, wz = fz * vf + rz * vl;
  c.yaw += yawRate * dt;
  fx = -Math.sin(c.yaw); fz = -Math.cos(c.yaw); rx = Math.cos(c.yaw); rz = -Math.sin(c.yaw);
  vf = wx * fx + wz * fz; vl = wx * rx + wz * rz;
  const grip = hb ? 1.7 + Math.max(0, slip - 0.5) * 7 : (Math.abs(vl) > 5 ? 3.2 : 8.5) + Math.max(0, slip - 0.6) * 6, keep = Math.exp(-grip * dt), lost = Math.abs(vl) * (1 - keep);
  vl *= keep; if (vf >= 0) vf += lost * 0.55;
  c.vx = fx * vf + rx * vl; c.vz = fz * vf + rz * vl; c.vf = vf; c.vl = vl;
  // integrate with sub-steps
  const spd = Math.hypot(c.vx, c.vz), n = Math.max(1, Math.ceil(spd * dt / 0.5)); let impact = 0;
  for (let i = 0; i < n; i++) { c.x += c.vx * dt / n; c.z += c.vz * dt / n; impact = Math.max(impact, collideCar(c)); }
  c.speed = Math.hypot(c.vx, c.vz);
  c.drifting = Math.abs(vl) > 2.6 && c.speed > 8;
  c.roll = damp(c.roll, clamp(-yawRate * vf * 0.012, -0.08, 0.08), 6, dt);
  c.pitch = damp(c.pitch, clamp((thr > 0 ? -0.02 : 0) + (brk > 0 && vf > 1 ? 0.035 : 0) - (canBoost ? 0.02 : 0), -0.05, 0.05), 5, dt);
  c.spin -= vf * dt / 0.36;
  if (vf < -0.5) c.gear = 'R'; else if (sp < 0.4 && !thr) c.gear = 'N'; else { let g = 1; while (g < 5 && vf > GEARS[g]) g++; c.gear = String(g); }
  const gi = c.gear === 'R' || c.gear === 'N' ? 1 : +c.gear; const lo = GEARS[gi - 1], hi = GEARS[gi];
  const rpmT = c.gear === 'N' ? (thr ? 4.5 : 0.9) : clamp(1.1 + (Math.abs(vf) - lo) / (hi - lo) * 7.4 + (canBoost ? 0.8 : 0), 0.9, 9.6);
  c.rpm = damp(c.rpm, rpmT, 8, dt);
  if (impact > 5) { GAME.cam.shake = Math.min(1, impact / 18); for (let i = 0; i < 18; i++) FX.add.emit({ pos: [c.x + fx * 2, 0.6, c.z + fz * 2], vel: [(Math.random() - 0.5) * 9, 2 + Math.random() * 5, (Math.random() - 0.5) * 9], life: 0.5, size: 0.14, col: [1, 0.72, 0.28, 1], g: 14, drag: 1 }); GAME.emit('impact', impact); }
  c.throttle = thr; c.hb = hb;
}

// ---------- effects state ----------
const FX = {}; const TRAIL = [];
function tyreMark(a, b) { const buf = MESH.marksBuf, i = MESH.marksHead; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.14, nz = dx / l * 0.14, y = 0.065; const q = [[a[0] + nx, y, a[1] + nz], [b[0] + nx, y, b[1] + nz], [b[0] - nx, y, b[1] - nz], [a[0] - nx, y, a[1] - nz]]; let k = i * 42; for (const j of [0, 1, 2, 0, 2, 3]) { buf[k++] = q[j][0]; buf[k++] = q[j][1]; buf[k++] = q[j][2]; buf[k++] = 0.06; buf[k++] = 0.055; buf[k++] = 0.05; buf[k++] = 0.55; } MESH.marksHead = (i + 1) % 420; MESH.marksN = Math.min(420, MESH.marksN + 1); MESH.marksDirty = true; }
let lastWheels = null;
function updateFX(dt) {
  const c = GAME.car, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
  const rearL = [c.x - rx * 0.92 - fx * 1.35, c.z - rz * 0.92 - fz * 1.35], rearR = [c.x + rx * 0.92 - fx * 1.35, c.z + rz * 0.92 - fz * 1.35];
  const surf = surfaceAt(c.x, c.z);
  if (c.drifting || (c.throttle && c.speed < 6 && c.rpm > 5)) {
    for (const w of [rearL, rearR]) if (Math.random() < 0.8) FX.alpha.emit({ pos: [w[0], 0.3, w[1]], vel: [-fx * 2 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -fz * 2 + (Math.random() - 0.5) * 2], life: 1.4 + Math.random(), size: 0.9, grow: 2.6, drag: 1.4, col: surf === 'dust' ? [0.78, 0.64, 0.48, 0.55] : [0.85, 0.84, 0.82, 0.5] });
    if (lastWheels) { if (Math.hypot(rearL[0] - lastWheels[0][0], rearL[1] - lastWheels[0][1]) > 0.35) { tyreMark(lastWheels[0], rearL); tyreMark(lastWheels[1], rearR); lastWheels = [rearL, rearR]; } } else lastWheels = [rearL, rearR];
    if (c.drifting && surf === 'dust' && Math.random() < 0.5) FX.add.emit({ pos: [rearL[0], 0.2, rearL[1]], vel: [(Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6], life: 0.45, size: 0.1, col: [1, 0.7, 0.28, 1], g: 12 });
  } else lastWheels = null;
  if (c.boosting) {
    // Both titanium silencer exhausts: left (-0.14) and right (+0.14)
    for (const s of [-0.14, 0.14]) {
      // Base exhaust tip position in world coordinates (flush at rear diffuser contour z = 2.36)
      const exX = c.x + rx * s - fx * 2.36;
      const exY = 0.38 + (c.pitch || 0) * 2.36;
      const exZ = c.z + rz * s - fz * 2.36;

      // 1. Supersonic Mach diamond core (intense electric cyan plasma)
      for (let k = 0; k < 3; k++) {
        const jetDist = 0.12 + k * 0.20;
        FX.add.emit({
          pos: [exX - fx * jetDist, exY + (Math.random() - 0.5) * 0.03, exZ - fz * jetDist],
          vel: [-fx * (34 + Math.random() * 14) + c.vx * 0.8, (Math.random() - 0.5) * 0.8, -fz * (34 + Math.random() * 14) + c.vz * 0.8],
          life: 0.14 + Math.random() * 0.08,
          size: 0.26 - k * 0.05,
          grow: -0.8,
          drag: 0.1,
          col: [0.15, 0.92, 1.0, 1.0]
        });
      }

      // 2. Roaring turbulent flame tongues (blazing yellow-orange and crimson fire)
      for (let k = 0; k < 6; k++) {
        const spreadX = (Math.random() - 0.5) * 0.14;
        const spreadY = (Math.random() - 0.5) * 0.09;
        const flameCol = (k % 3 === 0)
          ? [1.0, 0.96, 0.45, 1.0]   // Golden yellow heat core
          : (k % 3 === 1)
          ? [1.0, 0.48, 0.08, 0.95]  // Roaring orange flame
          : [0.95, 0.16, 0.04, 0.90]; // Deep crimson flame tip
        FX.add.emit({
          pos: [exX + rx * spreadX, exY + spreadY, exZ + rz * spreadX],
          vel: [-fx * (26 + Math.random() * 18) + c.vx * 0.85, (Math.random() - 0.5) * 1.6, -fz * (26 + Math.random() * 18) + c.vz * 0.85],
          life: 0.24 + Math.random() * 0.14,
          size: 0.48 + Math.random() * 0.28,
          grow: 1.6,
          drag: 0.35,
          col: flameCol
        });
      }

      // 3. High-velocity incandescent fire sparks & embers shooting backward
      for (let k = 0; k < 4; k++) {
        FX.add.emit({
          pos: [exX, exY, exZ],
          vel: [-fx * (42 + Math.random() * 28) + rx * (Math.random() - 0.5) * 10 + c.vx,
                1.2 + Math.random() * 3.5,
                -fz * (42 + Math.random() * 28) + rz * (Math.random() - 0.5) * 10 + c.vz],
          life: 0.42 + Math.random() * 0.28,
          size: 0.12,
          grow: -0.2,
          drag: 0.7,
          g: 7.0,
          col: [1.0, 0.82, 0.25, 1.0]
        });
      }
    }
  }
  if (c.throttle && c.speed < 2 && !FX.launched) { FX.launched = true; for (let i = 0; i < 12; i++) for (const s of [-0.13, 0.13]) FX.add.emit({ pos: [c.x + rx * s - fx * 2.45, 0.36, c.z + rz * s - fz * 2.45], vel: [-fx * (4 + Math.random() * 5), Math.random(), -fz * (4 + Math.random() * 5)], life: 0.22, size: 0.7, grow: -2, col: [1, 0.62, 0.25, 1] }); }
  if (c.speed > 4) FX.launched = false;
  // gulal sacks
  for (const s of W.sacks) { s.cool -= dt; if (s.cool <= 0 && c.speed > 4 && Math.hypot(c.x - s.x, c.z - s.z) < 2.6) { s.cool = 5; for (let i = 0; i < 90; i++) { const col = [s.col, hex('#E84A8A'), hex('#F2C230'), hex('#E0442A')][i % 4]; FX.alpha.emit({ pos: [s.x, 0.8, s.z], vel: [(Math.random() - 0.5) * 7 + c.vx * 0.2, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 7 + c.vz * 0.2], life: 1.8 + Math.random(), size: 0.5, grow: 2.2, drag: 1.6, g: 1.2, col: [...col, 0.8] }); } GAME.emit('gulal'); } }
  // trails history
  TRAIL.unshift({ x: c.x, z: c.z, yaw: c.yaw, b: c.boosting ? 1 : 0, s: c.speed }); if (TRAIL.length > 22) TRAIL.pop();
  FX.alpha.update(dt); FX.add.update(dt);
}

// ---------- landmarks, peds, traffic ----------
function updateWorld(dt) {
  const c = GAME.car; GAME.nearLm = null;
  let closestDist = Infinity;
  for (const lm of W.landmarks) {
    const isCases = lm.id === 'cases';
    lm.trig.forEach((t, i) => {
      const d = Math.hypot(c.x - t[0], c.z - t[1]);
      const maxR = isCases ? 5.2 : 8.8;
      if (d < maxR && d < closestDist) {
        closestDist = d;
        GAME.nearLm = { lm, i };
      }
    });
  }
  // stalls light up when you roll past slowly
  for (const st of W.stalls) { const on = Math.hypot(c.x - st.x, c.z - st.z) < 10 && c.speed < 9; st.lit = damp(st.lit, on ? 1 : 0, 5, dt); W.signs[st.sign].emis = 0.55 + st.lit * 1.3; if (on && !st.seen) { st.seen = true; GAME.emit('stall', st.cat); } }
  updateTrains(dt);

  // Player interaction with 4-way traffic signals
  if (typeof getJunctionSignalState === 'function') {
    for (const j of W.trafficJunctions || []) {
      const dx = j.x - c.x, dz = j.z - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 26) {
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
        const ahead = dx * fx + dz * fz;
        const lat = Math.abs(dx * (-fz) + dz * fx);
        if (ahead > 0 && ahead < 22 && lat < 7.0) {
          const isNS = Math.abs(dz) >= Math.abs(dx);
          const { stateNS, stateEW } = getJunctionSignalState(j, GAME.t);
          const state = isNS ? stateNS : stateEW;
          const stopDist = isNS ? (j.wz * 0.5 + 3.8) : (j.wx * 0.5 + 3.8);
          const distToLine = ahead - stopDist;

          // Player stops at red light
          if (state === 'red' && distToLine > -0.5 && distToLine < 5.0 && c.speed < 1.2) {
            if (!j.playerStopped) {
              j.playerStopped = true;
              if (typeof toast === 'function') toast('🚦 Stopped at Red Light. Cross-traffic moving.');
            }
          }
          // Player runs red light
          if (state === 'red' && ahead < stopDist - 0.5 && ahead > 0 && c.speed > 5.0 && !j.playerStopped) {
            if (!j.playerViolation) {
              j.playerViolation = true;
              if (typeof toast === 'function') toast('⚠️ Red Light Violation! Drive carefully at junctions!');
            }
          }
        }
      } else {
        j.playerStopped = false;
        j.playerViolation = false;
      }
    }
  }

  for (const t of TRAFFIC) {
    const p0 = samplePath(t.path, t.s); let block = !!t.hit;
    if (t.y < 1) {
      const dx = c.x - p0[0], dz = c.z - p0[1], fx = -Math.sin(p0[2]), fz = -Math.cos(p0[2]);
      const ahead = dx * fx + dz * fz, lat = Math.abs(dx * -fz + dz * fx);
      if (ahead > 0 && ahead < t.len / 2 + 10 && lat < 3.4) block = true;
      if (crossingBlocks(p0)) block = true;
      if (typeof trafficLightBlocks === 'function' && trafficLightBlocks(t, p0)) block = true;
    }
    // Proactive collision avoidance: check same-lane cars and intersecting/knocked vehicles!
    for (const o of TRAFFIC) {
      if (o === t) continue;
      if (o.path === t.path) {
        let ds = o.s - t.s;
        if (ds < 0) ds += t.path.L;
        const minGap = (t.len + o.len) * 0.5 + 1.2;
        const stopGap = (t.len + o.len) * 0.5 + 4.2;
        if (ds > t.path.L - minGap) ds -= t.path.L;
        if (ds > 0 && ds < stopGap) block = true;
        if (ds <= minGap && ds >= -minGap) {
          t.s = (o.s - minGap + t.path.L) % t.path.L;
          t.v = Math.min(t.v, Math.max(0, o.v));
          t.brake = 1;
          block = true;
        }
      } else {
        const dx = o.x - t.x, dz = o.z - t.z;
        const dist = Math.hypot(dx, dz);
        const stopR = (t.len + o.len) * 0.5 + 4.2;
        if (dist < stopR + 2.0) {
          const tf = [-Math.sin(t.yaw), -Math.cos(t.yaw)];
          const of = [-Math.sin(o.yaw), -Math.cos(o.yaw)];
          const headingDot = tf[0] * of[0] + tf[1] * of[1];
          const ahead = dx * tf[0] + dz * tf[1];
          const lat = Math.abs(dx * -tf[1] + dz * tf[0]);
          // When cars are in opposite lanes (headingDot < -0.2), they pass each other safely unless directly overlapping (lat < 1.05m)
          const maxLat = headingDot < -0.2 ? 1.05 : (t.wid + o.wid) * 0.50;
          if (ahead > 0.4 && ahead < stopR && lat < maxLat) {
            block = true;
          }
        }
      }
    }
    const v0 = t.v; t.v = damp(t.v, block ? 0 : t.cruise, block ? 6.5 : 1.2, dt); t.brake = damp(t.brake, (block && v0 > 0.3) || (block && t.v < 0.2) ? 1 : 0, 8, dt); t.s = (t.s + t.v * dt) % t.path.L;
    const p = samplePath(t.path, t.s); t.byaw = (t.byaw ?? p[2]); t.byaw += angDiff(t.byaw, p[2]) * Math.min(1, dt * 8); t.x = p[0] + (t.kx || 0); t.z = p[1] + (t.kz || 0); t.yaw = t.byaw + (t.kyaw || 0);
  }
  // Immediately resolve any traffic-on-traffic geometric penetration and impulse clash
  if (typeof collideTrafficTraffic === 'function') {
    collideTrafficTraffic(dt);
  }
  for (const p of PEDS) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    const danger = (d < 8.5 && c.speed > 2.0) || (GAME.hornT > 0 && d < 20);
    if (danger) {
      const side = Math.sign(dx * -Math.cos(c.yaw) - dz * -Math.sin(c.yaw)) || 1;
      const tx = Math.cos(c.yaw) * side * -3.2, tz = -Math.sin(c.yaw) * side * -3.2;
      p.ox = damp(p.ox, tx, 6, dt);
      p.oz = damp(p.oz, tz, 6, dt);
      const fleeYaw = Math.atan2(-tx, -tz);
      p.yaw += angDiff(p.yaw, fleeYaw) * Math.min(1, dt * 7);
      p.alert = damp(p.alert || 0, 1, 8, dt);
      p.moving = true;
      p.walkPhase = (p.walkPhase || 0) + dt * 10;
    } else {
      p.alert = damp(p.alert || 0, 0, 4, dt);
      p.ox = damp(p.ox, 0, 2, dt);
      p.oz = damp(p.oz, 0, 2, dt);
      if (p.role === 'walking') {
        const segL = p.segLen || 20;
        p.prog = (p.prog || 0) + (p.dir * (p.speed || 1.15) * dt) / segL;
        if (p.prog >= 1.0) { p.prog = 1.0; p.dir = -1; }
        if (p.prog <= 0.0) { p.prog = 0.0; p.dir = 1; }
        if (p.p1 && p.p2) {
          p.bx = p.p1[0] + (p.p2[0] - p.p1[0]) * p.prog;
          p.bz = p.p1[1] + (p.p2[1] - p.p1[1]) * p.prog;
          const targetYaw = p.dir > 0 ? Math.atan2(-(p.p2[0] - p.p1[0]), -(p.p2[1] - p.p1[1])) : Math.atan2(-(p.p1[0] - p.p2[0]), -(p.p1[1] - p.p2[1]));
          p.yaw += angDiff(p.yaw, targetYaw) * Math.min(1, dt * 4.5);
        } else {
          p.ph += dt * 0.3;
          p.ox = damp(p.ox, Math.sin(p.ph) * p.wander * 0.5, 0.8, dt);
        }
        p.moving = true;
        p.walkPhase = (p.walkPhase || 0) + dt * (p.speed || 1.15) * 6.5;
      } else if (p.role === 'talking') {
        p.moving = false;
        if (p.groupCenter) {
          const targetYaw = Math.atan2(-(p.groupCenter[0] - p.bx), -(p.groupCenter[1] - p.bz));
          p.yaw += angDiff(p.yaw, targetYaw) * Math.min(1, dt * 4);
        }
        // Conversational group turn-taking: only one speaker at a time!
        const gid = p.groupId || ('grp_' + Math.floor(p.v / 2));
        let grp = TALK_GROUPS[gid];
        if (!grp) {
          grp = TALK_GROUPS[gid] = { peds: [], speaker: 0, timer: 3.5 + (p.ph % 3.0) };
        }
        if (!grp.peds.includes(p)) grp.peds.push(p);

        if (grp.peds[0] === p) {
          grp.timer -= dt;
          if (grp.timer <= 0) {
            grp.speaker = (grp.speaker + 1) % grp.peds.length;
            grp.timer = 3.5 + ((grp.speaker * 1.7 + p.ph) % 3.5);
          }
        }
        p.isTalking = (grp.peds[grp.speaker] === p);
        p.talkPhase = (p.talkPhase || 0) + dt * (p.isTalking ? 2.8 : 1.6);
      } else if (p.role === 'working') {
        p.moving = false;
        p.workPhase = (p.workPhase || 0) + dt;
      } else { // 'phone' or casual
        p.moving = false;
        p.talkPhase = (p.talkPhase || 0) + dt * 1.5;
      }
    }
    const nx = p.bx + p.ox, nz = p.bz + p.oz;
    p.x = nx; p.z = nz;
    if (d < 1.4) { p.bx += dx / (d || 1) * 1.2; p.bz += dz / (d || 1) * 1.2; }
  }
  
  // Update birds flying everywhere across the entire sky
  for (const b of BIRDS) {
    if (b.mode === 'roam') {
      // Roaming flight vector with smooth heading navigation
      b.x += Math.sin(b.yaw) * b.speed * dt;
      b.z += Math.cos(b.yaw) * b.speed * dt;

      // Soft boundary turn-back if approaching outer city limits
      const bound = 350;
      if (Math.abs(b.x) > bound || Math.abs(b.z) > bound) {
        const targetYaw = Math.atan2(-b.x, -b.z);
        let dy = targetYaw - b.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        b.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 1.5);
        b.turnRate = Math.sign(dy) * 0.45;
      } else {
        // Natural wandering turn rate
        b.turnTimer = (b.turnTimer || 0) - dt;
        if (b.turnTimer <= 0) {
          b.turnTimer = 2.5 + Math.random() * 4.0;
          b.targetTurn = (Math.random() - 0.5) * (b.turnAgility || 0.35);
        }
        b.turnRate = damp(b.turnRate || 0, b.targetTurn || 0, 1.8, dt);
        b.yaw += b.turnRate * dt;
      }
    } else {
      // Orbiting / patrolling flock with migrating centers
      if (b.driftSp) {
        b.cx += Math.cos(b.driftDir) * b.driftSp * dt;
        b.cz += Math.sin(b.driftDir) * b.driftSp * dt;
        if (Math.abs(b.cx) > 330 || Math.abs(b.cz) > 330) b.driftDir += Math.PI * 0.65;
      }
      b.ph += b.speed * dt;
      b.x = b.cx + Math.cos(b.ph) * b.r;
      b.z = b.cz + Math.sin(b.ph) * b.r;
      b.yaw = b.ph + Math.PI / 2;
      b.turnRate = b.speed;
    }

    // Realistic banking into turns
    b.bank = damp(b.bank || -0.22, -b.turnRate * 1.4 - 0.16, 3.2, dt);

    // Natural flapping vs gliding dynamics
    b.flapCycle = (b.flapCycle || 0) + dt;
    const isFlapping = Math.sin(b.flapCycle * (b.flapFreq || 1.8)) > (b.glideThresh || -0.15);
    if (isFlapping) {
      b.flap += dt * (b.flapSpeed || 14.0);
    }

    // Gentle vertical swooping wave
    b.waveT = (b.waveT || 0) + dt * (b.waveFreq || 0.8);
    b.y = (b.baseY || 35) + Math.sin(b.waveT + (b.wavePh || 0)) * (b.waveAmp || 1.8);
  }

  // Update 4 majestic flying dragons rotating continuously in the sky of Shatranj City
  for (const d of DRAGONS) {
    d.flightT = (d.flightT || 0) + dt;
    const t = d.flightT;

    // Advance orbital rotation angle around Shatranj City sky
    d.orbitAngle = (d.orbitAngle || d.phaseOffset || 0) + d.dir * d.orbitSpeed * dt;
    const a = d.orbitAngle;

    // Pure circular path roaming in the high sky over Shatranj City
    const targetX = d.cx + d.radius * Math.cos(a);
    const targetZ = d.cz + d.radius * Math.sin(a);
    const vertWave = Math.sin(t * d.altFreq + (d.phaseOffset || 0));
    const targetY = d.baseAlt + vertWave * d.altAmp;

    // Direct circular flight positioning high in the sky
    d.x = targetX;
    d.y = targetY;
    d.z = targetZ;

    // Exact forward velocity vector along the circular orbit
    const vx = -Math.sin(a) * d.dir;
    const vz = Math.cos(a) * d.dir;

    // Forward heading: points strictly forward along flight trajectory (head leading forward)
    const forwardYaw = Math.atan2(-vx, -vz);
    d.yaw = forwardYaw;

    // Natural aerodynamic banking: leaning inward into the circular turn
    const targetRoll = -d.dir * 0.28;
    d.roll = damp(d.roll || 0, targetRoll, 4.0, dt);

    // Aerodynamic vertical pitch matching undulating climb / dive
    const vertRate = Math.cos(t * d.altFreq + (d.phaseOffset || 0)) * d.altAmp * d.altFreq;
    const targetBodyPitch = clamp(-vertRate * 0.08, -0.22, 0.22);
    d.pitch = damp(d.pitch || 0, targetBodyPitch, 3.5, dt);

    // Unique continuous glide & flap personality (agile scout vs heavy wyrm vs river serpent vs soaring sovereign)
    const cycle = d.id === 'gold' ? Math.sin(t * 0.28) : Math.sin(t * 0.45 + (d.id === 'volcanic' ? 1.6 : d.id === 'jade' ? 3.2 : 0));
    const glideTarget = d.id === 'gold' ? (cycle > -0.2 ? 0.90 : 0.15) : (cycle > 0.22 ? 1.0 : 0.0);
    d.glideWeight = damp(d.glideWeight || 0, glideTarget, 2.2, dt);
    const flapSpeed = lerp(d.flapSpeedBase || 2.8, 0.35, d.glideWeight);
    d.wingPh += dt * flapSpeed;

    // Smooth organic aerodynamic wing strokes: powerful downstroke, fluid flexing upstroke
    const rawPh = d.wingPh;
    const flapStroke = (Math.sin(rawPh) - 0.22 * Math.sin(2 * rawPh));
    const activeFlap = flapStroke * (d.id === 'volcanic' ? 0.68 : d.id === 'obsidian' ? 0.62 : 0.54);
    const passiveGlide = -0.10 + Math.sin(t * 1.4) * 0.03; // gentle soaring dihedral flex
    const targetFlap = lerp(activeFlap, passiveGlide, d.glideWeight);
    d.smoothFlap = damp(d.smoothFlap || 0, targetFlap, 12.0, dt);

    // Wing pitch twist (feathering aeroelastic twist)
    const activePitch = -Math.cos(rawPh) * 0.16;
    const passivePitch = 0.04 + Math.sin(t * 1.4 + 1.2) * 0.02;
    const targetPitch = lerp(activePitch, passivePitch, d.glideWeight);
    d.smoothPitch = damp(d.smoothPitch || 0, targetPitch, 12.0, dt);

    // Wing sweep (retraction on upstroke)
    const activeSweep = Math.max(0, -Math.sin(rawPh)) * 0.10;
    const passiveSweep = 0.04;
    const targetSweep = lerp(activeSweep, passiveSweep, d.glideWeight);
    d.smoothSweep = damp(d.smoothSweep || 0, targetSweep, 12.0, dt);

    // Subtle wing flap aerodynamic lift bobbing
    const liftBob = lerp(Math.sin(d.wingPh) * (d.id === 'volcanic' ? 1.2 : 0.5), 0.0, d.glideWeight);
    d.y += liftBob * dt;

    // Dragon mouth breath torrents: 2 dragons breathe FIRE, 2 dragons breathe ICE!
    d.breathT = (d.breathT || 0) + dt;
    const breathCycle = d.breathT % 4.8;
    const isBreathing = breathCycle < 3.2; // 3.2s continuous roaring stream, 1.6s pause
    const bInt = isBreathing ? Math.sin((breathCycle / 3.2) * Math.PI) : 0;

    // Lifelike dragon head movement: scanning landscape, anticipating turns, tilting up proudly to roar
    const headScan = Math.sin(t * 0.7 + (d.id === 'volcanic' ? 1.2 : d.id === 'jade' ? 2.8 : 0)) * 0.18;
    const turnLead = clamp(-yawDiff * 0.7, -0.32, 0.32);
    d.headYaw = damp(d.headYaw || 0, headScan + turnLead, 3.5, dt);

    const roarTilt = isBreathing ? -0.16 : 0.0;
    const targetHeadPitch = -d.pitch * 0.45 + Math.sin(d.wingPh) * 0.03 + roarTilt;
    d.headPitch = damp(d.headPitch || 0, targetHeadPitch, 4.0, dt);
    d.headRoll = damp(d.headRoll || 0, -d.roll * 0.35, 4.0, dt);

    // Unique aerodynamic serpentine tail movement tuned to each dragon's mass & frequency
    const tailSpeed = d.tailFreq || 3.2;
    const turnSway = clamp(yawDiff * 1.8, -0.45, 0.45);
    d.tailYaw1 = Math.sin(t * tailSpeed) * 0.14 - turnSway * 0.40;
    d.tailPitch1 = -Math.cos(t * tailSpeed * 0.5) * 0.07 + (d.glideWeight > 0.5 ? 0.03 : -0.05);

    d.tailYaw2 = Math.sin(t * tailSpeed - 1.1) * 0.28 - turnSway * 0.75;
    d.tailPitch2 = -Math.cos(t * tailSpeed * 0.5 - 0.8) * 0.12;

    // Dynamic head and mouth matrix: breath torrents shoot directly from articulated jaws!
    const dragonM = M4.model(d.x, d.y, d.z, d.yaw, d.pitch, d.roll, d.scale, d.scale, d.scale);
    const MHead = M4.mul(dragonM, M4.model(0, 0.28, -1.8, d.headYaw, d.headPitch, d.headRoll));
    const mouthPos = M4.xf(MHead, [0, 0.85, -2.85]);
    const fwdPt = M4.xf(MHead, [0, 0.85, -5.5]);
    const fwdDir = V3.norm(V3.sub(fwdPt, mouthPos));

    if (isBreathing && FX) {
      if (d.element === 'fire') {
        // FIRE DRAGON BREATH (Both Dragons are radiant blazing RED)
        for (let k = 0; k < 2; k++) {
          const spd = 48 + Math.random() * 24 * bInt;
          const spread = (Math.random() - 0.5) * 4.5;
          const spreadY = (Math.random() - 0.5) * 3.5;
          const vx = fwdDir[0] * spd + spread;
          const vy = fwdDir[1] * spd + spreadY + 1.2;
          const vz = fwdDir[2] * spd + (Math.random() - 0.5) * 4.5;
          
          // Pure blazing red flame torrent (FX.add)
          if (FX.add) {
            const col = [1.0, 0.05 + Math.random() * 0.14, 0.04, 0.98];
            FX.add.emit({
              pos: [mouthPos[0] + (Math.random() - 0.5) * 1.5, mouthPos[1] + (Math.random() - 0.5) * 1.2, mouthPos[2] + (Math.random() - 0.5) * 1.5],
              vel: [vx, vy, vz],
              life: 1.55 + Math.random() * 0.45,
              size: 1.6 * d.scale * 0.35,
              grow: 7.5 * d.scale * 0.35,
              drag: 1.08,
              g: -1.2,
              col: col
            });
            // Brilliant fiery red core sparks
            if (Math.random() < 0.65) {
              FX.add.emit({
                pos: [mouthPos[0], mouthPos[1], mouthPos[2]],
                vel: [vx * 1.15, vy * 1.15, vz * 1.15],
                life: 0.95 + Math.random() * 0.35,
                size: 1.0, grow: 2.4, drag: 1.05,
                col: [1.0, 0.45 + Math.random() * 0.35, 0.20, 1.0]
              });
            }
          }
          // Billowing dark crimson flame smoke (FX.alpha)
          if (FX.alpha && Math.random() < 0.60) {
            FX.alpha.emit({
              pos: [mouthPos[0] + (Math.random() - 0.5) * 2.0, mouthPos[1], mouthPos[2] + (Math.random() - 0.5) * 2.0],
              vel: [vx * 0.75, vy * 0.75 + 1.8, vz * 0.75],
              life: 1.8 + Math.random() * 0.5,
              size: 2.2, grow: 8.5, drag: 1.10, g: -1.8,
              col: [0.36, 0.06, 0.06, 0.48 * bInt]
            });
          }
        }
      } else if (d.element === 'ice') {
        // ICE DRAGON BREATH (Dark Blue Glacial Frost Wyrms)
        for (let k = 0; k < 2; k++) {
          const spd = 44 + Math.random() * 22 * bInt;
          const swirlA = d.breathT * 12 + Math.random() * 6.28;
          const swirlR = 2.4;
          const vx = fwdDir[0] * spd + Math.cos(swirlA) * swirlR;
          const vy = fwdDir[1] * spd + Math.sin(swirlA) * swirlR - 0.8;
          const vz = fwdDir[2] * spd + (Math.random() - 0.5) * swirlR;
          
          // Deep dark blue / sapphire glacial ice crystal shards (FX.add)
          if (FX.add) {
            const col = [0.12, 0.45 + Math.random() * 0.35, 1.0, 0.98];
            FX.add.emit({
              pos: [mouthPos[0] + (Math.random() - 0.5) * 1.5, mouthPos[1] + (Math.random() - 0.5) * 1.2, mouthPos[2] + (Math.random() - 0.5) * 1.5],
              vel: [vx, vy, vz],
              life: 1.55 + Math.random() * 0.45,
              size: 1.5 * d.scale * 0.35,
              grow: 6.8 * d.scale * 0.35,
              drag: 1.06,
              g: 1.5,
              col: col
            });
            // Diamond frost needle glints
            if (Math.random() < 0.70) {
              FX.add.emit({
                pos: [mouthPos[0], mouthPos[1], mouthPos[2]],
                vel: [vx * 1.1, vy * 1.1, vz * 1.1],
                life: 0.95 + Math.random() * 0.40,
                size: 0.65, grow: 1.5, drag: 1.04,
                col: [0.70, 0.90, 1.0, 1.0]
              });
            }
          }
          // Freezing dark blue arctic blizzard fog (FX.alpha)
          if (FX.alpha && Math.random() < 0.65) {
            FX.alpha.emit({
              pos: [mouthPos[0] + (Math.random() - 0.5) * 1.8, mouthPos[1], mouthPos[2] + (Math.random() - 0.5) * 1.8],
              vel: [vx * 0.78, vy * 0.78, vz * 0.78],
              life: 1.7 + Math.random() * 0.5,
              size: 1.6, grow: 5.8, drag: 1.08, g: 1.0,
              col: [0.20, 0.50, 0.92, 0.52 * bInt]
            });
          }
        }
      }
    }

    // Ambient floating embers and aerodynamic wingtip vapor trails
    if ((d.id === 'volcanic' || d.id === 'gold') && FX && FX.add && Math.random() < 0.45) {
      FX.add.emit({
        pos: [d.x + (Math.random() - 0.5) * 6.5, d.y - 1.0, d.z + (Math.random() - 0.5) * 6.5],
        vel: [(Math.random() - 0.5) * 1.5, -2.0 - Math.random() * 1.2, (Math.random() - 0.5) * 1.5],
        life: 1.05, size: 0.70, grow: 0.85, drag: 1.03,
        col: [1.0, 0.10 + Math.random() * 0.18, 0.06, 0.95] // Radiant red embers
      });
    }
    if ((d.id === 'obsidian' || d.id === 'jade') && FX && FX.alpha && !d.isGliding && Math.random() < 0.35) {
      for (const s of [-1, 1]) {
        FX.alpha.emit({
          pos: [d.x + s * Math.cos(d.yaw) * 9.8, d.y + 0.5, d.z - s * Math.sin(d.yaw) * 9.8],
          vel: [0, -0.4, 0],
          life: 0.75, size: 0.95, grow: 2.0, drag: 1.1,
          col: [0.22, 0.55, 0.95, 0.45] // Dark blue ice wing vapor
        });
      }
    }
  }

  // Update river water serpent dragon swimming through the river with realistic serpentine anguilliform kinematics
  if (SERPENT) {
    SERPENT.x += SERPENT.dir * SERPENT.speed * dt;
    if (SERPENT.dir > 0 && SERPENT.x > 450) {
      SERPENT.dir = -1;
    } else if (SERPENT.dir < 0 && SERPENT.x < -450) {
      SERPENT.dir = 1;
    }
    SERPENT.phase += dt * 1.5;
    SERPENT.baseYaw = SERPENT.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  // Active boat movement across the river channel with dynamic current drift & wake trails
  for (const b of W.boats) {
    b.x += b.sp * dt;
    if (b.sp > 0 && b.x > 450) b.x = -450;
    if (b.sp < 0 && b.x < -450) b.x = 450;
    b.z = (b.baseZ !== undefined ? b.baseZ : b.z) + Math.sin(b.x * 0.015 + (b.ph || 0)) * 2.2;
    b.roll = Math.sin(GAME.t * 2.0 + (b.ph || 0)) * 0.06;
    b.pitch = Math.cos(GAME.t * 1.5 + (b.ph || 0)) * 0.035;

    // Boat wake trail: foaming white water V-wake and stern motor froth
    if (FX && FX.alpha && Math.random() < 0.45) {
      const dirSign = b.sp > 0 ? 1 : -1;
      // Stern bubbling wake
      FX.alpha.emit({
        pos: [b.x - dirSign * 4.2 + (Math.random() - 0.5) * 1.2, W.waterY + 0.08, b.z + (Math.random() - 0.5) * 1.0],
        vel: [-dirSign * 0.8, 0.08, (Math.random() - 0.5) * 0.8],
        life: 1.8, size: 1.2, grow: 2.2, drag: 1.1,
        col: [0.94, 0.98, 1.0, 0.45]
      });
      // V-shaped bow wave spray
      for (const s of [-1, 1]) {
        FX.alpha.emit({
          pos: [b.x + dirSign * 3.8, W.waterY + 0.06, b.z + s * 1.1],
          vel: [dirSign * 0.6, 0.12, s * 1.6],
          life: 1.2, size: 0.9, grow: 1.8, drag: 1.15,
          col: [0.96, 0.99, 1.0, 0.40]
        });
      }
    }
  }
  // departure board flips when you approach
  const rl = W.landmarks.find(l => l.id === 'resume'); const dR = Math.hypot(c.x - 0, c.z + 250);
  if (dR < 55 && rl.boardFlip < 0) rl.boardFlip = 0;
  if (rl.boardFlip >= 0 && rl.boardFlip < 1) { rl.boardFlip = Math.min(1, rl.boardFlip + dt / 1.6); FX.boardT = (FX.boardT || 0) + dt; if (FX.boardT > 0.07 || rl.boardFlip >= 1) { FX.boardT = 0; drawBoard(TEX.boardCv, rl.boardFlip); gl.bindTexture(gl.TEXTURE_2D, TEX.board); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, TEX.boardCv); gl.generateMipmap(gl.TEXTURE_2D); } }
  if (dR > 90 && rl.boardFlip >= 1) rl.boardFlip = -1;
}

// ---------- camera ----------
const CAMFX = { tour: null, orbit: null, hero: null };
// camera rigs: chase distances, heights and look-ahead per mode
const CAM_MODES = {
  chase: { name: 'Chase', dist: 6.6, h: 1.95, look: 5, lookY: 1.35, lag: 0.15, fov: 0 },
  close: { name: 'Close chase', dist: 4.7, h: 1.35, look: 6, lookY: 1.15, lag: 0.13, fov: 4 },
  far: { name: 'Far chase', dist: 10.5, h: 3.6, look: 4, lookY: 1.25, lag: 0.22, fov: -2 },
  hood: { name: 'Hood', hood: true, fov: 12 },
  drone: { name: 'Top-down', dist: 15, h: 24, look: 3, lookY: 0, lag: 0.32, fov: -6 }
};
const CAM_ORDER = ['chase', 'close', 'far', 'hood', 'drone'];
GAME.camMode = 'chase';
GAME.look = { yaw: 0, pitch: 0, zoom: 1, drag: false, since: 9 };
// keep the camera out of buildings: pull it toward the car if the line of sight passes through a tall footprint
function insideTall(x, z, pad) { for (const i of nearColliders(x, z)) { if (i < 0) continue; const b = W.boxes[i]; if (b.tall && x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true; } return false; }
function camClip(c, pos) {
  const dx = pos[0] - c.x, dz = pos[2] - c.z, L = Math.hypot(dx, dz); if (L < 0.6) return pos;
  for (let s = 0.1; s <= 1.0001; s += 0.05) { if (insideTall(c.x + dx * s, c.z + dz * s, 0.4)) { const t = Math.max(0.16, s - 0.1); return [c.x + dx * t, Math.max(pos[1], lerp(2.6, pos[1], t)), c.z + dz * t]; } }
  return pos;
}
function chasePose(dt, c) {
  const cam = GAME.cam, M = CAM_MODES[GAME.camMode] || CAM_MODES.chase, L = GAME.look;
  cam.yawL += angDiff(cam.yawL, c.yaw) * (1 - Math.exp(-dt / (M.lag || 0.25)));
  if (M.hood) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), W_ = (lx, ly, lz) => [c.x + lx * cy + lz * sy, ly, c.z - lx * sy + lz * cy];
    const a = L.yaw, p = clamp(-L.pitch, -0.5, 0.6), lx = -Math.sin(a) * 12, lz = -Math.cos(a) * 12;
    return { pos: W_(0, 1.02, -0.92), look: W_(lx, 0.95 + Math.tan(p) * 12, lz), snap: true };
  }
  const sf = clamp(c.speed / 38, 0, 1.4), boostK = c.boosting ? 0.6 : 0;
  const dist = (M.dist + smooth(0.7, 1, sf) * M.dist * 0.16 + boostK) * L.zoom, h = (M.h + smooth(0.7, 1, sf) * 0.2) * L.zoom;
  const R = Math.hypot(dist, h), el = clamp(Math.atan2(h, dist) + L.pitch, 0.04, 1.45), yaw = cam.yawL + L.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), hd = R * Math.cos(el), hh = R * Math.sin(el);
  const ahead = M.look * Math.max(0, Math.cos(L.yaw)) * (1 - smooth(0.2, 0.9, L.pitch));
  return { pos: [c.x - fx * hd, Math.max(0.45, hh), c.z - fz * hd], look: [c.x + fx * ahead, M.lookY, c.z + fz * ahead] };
}
GAME.setCamMode = function (m) { if (!CAM_MODES[m]) return; GAME.camMode = m; GAME.look.zoom = 1; GAME.look.yaw = 0; GAME.look.pitch = 0; GAME.emit('camMode', m); };
GAME.cycleCam = function () { const i = CAM_ORDER.indexOf(GAME.camMode); GAME.setCamMode(CAM_ORDER[(i + 1) % CAM_ORDER.length]); };
GAME.camName = () => (CAM_MODES[GAME.camMode] || CAM_MODES.chase).name;
function updateCamera(dt) {
  const cam = GAME.cam, c = GAME.view || GAME.car; let pose;
  const reduced = GAME.reduced;
  if (GAME.phase === 'tour' && CAMFX.tour) { const T = CAMFX.tour; T.t += dt; const shot = T.shots[Math.min(T.shots.length - 1, Math.floor(T.t / T.len))]; const k = smooth(0, 1, (T.t % T.len) / T.len); pose = { pos: V3.lerp(shot[0], shot[1], k), look: V3.lerp(shot[2], shot[3], k) }; cam.fov = 55; if (T.t >= T.shots.length * T.len) GAME.endTour(); }
  else if (GAME.phase === 'intro' && CAMFX.orbit) { const O = CAMFX.orbit; O.t += dt; const k = smooth(0, 1, O.t / O.len); const phi = lerp(O.from, 0, k), d = lerp(O.d0, 6.6, k), h = lerp(O.h0, 1.95, k); const lx = Math.sin(phi) * d, lz = Math.cos(phi) * d; const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    pose = { pos: [c.x + lx * cy + lz * sy, h, c.z - lx * sy + lz * cy], look: [c.x - Math.sin(c.yaw) * 5 * k, 0.8 + 0.15 * k, c.z - Math.cos(c.yaw) * 5 * k] }; cam.yawL = c.yaw;
    if (O.t >= O.len) { GAME.phase = 'driving'; CAMFX.orbit = null; GAME.emit('driving'); } }
  else if ((GAME.phase === 'entering' || GAME.phase === 'panel' || GAME.phase === 'exiting') && CAMFX.hero) { const H = CAMFX.hero; H.t += dt; const k = smooth(0, 1, H.t / H.len); const to = GAME.phase === 'exiting' ? chasePose(dt, c) : H.to; pose = { pos: V3.lerp(H.from.pos, to.pos, k), look: V3.lerp(H.from.look, to.look, k) };
    if (GAME.phase === 'panel') pose.pos = V3.add(pose.pos, [Math.sin(GAME.t * 0.3) * 0.3, 0, 0]);
    if (H.t >= H.len) { if (GAME.phase === 'entering') { GAME.phase = 'panel'; GAME.emit('openPanel', GAME.activeLm); } else if (GAME.phase === 'exiting') { GAME.phase = 'driving'; CAMFX.hero = null; } } }
  else {
    const idle = c.speed < 0.5 && !GAME.input.throttle && !GAME.input.brake && !GAME.input.steer; cam.idle = idle ? cam.idle + dt : 0;
    const L = GAME.look; L.since += dt; if (!L.drag && L.since > 1.4) { L.yaw = damp(L.yaw, 0, 2.2, dt); L.pitch = damp(L.pitch, 0, 2.2, dt); }
    if (L.drag || L.since < 1.4 || GAME.camMode === 'hood') cam.idle = 0;
    if (cam.idle > 6 && !reduced) { cam.orbitA += dt * 0.18; const a = c.yaw + Math.PI * 0.75 + cam.orbitA, d = 6.4; pose = { pos: [c.x + Math.sin(a) * d, 1.05, c.z + Math.cos(a) * d], look: [c.x, 0.7, c.z] }; }
    else { cam.orbitA = 0; pose = chasePose(dt, c); }
  }
  const snap = pose.snap && GAME.phase === 'driving', rate = snap ? 40 : GAME.phase === 'driving' ? (cam.idle > 6 && !reduced ? 1.4 : (GAME.look.drag ? 14 : 7)) : 60;
  if (GAME.phase === 'driving' && !snap && !(cam.idle > 6 && !reduced)) {
    // rigid follow: smooth the camera's offset from the car, so speed never makes the camera fall behind
    const base = [c.x, 0, c.z]; if (!cam.off) { cam.off = V3.sub(cam.pos, base); cam.loff = V3.sub(cam.look, base); }
    const k = 1 - Math.exp(-(GAME.look.drag ? 18 : 10) * dt), kl = 1 - Math.exp(-14 * dt);
    cam.off = V3.lerp(cam.off, V3.sub(pose.pos, base), k); cam.loff = V3.lerp(cam.loff, V3.sub(pose.look, base), kl);
    cam.pos = V3.add(base, cam.off); cam.look = V3.add(base, cam.loff);
  } else { cam.off = null; cam.pos = V3.lerp(cam.pos, pose.pos, 1 - Math.exp(-rate * dt)); cam.look = V3.lerp(cam.look, pose.look, 1 - Math.exp(-(rate + 4) * dt)); }
  if (GAME.phase === 'tour') { cam.pos = pose.pos; cam.look = pose.look; }
  if (GAME.camOverride) { cam.pos = GAME.camOverride.pos.slice(); cam.look = GAME.camOverride.look.slice(); }
  if ((GAME.phase === 'driving' || GAME.phase === 'intro') && GAME.camMode !== 'hood') cam.pos = camClip(c, cam.pos);
  const sf = clamp(c.speed / 38, 0, 1.4), mf = GAME.phase === 'driving' || GAME.phase === 'exiting' ? (CAM_MODES[GAME.camMode] || CAM_MODES.chase).fov : 0, fovT = GAME.phase === 'tour' ? 55 : (c.boosting ? 78 : lerp(60, 70, smooth(0.7, 1, sf))) + mf;
  cam.fov = damp(cam.fov, reduced ? Math.min(fovT, 64) : fovT, 4, dt);
  cam.shake = Math.max(0, cam.shake - dt * 2.5);
}
function startHero(lm, i) {
  const cam = GAME.cam; const h = lm.hero[i] || lm.hero[0];
  CAMFX.hero = { t: 0, len: GAME.reduced ? 0.01 : 0.85, from: { pos: cam.pos.slice(), look: cam.look.slice() }, to: { pos: h.pos, look: h.look } };
}

// ---------- rendering ----------
function setMainUniforms(u, vp, m) {
  const cam = GAME.cam;
  gl.uniformMatrix4fv(u.u_vp, false, vp); gl.uniform3fv(u.u_cam, cam.pos); gl.uniform3fv(u.u_sunDir, m.sunDir); gl.uniform3fv(u.u_sunCol, m.sunCol);
  gl.uniform3fv(u.u_ambSky, m.ambSky); gl.uniform3fv(u.u_ambGnd, m.ambGnd); gl.uniform3fv(u.u_fogCol, m.fogCol); gl.uniform3fv(u.u_skyTop, m.skyTop); gl.uniform3fv(u.u_skyHor, m.skyHor); gl.uniform3fv(u.u_water, m.water);
  gl.uniform2fv(u.u_fog, m.fog); gl.uniform1f(u.u_time, GAME.t); gl.uniform1f(u.u_night, m.night); gl.uniform1f(u.u_wet, m.wet); gl.uniform1f(u.u_emis, m.emis);
}
function drawMesh(u, mesh, model, colMul = [1, 1, 1], emisMul = 1) { gl.uniformMatrix4fv(u.u_model, false, model); gl.uniform3fv(u.u_colMul, colMul); gl.uniform1f(u.u_emisMul, emisMul); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); }
function drawQuad(u, tex, model, emis, alpha = 1, mode = 0) { gl.uniformMatrix4fv(u.u_model, false, model); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1f(u.u_emis, emis); gl.uniform1f(u.u_alpha, alpha); gl.uniform1f(u.u_mode, mode); gl.drawArrays(gl.TRIANGLES, 0, 6); }
function drawFlat(u, mesh, model, col, count) { gl.uniformMatrix4fv(u.u_model, false, model); gl.uniform4fv(u.u_colMul, col); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, count != null ? count : mesh.count); }

function render() {
  const cv = gl.canvas, w = cv.width, h = cv.height, m = GAME.mood, cam = GAME.cam, c = GAME.car;
  let eye = cam.pos.slice(); if (cam.shake > 0 || c.speed > 30) { const s = cam.shake * 0.25 + (GAME.reduced ? 0 : clamp((c.speed - 30) / 20, 0, 1) * 0.02); eye = [eye[0] + (Math.random() - 0.5) * s, eye[1] + (Math.random() - 0.5) * s, eye[2] + (Math.random() - 0.5) * s]; }
  const asp = w / h; let fovY = cam.fov * Math.PI / 180; if (asp < 1.3) fovY = Math.min(1.75, 2 * Math.atan(Math.tan(fovY / 2) * Math.pow(1.3 / asp, 0.6)));
  const near = GAME.camMode === 'hood' && GAME.phase === 'driving' ? 0.12 : 0.5, proj = M4.persp(fovY, asp, near, 1500), view = M4.lookAt(eye, cam.look, [0, 1, 0]), vp = M4.mul(proj, view), ivp = M4.inv(vp);
  GAME.lastVP = vp; GAME.lastView = view;
  const R = [view[0], view[4], view[8]], U = [view[1], view[5], view[9]];
  const useRT = RT.ok && (GAME.quality === 'high' || GAME.quality === 'ultra');
  gl.bindFramebuffer(gl.FRAMEBUFFER, useRT ? RT.ms : null); gl.viewport(0, 0, w, h);
  gl.clearColor(m.fogCol[0], m.fogCol[1], m.fogCol[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  // sky
  gl.depthMask(false); gl.useProgram(P.sky.p); const su = P.sky.u;
  gl.uniformMatrix4fv(su.u_ivp, false, ivp); gl.uniform3fv(su.u_cam, eye);
  gl.uniform3fv(su.u_sunDir, m.sunDir); gl.uniform3fv(su.u_sunCol, m.sunCol);
  gl.uniform3fv(su.u_moonDir, m.moonDir || [-m.sunDir[0], -m.sunDir[1] + 0.12, -m.sunDir[2]]);
  gl.uniform3fv(su.u_moonCol, m.moonCol || [0.88, 0.94, 1.0]);
  gl.uniform3fv(su.u_skyTop, m.skyTop); gl.uniform3fv(su.u_skyMid, m.skyMid); gl.uniform3fv(su.u_skyHor, m.skyHor);
  gl.uniform3fv(su.u_sunGlow, m.sunGlow);
  gl.uniform1f(su.u_clouds, m.clouds !== undefined ? m.clouds : 0.58);
  gl.uniform1f(su.u_time, GAME.t);
  gl.uniform1f(su.u_sunSize, m.sunSize !== undefined ? m.sunSize : 0.0016);
  gl.uniform1f(su.u_moonSize, m.moonSize !== undefined ? m.moonSize : 0.0018);
  gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
  // opaque world
  gl.useProgram(P.main.p); const u = P.main.u; setMainUniforms(u, vp, m); gl.uniform3fv(u.u_cam, eye);
  if (GAME.lightUniforms) { const q_ = GAME.view || c; GAME.lightUniforms(u, M4.model(q_.x, 0, q_.z, q_.yaw, isFinite(c.pitch) ? c.pitch : 0, isFinite(c.roll) ? c.roll : 0)); }
  { const FP = frustumPlanes(vp), far = m.fog[1] + 80, far2 = far * far; let nd = 0;
    for (const ch of statics) { if (!boxVisible(FP, ch.min, ch.max)) continue; const dx = Math.max(ch.min[0] - eye[0], 0, eye[0] - ch.max[0]), dz = Math.max(ch.min[2] - eye[2], 0, eye[2] - ch.max[2]); if (dx * dx + dz * dz > far2) continue; drawMesh(u, ch, IDENT); nd++; }
    GAME.chunksDrawn = nd; }
  const cv_ = GAME.view || c; const carM = M4.model(cv_.x, 0, cv_.z, cv_.yaw, isFinite(c.pitch) ? c.pitch : 0, isFinite(c.roll) ? c.roll : 0); gl.uniform1f(u.u_fill, 0.34);
  if (c.boosting) {
    const fx = -Math.sin(cv_.yaw), fz = -Math.cos(cv_.yaw);
    gl.uniform4f(u.u_pt, cv_.x - fx * 2.6, 0.45, cv_.z - fz * 2.6, 8.5);
    gl.uniform3f(u.u_ptCol, 1.0, 0.45, 0.12);
  } else {
    gl.uniform4f(u.u_pt, 0, 0, 0, 0);
  }
  gl.uniform1f(u.u_spotOn, 0); drawMesh(u, MESH.car, carM);
  // NITRO SUPERSONIC FIRE CONES PROTRUDING FROM EXHAUST SILENCERS
  if (c.boosting && MESH.nitroFlame) {
    const flicker1 = 1.0 + Math.sin(GAME.t * 80) * 0.18 + (Math.random() - 0.5) * 0.12;
    const flicker2 = 1.0 + Math.cos(GAME.t * 85) * 0.18 + (Math.random() - 0.5) * 0.12;
    for (const [idx, s] of [[0, -0.14], [1, 0.14]]) {
      const flk = idx === 0 ? flicker1 : flicker2;
      // Extrudes along +Y rotated by pitch = PI/2 into +Z, shooting straight out rear silencers!
      const flameM = M4.mul(carM, M4.model(s, 0.38, 2.36, 0, Math.PI / 2, 0, flk * 1.15, flk * 1.6, flk * 1.15));
      drawMesh(u, MESH.nitroFlame, flameM, [1, 1, 1], 4.5);
    }
  }
  for (const [wx, wz, left, front] of [[-0.92, -1.45, 1, 1], [0.92, -1.45, 0, 1], [-0.92, 1.35, 1, 0], [0.92, 1.35, 0, 0]]) { const st = front ? c.steer : 0; const wm = M4.mul(carM, M4.model(wx, 0.36, wz, st + (left ? Math.PI : 0), left ? -c.spin : c.spin, 0)); drawMesh(u, MESH.wheel, wm); } gl.uniform1f(u.u_fill, 0);
  if (GAME.drawCarLights) GAME.drawCarLights(u, carM);
  if (GAME.lightUniforms) GAME.lightUniforms(u, carM);
  for (const t of TRAFFIC) { if (Math.abs(t.x - cam.pos[0]) > 420 || Math.abs(t.z - cam.pos[2]) > 420) continue; drawMesh(u, MESH[t.mesh], M4.model(t.x, t.y, t.z, t.yaw, 0, 0, 1, 1, 1, _M), [1, 1, 1], 1 + t.brake * 0.9); }
  drawTrains(u);
  if (typeof drawTrafficLights === 'function') drawTrafficLights(u);
    for (const p of PEDS) {
    if (Math.hypot(p.x - cam.pos[0], p.z - cam.pos[2]) > 160) continue;
    const arch = (MESH.pedArchs && MESH.pedArchs[p.v % MESH.pedArchs.length]) || { body: MESH.peds[p.v % MESH.peds.length] };

    // Human bipedal locomotion & organic idle kinematics
    let bodyBob = 0, bodyRoll = 0, bodyYaw = 0, bodyPitch = 0;
    let headYaw = 0, headPitch = 0, headRoll = 0, jawPitch = 0;
    let hipPitchL = 0, kneePitchL = 0, hipPitchR = 0, kneePitchR = 0;
    let armPitchL = 0, armRollL = -0.12, armYawL = 0, elbowPitchL = 0.22;
    let armPitchR = 0, armRollR = 0.12, armYawR = 0, elbowPitchR = 0.22;

    if (p.moving) {
      const wp = p.walkPhase || (GAME.t * 8 + p.ph);
      // Human bipedal vertical displacement (step double-bounce)
      bodyBob = Math.abs(Math.sin(wp)) * 0.046;
      // Pelvis roll (weight shifting over stance leg)
      bodyRoll = Math.sin(wp) * 0.036;
      // Torso counter-twist: shoulders counter-rotate opposite to pelvis!
      bodyYaw = -Math.sin(wp) * 0.075;
      // Natural forward inclination
      bodyPitch = 0.045 + Math.sin(wp * 2.0) * 0.012;

      // Leg phases (alternating stride)
      const pL = ((wp % 6.283) + 6.283) % 6.283;
      const pR = (((wp + Math.PI) % 6.283) + 6.283) % 6.283;

      // Hip stride angles
      hipPitchL = Math.sin(pL) * 0.46;
      hipPitchR = Math.sin(pR) * 0.46;

      // Knee flexion during swing phase (knee flexes back to clear foot, straightens before heel strike)
      kneePitchL = pL > Math.PI ? -Math.sin(pL - Math.PI) * 0.85 : -Math.sin(pL) * 0.08;
      kneePitchR = pR > Math.PI ? -Math.sin(pR - Math.PI) * 0.85 : -Math.sin(pR) * 0.08;

      // Vestibulo-ocular head stabilization: head compensates for torso roll so gaze remains steady
      headRoll = -bodyRoll * 0.75;
      headPitch = -bodyPitch * 0.6 + Math.sin(wp * 0.5) * 0.02;
      // Natural glances to sides while walking
      headYaw = (Math.sin(wp * 0.2) > 0.65) ? Math.sin(wp * 0.5) * 0.24 : 0;
      jawPitch = 0;

      // Arm counter-swing with natural resting elbow flexion
      if (p.v === 3) { // Modern youth checking glowing phone while walking
        armPitchL = -0.42; armRollL = -0.16; armYawL = 0.18; elbowPitchL = 1.38;
        armPitchR = Math.sin(pL) * 0.36; armRollR = 0.12; elbowPitchR = 0.28 + Math.max(0, Math.sin(pL)) * 0.25;
        headPitch = 0.20; // Looking down at phone screen
      } else if (p.v === 4) { // Tech professional with tablet
        armPitchL = -0.16; armRollL = -0.12; elbowPitchL = 0.45;
        armPitchR = Math.sin(pL) * 0.36; armRollR = 0.12; elbowPitchR = 0.28 + Math.max(0, Math.sin(pL)) * 0.25;
      } else {
        armPitchL = -Math.sin(pL) * 0.36; armRollL = -0.12; elbowPitchL = 0.26 + Math.max(0, -Math.sin(pL)) * 0.30;
        armPitchR = Math.sin(pL) * 0.36; armRollR = 0.12; elbowPitchR = 0.26 + Math.max(0, Math.sin(pL)) * 0.30;
      }
    } else if (p.role === 'talking') {
      const tp = p.talkPhase || (GAME.t * 2 + p.ph);
      // Human contrapposto stance (weight anchored on one leg, relaxed on other)
      hipPitchL = -0.02; kneePitchL = -0.04;
      hipPitchR = 0.08; kneePitchR = -0.18;
      const breathe = Math.sin(GAME.t * 2.0 + p.ph) * 0.012;
      bodyBob = breathe;
      bodyRoll = Math.sin(tp * 0.6) * 0.028;

      if (p.isTalking) {
        // ACTIVE SPEAKER: Dynamic conversational gestures, animated jaw, emphatic nods
        bodyPitch = 0.05 + Math.sin(tp * 2.2) * 0.04;
        // Two-handed natural human gesture:
        armPitchR = -0.62 + Math.cos(tp * 2.8) * 0.22;
        armRollR = 0.26 + Math.sin(tp * 2.2) * 0.16;
        armYawR = Math.sin(tp * 1.8) * 0.18;
        elbowPitchR = 0.95 + Math.cos(tp * 2.5) * 0.24;

        armPitchL = -0.32 + Math.sin(tp * 1.6) * 0.14;
        armRollL = -0.18 + Math.cos(tp * 1.8) * 0.10;
        elbowPitchL = 0.72 + Math.sin(tp * 2.0) * 0.18;

        // Head nodding & expressive tilting on speech syllables
        headPitch = -0.03 + Math.sin(tp * 4.5) * 0.065 + Math.sin(tp * 1.8) * 0.04;
        headRoll = Math.sin(tp * 2.2) * 0.085;
        headYaw = Math.sin(tp * 1.2) * 0.08;

        // Animated speaking mouth opening and closing with speech cadence!
        jawPitch = Math.max(0, (Math.sin(tp * 14.0) * 0.09 + Math.sin(tp * 22.0) * 0.05) * (0.8 + 0.4 * Math.sin(tp * 3.5)));
      } else {
        // ATTENTIVE LISTENER: Natural nodding, Indian head bobble, relaxed posture
        bodyPitch = 0.02 + Math.max(0, Math.sin(tp * 1.4)) * 0.03;
        armPitchL = -0.28; armRollL = -0.12; armYawL = 0.15; elbowPitchL = 0.65;
        armPitchR = -0.28; armRollR = 0.12; armYawR = -0.15; elbowPitchR = 0.65;

        // Polite, listening head nods and culturally authentic Indian head bobble
        headPitch = Math.max(0, Math.sin(tp * 1.8)) * 0.08;
        headRoll = Math.sin(tp * 2.4) * 0.075;
        headYaw = Math.sin(tp * 0.8) * 0.05;
        jawPitch = 0; // Mouth naturally closed while listening
      }
    } else if (p.role === 'working') {
      const wp = p.workPhase || (GAME.t * 2 + p.ph);
      hipPitchL = -0.02; kneePitchL = -0.06;
      hipPitchR = 0.06; kneePitchR = -0.14;
      headPitch = 0.12; // Looking down at work
      if (p.v === 2) { // Chai-Wallah pouring chai from brass kettle & waving
        const wc = wp % 7.5;
        if (wc < 4.0) { // Pouring tea into cutting glasses
          bodyPitch = 0.10 + Math.sin(wp * 2.5) * 0.03;
          armPitchR = -0.65 + Math.sin(wp * 3.2) * 0.10; armRollR = 0.12; elbowPitchR = 1.05;
          armPitchL = -0.52; armRollL = -0.18; elbowPitchL = 0.95;
          headPitch = 0.18;
        } else if (wc < 5.5) { // Resetting kettle
          bodyPitch = 0.03;
          armPitchR = -0.25; elbowPitchR = 0.50;
          armPitchL = -0.35; elbowPitchL = 0.65;
          headPitch = 0.05;
        } else { // Waving invitingly to crowd
          bodyPitch = -0.02;
          armPitchR = -1.25 + Math.sin(wp * 6.5) * 0.25; armRollR = 0.32; elbowPitchR = 0.70;
          armPitchL = -0.35; elbowPitchL = 0.50;
          headPitch = -0.08; headYaw = Math.sin(wp * 2) * 0.15;
          jawPitch = 0.05;
        }
      } else if (p.v === 5) { // Merchant sorting spice crate
        bodyPitch = 0.18 + Math.sin(wp * 1.8) * 0.08;
        armPitchL = -0.42 + Math.sin(wp * 2) * 0.12; elbowPitchL = 0.85;
        armPitchR = -0.42 - Math.sin(wp * 2) * 0.12; elbowPitchR = 0.85;
        headPitch = 0.22;
      } else {
        bodyPitch = 0.04 + Math.sin(wp * 1.5) * 0.03;
      }
    } else { // 'phone' or standing idle
      const tp = p.talkPhase || (GAME.t * 1.5 + p.ph);
      hipPitchL = -0.02; kneePitchL = -0.04;
      hipPitchR = 0.06; kneePitchR = -0.16;
      armPitchL = -0.38; armRollL = -0.15; armYawL = 0.18; elbowPitchL = 1.38;
      armPitchR = -0.10; armRollR = 0.10; elbowPitchR = 0.22;
      bodyPitch = (Math.sin(tp * 0.5) > 0.75) ? -0.02 : 0.16;
      headPitch = (Math.sin(tp * 0.5) > 0.75) ? 0.02 : 0.24; // Looking down at phone
      bodyBob = Math.sin(GAME.t * 2.0 + p.ph) * 0.012;
    }

    // Reaction to nearby speeding car / horn
    if (p.alert > 0.15) {
      const angToCar = Math.atan2(-(c.x - p.x), -(c.z - p.z));
      headYaw = angDiff(p.yaw, angToCar) * 0.85;
      headPitch = -0.12;
      jawPitch = 0.10;
    }

    // Body root
    const bodyM = M4.model(p.x, bodyBob, p.z, p.yaw + bodyYaw, bodyPitch, bodyRoll);
    drawMesh(u, arch.body, bodyM);

    // Decoupled head & animated talking jaw articulation
    if (arch.head) {
      const M_head = M4.mul(bodyM, M4.model(0, 1.34, 0, headYaw, headPitch, headRoll));
      drawMesh(u, arch.head, M_head);
      if (arch.jaw) {
        const M_jaw = M4.mul(M_head, M4.model(0, 0.085, 0.025, 0, jawPitch, 0));
        drawMesh(u, arch.jaw, M_jaw);
      }
    }

    // Animated 3D speech bubble above active speakers
    if (p.role === 'talking' && p.isTalking && MESH.speechBubble) {
      const bubbleY = 2.02 + Math.sin(GAME.t * 3.5 + p.ph) * 0.035;
      const camYaw = Math.atan2(cam.pos[0] - p.x, cam.pos[2] - p.z);
      drawMesh(u, MESH.speechBubble, M4.model(p.x, bubbleY, p.z, camYaw, 0, 0, 1, 1, 1), [1, 1, 1], 1.25);
    }

    // Two-joint leg articulation (Hip & Knee)
    if (arch.thigh && arch.shin) {
      const M_thighL = M4.mul(bodyM, M4.model(-0.11, 0.80, 0, 0, hipPitchL, 0));
      drawMesh(u, arch.thigh, M_thighL);
      const M_shinL = M4.mul(M_thighL, M4.model(0, -0.38, 0, 0, kneePitchL, 0));
      drawMesh(u, arch.shin, M_shinL);

      const M_thighR = M4.mul(bodyM, M4.model(0.11, 0.80, 0, 0, hipPitchR, 0));
      drawMesh(u, arch.thigh, M_thighR);
      const M_shinR = M4.mul(M_thighR, M4.model(0, -0.38, 0, 0, kneePitchR, 0));
      drawMesh(u, arch.shin, M_shinR);
    }

    // Two-joint arm articulation (Shoulder & Elbow)
    if (arch.armUpL && arch.armLowL) {
      const M_armUpL = M4.mul(bodyM, M4.model(-0.22, 1.34, 0, armYawL, armPitchL, armRollL));
      drawMesh(u, arch.armUpL, M_armUpL);
      const M_armLowL = M4.mul(M_armUpL, M4.model(0, -0.28, 0, 0, elbowPitchL, 0));
      drawMesh(u, arch.armLowL, M_armLowL);
    }
    if (arch.armUpR && arch.armLowR) {
      const M_armUpR = M4.mul(bodyM, M4.model(0.22, 1.34, 0, armYawR, armPitchR, armRollR));
      drawMesh(u, arch.armUpR, M_armUpR);
      const M_armLowR = M4.mul(M_armUpR, M4.model(0, -0.28, 0, 0, elbowPitchR, 0));
      drawMesh(u, arch.armLowR, M_armLowR);
    }
  }
  for (const b of W.boats) {
    const yaw = b.sp > 0 ? -Math.PI / 2 : Math.PI / 2;
    const boatY = W.waterY + Math.sin(GAME.t * 2.4 + b.x * 0.08) * 0.10;
    drawMesh(u, MESH.boat, M4.model(b.x, boatY, b.z, yaw, b.pitch || 0, b.roll || 0));
  }

  // MYTHICAL WATER SERPENT (LEVIATHAN - ORTHOGRAPHIC REFERENCE) SWIMMING IN RIVER
  if (SERPENT && MESH.serpentHead && MESH.serpentBody && MESH.serpentTail) {
    const dirSign = SERPENT.dir > 0 ? 1 : -1;
    const baseYaw = SERPENT.baseYaw || (SERPENT.dir > 0 ? -Math.PI / 2 : Math.PI / 2);

    // Compute continuous wave chain for head and all articulated segments
    for (let i = 0; i <= SERPENT.segs; i++) {
      const segT = i / SERPENT.segs;
      // Distance along spine from head
      const sDist = i * 2.85;
      const sx = SERPENT.x - dirSign * sDist;

      // Anguilliform lateral S-curve (amplitude smoothly increases towards the paddle tail)
      const latAmp = lerp(6.5, 14.5, segT);
      const latPhase = SERPENT.phase - i * 0.44;
      const sz = Math.sin(latPhase) * latAmp;

      // Tangent yaw: derivative of lateral sine wave d(sz)/ds ensures segments follow the swimming curve
      const latDeriv = Math.cos(latPhase) * (-0.44) * latAmp / 2.85;
      const segYaw = baseYaw + Math.atan(latDeriv * dirSign) * 0.90;

      // Vertical undulating crests (surfacing & diving): multi-harmonic wave
      const vertPhase = SERPENT.phase * 1.15 - i * 0.40;
      const sy = W.waterY + 0.85 + Math.sin(vertPhase) * 1.55;
      const vertDeriv = Math.cos(vertPhase) * 0.42;
      const segPitch = vertDeriv * 0.48;

      // Natural hydrodynamic roll banking into the curve
      const segRoll = -Math.sin(latPhase) * 0.32 * dirSign;

      const segScale = i === 0 ? 1.85 : (i === SERPENT.segs ? 1.65 : lerp(1.75, 1.05, segT));
      const segM = M4.model(sx, sy, sz, segYaw, segPitch, segRoll, segScale, segScale, segScale);

      if (i === 0) {
        // Hydrodynamic Head with glowing eyes, crown horns & gills
        drawMesh(u, MESH.serpentHead, segM, [1, 1, 1], 1.35);

        // Water serpent spraying powerful high-pressure water fountain from its mouth
        const sMouthPos = M4.xf(segM, [0, 0.05, -2.2]);
        const sFwdPt = M4.xf(segM, [0, 0.05, -4.5]);
        const sFwdDir = V3.norm(V3.sub(sFwdPt, sMouthPos));
        SERPENT.sprayT = (SERPENT.sprayT || 0) + 0.016;
        const sprayCycle = SERPENT.sprayT % 4.5;
        const isSpraying = sprayCycle < 3.2; // 3.2s continuous water cannon spray, 1.3s pause
        if (isSpraying && FX && FX.alpha) {
          const sInt = Math.sin((sprayCycle / 3.2) * Math.PI);
          for (let k = 0; k < 3; k++) {
            const spraySpeed = 22 + Math.random() * 12 * sInt;
            const vx = sFwdDir[0] * spraySpeed + (Math.random() - 0.5) * 3.5;
            const vy = sFwdDir[1] * spraySpeed + 9.5 + Math.random() * 5.0 * sInt;
            const vz = sFwdDir[2] * spraySpeed + (Math.random() - 0.5) * 3.5;

            // White water spray foam & churning drops
            FX.alpha.emit({
              pos: [sMouthPos[0] + (Math.random() - 0.5) * 0.8, sMouthPos[1] + (Math.random() - 0.5) * 0.6, sMouthPos[2] + (Math.random() - 0.5) * 0.8],
              vel: [vx, vy, vz],
              life: 1.8 + Math.random() * 0.5,
              size: 0.75,
              grow: 3.2,
              drag: 1.04,
              g: 11.5,
              col: [0.90, 0.96, 1.0, 0.75 * sInt]
            });

            // Bioluminescent water droplets & river spray highlights
            if (FX.add && Math.random() < 0.65) {
              FX.add.emit({
                pos: [sMouthPos[0] + (Math.random() - 0.5) * 0.8, sMouthPos[1], sMouthPos[2] + (Math.random() - 0.5) * 0.8],
                vel: [vx * 0.95, vy * 0.95, vz * 0.95],
                life: 1.5 + Math.random() * 0.4,
                size: 0.55,
                grow: 1.4,
                drag: 1.05,
                g: 11.5,
                col: [0.35, 0.92, 1.0, 0.85 * sInt]
              });
            }
          }
        }

        // Water wake & spray when head breaches surface
        if (sy > W.waterY + 1.0 && FX && FX.alpha && Math.random() < 0.50) {
          FX.alpha.emit({
            pos: [sx + (Math.random() - 0.5) * 2.5, W.waterY + 0.2, sz + (Math.random() - 0.5) * 2.5],
            vel: [(Math.random() - 0.5) * 4.5, 2.8 + Math.random() * 2.5, (Math.random() - 0.5) * 4.5],
            life: 0.90, size: 1.05, grow: 2.4, drag: 1.4,
            col: [0.92, 0.98, 1.0, 0.65]
          });
        }
        // Continuous V-shaped white water bow wake
        if (FX && FX.alpha && Math.random() < 0.70) {
          const bowSign = (Math.random() > 0.5 ? 1 : -1);
          const bowOff = bowSign * (1.2 + Math.random() * 2.8);
          FX.alpha.emit({
            pos: [sx - dirSign * 1.6, W.waterY + 0.08, sz + bowOff],
            vel: [-dirSign * 0.9, 0.14, bowOff * 0.55],
            life: 1.45, size: 1.8, grow: 3.4, drag: 1.15,
            col: [0.94, 0.98, 1.0, 0.48]
          });
        }
        // Glowing aquatic bioluminescent bubbles
        if (FX && FX.add && Math.random() < 0.38) {
          FX.add.emit({
            pos: [sx + (Math.random() - 0.5) * 1.8, Math.min(sy, W.waterY) + 0.1, sz + (Math.random() - 0.5) * 1.8],
            vel: [(Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 1.0, (Math.random() - 0.5) * 1.5],
            life: 0.80, size: 0.70, grow: 0.85, drag: 1.05,
            col: [0.15, 0.88, 1.0, 0.88]
          });
        }
      } else if (i === SERPENT.segs) {
        // Paddle-like caudal fluke fin
        drawMesh(u, MESH.serpentTail, segM, [1, 1, 1], 1.25);

        // Caudal fin water wake trail
        if (FX && FX.alpha && Math.random() < 0.55) {
          FX.alpha.emit({
            pos: [sx + (Math.random() - 0.5) * 3.0, W.waterY + 0.1, sz + (Math.random() - 0.5) * 3.0],
            vel: [(Math.random() - 0.5) * 2.6, 0.85, (Math.random() - 0.5) * 2.6],
            life: 1.2, size: 1.5, grow: 3.0, drag: 1.2,
            col: [0.88, 0.96, 1.0, 0.48]
          });
        }
      } else {
        // Body segment with spinous dorsal fin & bioluminescent photophores
        const isChest = (i === 1 || i === 2);
        drawMesh(u, MESH.serpentBody, segM, [1, 1, 1], 1.20);

        // Body wave foam trail on the crest of each arched segment breaching surface
        if (sy > W.waterY && FX && FX.alpha && Math.random() < 0.30) {
          FX.alpha.emit({
            pos: [sx + (Math.random() - 0.5) * 1.6, W.waterY + 0.08, sz + (Math.random() - 0.5) * 1.6],
            vel: [(Math.random() - 0.5) * 1.2, 0.16, (Math.random() - 0.5) * 1.2],
            life: 1.0, size: 1.3, grow: 2.6, drag: 1.2,
            col: [0.92, 0.96, 1.0, 0.42]
          });
        }

        // "TRANSFUSED WEBBING FOR SWIMMING": Pectoral flipper fins on chest segment
        if (isChest && MESH.serpentFlipperL && MESH.serpentFlipperR) {
          const flipperFlap = Math.sin(SERPENT.phase * 1.15 + (i === 1 ? 0 : -0.4)) * 0.48;
          const flipperPitch = Math.cos(SERPENT.phase * 1.15 + (i === 1 ? 0 : -0.4)) * 0.22;
          const ML = M4.mul(segM, M4.model(-0.65, -0.12, 0, 0, flipperPitch, flipperFlap));
          drawMesh(u, MESH.serpentFlipperL, ML, [1, 1, 1], 1.20);
          const MR = M4.mul(segM, M4.model(0.65, -0.12, 0, 0, -flipperPitch, -flipperFlap));
          drawMesh(u, MESH.serpentFlipperR, MR, [1, 1, 1], 1.20);
        }
      }
    }
  }

  // TRANSLUCENT CRYSTAL-CLEAR RIVER WATER (optically clear surface blending over riverbed and swimming serpent)
  if (MESH.water) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawMesh(u, MESH.water, IDENT);
    gl.disable(gl.BLEND);
  }

  // 4 MAJESTIC FLYING SKY DRAGONS WITH ARTICULATED HEAD, TAIL & SMOOTH GAPLESS WINGS
  for (const d of DRAGONS) {
    const meshBody = MESH[d.bodyMesh] || MESH[d.mesh] || MESH.dragon;
    const meshHead = MESH[d.headMesh] || MESH.dragon_head;
    const meshTail1 = MESH[d.tail1Mesh] || MESH.dragon_tail1;
    const meshTail2 = MESH[d.tail2Mesh] || MESH.dragon_tail2;
    const meshWingL = MESH[d.wingL] || MESH.dragonWingL;
    const meshWingR = MESH[d.wingR] || MESH.dragonWingR;
    if (!meshBody) continue;

    const dragonM = M4.model(d.x, d.y, d.z, d.yaw, d.pitch, d.roll, d.scale, d.scale, d.scale);

    // 1. Torso & body with muscular shoulder sockets
    drawMesh(u, meshBody, dragonM, [1, 1, 1], 1.32);

    // 2. Articulated Head & S-curved Neck
    if (meshHead) {
      const MHead = M4.mul(dragonM, M4.model(0, 0.28, -1.8, d.headYaw || 0, d.headPitch || 0, d.headRoll || 0));
      drawMesh(u, meshHead, MHead, [1, 1, 1], 1.32);
    }

    // 3. Articulated Serpentine Tail Segments
    if (meshTail1) {
      const MTail1 = M4.mul(dragonM, M4.model(0, 0.08, 1.9, d.tailYaw1 || 0, d.tailPitch1 || 0, 0));
      drawMesh(u, meshTail1, MTail1, [1, 1, 1], 1.30);
      if (meshTail2) {
        const MTail2 = M4.mul(MTail1, M4.model(0, 0, 2.8, d.tailYaw2 || 0, d.tailPitch2 || 0, 0));
        drawMesh(u, meshTail2, MTail2, [1, 1, 1], 1.30);
      }
    }

    // 4. Smooth, gapless, smaller majestic wings
    if (meshWingL && meshWingR) {
      const sFlap = d.smoothFlap || 0;
      const sPitch = d.smoothPitch || 0;
      const sSweep = d.smoothSweep || 0;

      const ML = M4.mul(dragonM, M4.model(-0.60, 0.35, 0.0, -sSweep, sPitch, sFlap));
      drawMesh(u, meshWingL, ML, [1, 1, 1], 1.25);
      const MR = M4.mul(dragonM, M4.model(0.60, 0.35, 0.0, sSweep, -sPitch, -sFlap));
      drawMesh(u, meshWingR, MR, [1, 1, 1], 1.25);
    }
  }

  // FLOCKS OF REAL SOARING BIRDS FLYING EVERYWHERE WITH ARTICULATED WING FLAPPING
  for (const b of BIRDS) {
    const sp = b.flock || 'gull';
    const meshBody = MESH['bird_' + sp] || MESH.bird_gull;
    const meshWingL = MESH['birdWingL_' + sp] || MESH.birdWingL_gull;
    const meshWingR = MESH['birdWingR_' + sp] || MESH.birdWingR_gull;
    if (!meshBody) continue;

    const isFlapping = Math.sin((b.flapCycle || 0) * (b.flapFreq || 1.8)) > (b.glideThresh || -0.15);
    const flapAngle = isFlapping ? Math.sin(b.flap) * 0.65 : 0.08;
    const sc = b.scale || 0.48;
    const birdM = M4.model(b.x, b.y, b.z, b.yaw, b.pitch || 0, (b.bank || -0.22) + flapAngle * 0.12, sc, sc, sc);
    drawMesh(u, meshBody, birdM, [1, 1, 1], 1.0);
    if (meshWingL && meshWingR) {
      const ML = M4.mul(birdM, M4.model(-0.04, 0.04, 0, -flapAngle * 0.15, flapAngle * 0.10, flapAngle));
      const MR = M4.mul(birdM, M4.model(0.04, 0.04, 0, flapAngle * 0.15, -flapAngle * 0.10, -flapAngle));
      drawMesh(u, meshWingL, ML, [1, 1, 1], 1.0);
      drawMesh(u, meshWingR, MR, [1, 1, 1], 1.0);
    }
  }
  const pinTarget = GAME.target;
  for (const lm of W.landmarks) { const vis = GAME.visited.has(lm.id); const col = vis ? [0.55, 0.95, 0.6] : hex('#3FD6C6'); const bob = Math.sin(GAME.t * 2 + lm.pin[0]) * 0.5; const sc = pinTarget === lm.id ? 1.25 : 1; drawMesh(u, MESH.pin, M4.model(lm.pin[0], lm.pin[1] + bob, lm.pin[2], GAME.t * 0.8, 0, 0, sc), col, 1); }
  // textured: signs, decals, board
  gl.useProgram(P.tex.p); const tu = P.tex.u; gl.uniformMatrix4fv(tu.u_vp, false, vp); gl.uniform3fv(tu.u_cam, eye); gl.uniform3fv(tu.u_fogCol, m.fogCol); gl.uniform2fv(tu.u_fog, m.fog); gl.uniform1f(tu.u_time, GAME.t); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(tu.u_tex, 0);
  gl.bindVertexArray(QUAD.vao); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const emisK = lerp(0.85, 1.25, m.night);
  for (const s of W.signs) { drawQuad(tu, s.tex, M4.model(s.x, s.y, s.z, s.yaw, 0, 0, s.w, s.h, 1, _M), s.emis * emisK); if (s.both) drawQuad(tu, s.tex, M4.model(s.x - Math.sin(s.yaw) * 0.06, s.y, s.z - Math.cos(s.yaw) * 0.06, s.yaw + Math.PI, 0, 0, s.w, s.h, 1), s.emis * emisK); }
  const rl = W.landmarks.find(l => l.id === 'resume'); drawQuad(tu, TEX.board, M4.model(rl.board.x, rl.board.y, rl.board.z, 0, 0, 0, rl.board.w, rl.board.h, 1), 1.25);
  drawQuad(tu, TEX.plate, M4.mul(carM, M4.model(0, 0.46, 2.345, 0, 0, 0, 0.46, 0.115, 1)), 0.9);
  for (const s of [-1, 1]) drawQuad(tu, TEX.decal, M4.mul(carM, M4.model(s * VAJRA_DECAL.x, VAJRA_DECAL.y, VAJRA_DECAL.z, s * Math.PI / 2, 0, 0, 0.8, 0.15, 1)), 1.0);
  // labels (camera-facing)
  gl.depthMask(false);
  for (const lm of W.landmarks) { const d = Math.hypot(lm.pin[0] - cam.pos[0], lm.pin[2] - cam.pos[2]); const a = smooth(420, 160, d); if (a < 0.02) continue; const yaw = Math.atan2(cam.pos[0] - lm.pin[0], cam.pos[2] - lm.pin[2]); const s = clamp(d / 16, 4, 26); drawQuad(tu, TEX.labels[lm.id], M4.model(lm.pin[0], lm.pin[1] + 4.2 + s * 0.12, lm.pin[2], yaw, 0, 0, s * 1.6, s * 0.4, 1), 1.1, a); }
  // holograms (perfectly aligned with Z-buffer write and dual-side tech chassis)
  gl.depthMask(true);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const sortedHolos = W.holos.slice().sort((a, b) => {
    const da = Math.hypot(a.x - eye[0], a.z - eye[2]);
    const db = Math.hypot(b.x - eye[0], b.z - eye[2]);
    return db - da; // draw furthest first, closest last
  });
  for (const hg of sortedHolos) {
    const nx = Math.sin(hg.yaw), nz = Math.cos(hg.yaw);
    const vx = eye[0] - hg.x, vz = eye[2] - hg.z;
    const dot = nx * vx + nz * vz;
    if (dot >= 0) {
      drawQuad(tu, TEX.holos[hg.i], M4.model(hg.x, 8.8, hg.z, hg.yaw, 0, 0, 7.4, 14.8, 1), 1.0, 1.0, 2);
    } else {
      drawQuad(tu, TEX.holoBack, M4.model(hg.x, 8.8, hg.z, hg.yaw + Math.PI, 0, 0, 7.4, 14.8, 1), 1.0, 1.0, 2);
    }
  }
  // flat FX
  gl.useProgram(P.flat.p); const fu = P.flat.u; gl.uniformMatrix4fv(fu.u_vp, false, vp); gl.uniform3fv(fu.u_cam, eye); gl.uniform3fv(fu.u_fogCol, m.fogCol); gl.uniform2fv(fu.u_fog, m.fog);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  drawFlat(fu, MESH.shadow, M4.model(cv_.x, 0.075, cv_.z, cv_.yaw), [1, 1, 1, lerp(0.75, 0.55, m.night)]);
  for (const t of TRAFFIC) if (t.y < 1 && Math.hypot(t.x - cam.pos[0], t.z - cam.pos[2]) < 150) drawFlat(fu, MESH.shadow, M4.model(t.x, 0.07, t.z, t.yaw, 0, 0, t.wid / 2.1, 1, t.len / 4.6, _M), [1, 1, 1, 0.5]);
  if (MESH.marksDirty) { uploadDyn(MESH.marks, MESH.marksBuf, MESH.marksN * 6); MESH.marksDirty = false; }
  if (MESH.marksN) drawFlat(fu, MESH.marks, M4.ident(), [1, 1, 1, 1], MESH.marksN * 6);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  const nw = m.night; if (nw > 0.05) drawFlat(fu, MESH.glow, M4.model(cv_.x, 0.08, cv_.z, cv_.yaw), [1, 1, 1, nw * 0.9]);
  // trigger rings
  for (const lm of W.landmarks) {
    const isCases = lm.id === 'cases';
    lm.trig.forEach((t, i) => {
      const near = GAME.nearLm && GAME.nearLm.lm === lm && GAME.nearLm.i === i;
      const pulse = 0.55 + 0.25 * Math.sin(GAME.t * 3.2 + i * 1.5) + (near ? 0.35 : 0);
      const cs = isCases ? PORTFOLIO.caseStudies[i] : null;
      const col = cs && cs.accent ? hex(cs.accent) : hex(lm.color);
      const sc = isCases ? (near ? 0.58 : 0.52) : (near ? 1.04 : 1.0);
      drawFlat(fu, MESH.ring, M4.model(t[0], 0.1, t[1], 0, 0, 0, sc), [col[0] * 1.25, col[1] * 1.25, col[2] * 1.25, pulse]);
    });
  }
  if (GAME.drawBeams) GAME.drawBeams(fu, carM);
  // trails (underglow in neon, light streaks when boosting)
  const tb = MESH.trailBuf; let tn = 0;
  if (TRAIL.length > 3) { const streams = []; if (nw > 0.2 && c.speed > 4) for (const [ox, oz] of [[-0.92, -1.45], [0.92, -1.45], [-0.92, 1.35], [0.92, 1.35]]) streams.push({ ox, oz, y: 0.1, w: 0.045, col: [0.37, 0.95, 0.96], a: nw * 0.7, key: 's', maxD: 7 });
    if (c.boosting || TRAIL.some(p => p.b)) for (const ox of [-0.13, 0.13]) streams.push({ ox, oz: 2.4, y: 0.36, w: 0.05, col: [1, 0.8, 0.6], a: 0.8, key: 'b', maxD: 9 });
    for (const S of streams) { for (let i = 0; i < TRAIL.length - 1; i++) { const A = TRAIL[i], B = TRAIL[i + 1]; if (S.key === 'b' && !(A.b && B.b)) continue; if (Math.hypot(B.x - c.x, B.z - c.z) > S.maxD) break; const pa = [A.x + Math.cos(A.yaw) * S.ox + Math.sin(A.yaw) * S.oz, A.z - Math.sin(A.yaw) * S.ox + Math.cos(A.yaw) * S.oz], pb = [B.x + Math.cos(B.yaw) * S.ox + Math.sin(B.yaw) * S.oz, B.z - Math.sin(B.yaw) * S.ox + Math.cos(B.yaw) * S.oz]; const aa = S.a * (1 - i / TRAIL.length), ab = S.a * (1 - (i + 1) / TRAIL.length);
        const q = [[pa[0], S.y - S.w, pa[1], aa], [pa[0], S.y + S.w, pa[1], aa], [pb[0], S.y + S.w, pb[1], ab], [pb[0], S.y - S.w, pb[1], ab]]; if (tn + 6 > tb.length / 7) break; for (const j of [0, 1, 2, 0, 2, 3]) { tb[tn * 7] = q[j][0]; tb[tn * 7 + 1] = q[j][1]; tb[tn * 7 + 2] = q[j][2]; tb[tn * 7 + 3] = S.col[0]; tb[tn * 7 + 4] = S.col[1]; tb[tn * 7 + 5] = S.col[2]; tb[tn * 7 + 6] = q[j][3]; tn++; } } } }
  if (tn) { uploadDyn(MESH.trail, tb, tn); drawFlat(fu, MESH.trail, M4.ident(), [1, 1, 1, 1], tn); }
  // GPS chevrons
  if (GAME.route.length > 1 && GAME.phase === 'driving') { const gb = MESH.gpsBuf; let gn = 0, acc = 0; const col = hex('#4FC3F7');
    const RT_ = GAME.route.slice(); RT_[0] = [c.x, c.z]; const cfx = -Math.sin(c.yaw), cfz = -Math.cos(c.yaw);
    outer: for (let i = 0; i < RT_.length - 1; i++) { const a = RT_[i], b = RT_[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.1) continue; const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L; for (let s = (i === 0 ? 10 : (6 - acc % 6)); s < L; s += 6) { if (gn >= 40) break outer; const px = a[0] + dx * s, pz = a[1] + dz * s; if ((px - c.x) * cfx + (pz - c.z) * cfz < 3.5 && Math.hypot(px - c.x, pz - c.z) < 9) continue; const k = (Math.sin(GAME.t * 4 - gn * 0.6) * 0.5 + 0.5) * 0.5 + 0.35; const lx = -dz, lz = dx; const tip = [px + dx * 0.9, pz + dz * 0.9]; const verts = [[px - lx * 0.9 - dx * 0.3, pz - lz * 0.9 - dz * 0.3], tip, [px - dx * 0.05, pz - dz * 0.05], [px + lx * 0.9 - dx * 0.3, pz + lz * 0.9 - dz * 0.3], tip, [px - dx * 0.05, pz - dz * 0.05]];
          for (let j = 0; j < 6; j++) { const v = verts[j]; const o = (gn * 9 + j) * 7; gb[o] = v[0]; gb[o + 1] = 0.12; gb[o + 2] = v[1]; gb[o + 3] = col[0]; gb[o + 4] = col[1]; gb[o + 5] = col[2]; gb[o + 6] = k; } gn++; } acc += L; }
    if (gn) { uploadDyn(MESH.gps, gb, gn * 9); drawFlat(fu, MESH.gps, M4.ident(), [1.3, 1.3, 1.3, 1], gn * 6); } }
  // particles
  gl.useProgram(P.part.p); const pu = P.part.u; gl.uniformMatrix4fv(pu.u_vp, false, vp); gl.uniform3fv(pu.u_cam, eye); gl.uniform3fv(pu.u_fogCol, m.fogCol); gl.uniform2fv(pu.u_fog, m.fog);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); FX.alpha.build(R, U); gl.bindVertexArray(FX.alpha.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, FX.alpha.mesh.count);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); FX.add.build(R, U); gl.bindVertexArray(FX.add.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, FX.add.mesh.count);
  gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
  // post
  if (useRT) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, RT.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, RT.scene.fbo); gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.A.fbo); gl.viewport(0, 0, RT.A.w, RT.A.h); gl.useProgram(P.bright.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.scene.tex); gl.uniform1i(P.bright.u.u_tex, 0); gl.uniform1f(P.bright.u.u_th, 0.8); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(P.blur.p); gl.uniform1i(P.blur.u.u_tex, 0);
    for (let i = 0; i < 2; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, RT.B.fbo); gl.bindTexture(gl.TEXTURE_2D, RT.A.tex); gl.uniform2f(P.blur.u.u_dir, (1 + i) / RT.A.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindFramebuffer(gl.FRAMEBUFFER, RT.A.fbo); gl.bindTexture(gl.TEXTURE_2D, RT.B.tex); gl.uniform2f(P.blur.u.u_dir, 0, (1 + i) / RT.A.h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.useProgram(P.comp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.scene.tex); gl.uniform1i(P.comp.u.u_scene, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.A.tex); gl.uniform1i(P.comp.u.u_bloom, 1);
    const blur = GAME.reduced ? 0 : clamp((c.speed - 22) / 25, 0, 1) * (c.boosting ? 1.4 : 0.8);
    gl.uniform1f(P.comp.u.u_bloomAmt, m.bloom * 1.15); gl.uniform1f(P.comp.u.u_blur, blur); gl.uniform1f(P.comp.u.u_vig, 0.55); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0); gl.enable(gl.DEPTH_TEST);
  }
}

// ---------- mood ----------
function updateMood(dt) {
  // Use real-world local system time (new Date) to drive day, afternoon, evening, and night:
  const now = new Date();
  const sysHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  // Celestial solar angle based on 24-hour system time:
  // 06:00 is sunrise (angle = 0), 12:00 is solar noon (angle = π/2), 18:00 is sunset (angle = π), 00:00 is midnight (angle = 3π/2)
  const solarAngle = ((sysHours - 6.0) / 24.0) * Math.PI * 2.0;

  // Sun 3D direction vector
  const sunX = -Math.cos(solarAngle) * 0.85;
  const sunY = Math.sin(solarAngle);
  const sunZ = Math.sin(solarAngle * 0.5 + 0.8) * 0.35 + 0.20;
  const dynSunDir = V3.norm([sunX, sunY, sunZ]);

  // Moon 3D direction vector (orbits opposite to the sun with orbital inclination)
  const moonSolarAngle = solarAngle + Math.PI;
  const moonX = -Math.cos(moonSolarAngle) * 0.85;
  const moonY = Math.sin(moonSolarAngle) * 0.90 + 0.12;
  const moonZ = -Math.sin(solarAngle * 0.5 + 0.8) * 0.35 - 0.20;
  const dynMoonDir = V3.norm([moonX, moonY, moonZ]);

  let target;
  if (GAME.tod === 'auto') {
    // Strictly auto-update according to system time NOT according to player location / places!
    if (sysHours >= 11.5 && sysHours < 16.5) {
      // 11:30 - 16:30: Afternoon (bright sun high in the sky)
      target = moodVec(MOODS.midday);
    } else if (sysHours >= 7.0 && sysHours < 11.5) {
      // 07:00 - 11:30: Morning / Day
      const t = (sysHours - 7.0) / 4.5;
      target = mixMood(moodVec(MOODS.golden), moodVec(MOODS.midday), t * 0.75 + 0.25);
    } else if (sysHours >= 16.5 && sysHours < 19.25) {
      // 16:30 - 19:15: Late Afternoon / Golden Sunset
      const t = (sysHours - 16.5) / 2.75;
      target = mixMood(moodVec(MOODS.midday), moodVec(MOODS.golden), t);
    } else if (sysHours >= 19.25 && sysHours < 20.75) {
      // 19:15 - 20:45: Twilight / Dusk
      const t = (sysHours - 19.25) / 1.5;
      target = mixMood(moodVec(MOODS.golden), moodVec(MOODS.neon), t);
    } else if (sysHours >= 5.5 && sysHours < 7.0) {
      // 05:30 - 07:00: Dawn / Sunrise
      const t = (sysHours - 5.5) / 1.5;
      target = mixMood(moodVec(MOODS.neon), moodVec(MOODS.golden), t);
    } else {
      // 20:45 - 05:30: Night (moonlit starry night sky with glowing moon)
      target = moodVec(MOODS.neon);
    }
    GAME.neonW = clamp(-sunY * 2.0, 0, 1);
  } else {
    target = moodVec(MOODS[GAME.tod === 'night' ? 'neon' : GAME.tod]);
    GAME.neonW = GAME.tod === 'night' ? 1 : 0;
  }

  // Apply real-time moving celestial directions according to system time
  target.sunDir = dynSunDir;
  target.moonDir = dynMoonDir;
  target.moonCol = [0.88, 0.94, 1.0];
  target.moonSize = 0.0018;
  target.clouds = Math.max(target.clouds !== undefined ? target.clouds : 0.58, 0.55);

  // Softened sun glow & direct lighting when sun is below horizon
  if (dynSunDir[1] < -0.04) {
    target.sunCol = [0.22, 0.28, 0.44];
    target.sunGlow = [0.10, 0.15, 0.28];
    target.sunSize = 0.0;
  }

  GAME.mood = GAME.mood ? mixMood(GAME.mood, target, 1 - Math.exp(-3 * dt)) : target;
}

// ---------- main loop ----------
let lastT = 0;
let smoothDt = 0.0166;
function frame(ts) {
  if (GAME.paused) {
    lastT = 0;
    requestAnimationFrame(frame);
    return;
  }
  if (!lastT) {
    lastT = ts;
    requestAnimationFrame(frame);
    return;
  }
  const rawDt = (ts - lastT) / 1000;
  lastT = ts;
  const clampedDt = Math.min(0.045, Math.max(0.001, rawDt));
  smoothDt = smoothDt ? (smoothDt * 0.72 + clampedDt * 0.28) : clampedDt;
  const dt = smoothDt;

  GAME.t += dt;
  if (GAME.phase !== 'loading') { updateCar(dt); updateFX(dt); updateWorld(dt); updateCamera(dt); updateMood(dt); }
  render(); GAME.emit('frame', dt);
  requestAnimationFrame(frame);
}
function startLoop() { FX.alpha = FX.alpha || new Particles(3600, false); FX.add = FX.add || new Particles(3200, true); requestAnimationFrame(frame); }
GAME.endTour = function () { GAME.phase = 'intro'; CAMFX.tour = null; GAME.beginIntro(); GAME.emit('tourEnd'); };
GAME.beginIntro = function () {
  const c = GAME.car;
  Object.assign(c, { x: 0, z: 154, yaw: 0, vx: 0, vz: 0 });
  c.px_ = c.x; c.pz_ = c.z; c.pyaw_ = c.yaw;
  if (typeof PH !== 'undefined') PH.acc = 0;
  GAME.view = c;
  c.auto = GAME.reduced ? 0 : 3.6;
  CAMFX.orbit = { t: 0, len: GAME.reduced ? 0.01 : 4.5, from: -2.35, d0: 5.2, h0: 1.0 };
  GAME.cam.pos = [c.x - 4, 1.1, c.z - 4];
  GAME.cam.look = [c.x, 0.7, c.z];
  GAME.cam.off = null;
  GAME.cam.loff = null;
  GAME.phase = 'intro';
};
GAME.startTour = function () {
  GAME.phase = 'tour'; CAMFX.tour = { t: 0, len: 2.6, shots: [
    [[140, 70, -70], [175, 52, -140], [208, 18, -190], [208, 22, -196]],
    [[0, 4.2, -58], [0, 4.2, -140], [0, 5, -200], [0, 5, -230]],
    [[-120, 10, 26], [-138, 6, 12], [-170, -2, 0], [-170, -1, -6]],
    [[118, 4, 22], [118, 34, 12], [200, 45, 140], [200, 60, 150]]] };
  GAME.cam.pos = CAMFX.tour.shots[0][0].slice(); GAME.cam.look = CAMFX.tour.shots[0][2].slice();
};
GAME.enter = function () {
  if (GAME.phase !== 'driving' || !GAME.nearLm) return; const { lm, i } = GAME.nearLm; GAME.activeLm = { lm, i }; GAME.phase = 'entering'; startHero(lm, i);
};
GAME.exit = function () { if (GAME.phase !== 'panel' && GAME.phase !== 'entering') return; const cam = GAME.cam; CAMFX.hero = { t: 0, len: GAME.reduced ? 0.01 : 0.8, from: { pos: cam.pos.slice(), look: cam.look.slice() } }; GAME.phase = 'exiting'; };
GAME.teleport = function (x, z, yaw) {
  const c = GAME.car;
  Object.assign(c, { x, z, yaw, vx: 0, vz: 0, steer: 0 });
  c.px_ = c.x; c.pz_ = c.z; c.pyaw_ = c.yaw;
  if (typeof PH !== 'undefined') PH.acc = 0;
  GAME.view = c;
  GAME.cam.yawL = yaw;
  const f = [-Math.sin(yaw), -Math.cos(yaw)];
  GAME.cam.pos = [x - f[0] * 18, 26, z - f[1] * 18 + 0.01];
  GAME.cam.look = [x, 0.8, z];
  GAME.cam.off = null;
  GAME.cam.loff = null;
  TRAIL.length = 0;
  lastWheels = null;
};
GAME.setTarget = function (id) { GAME.target = id; GAME.refreshRoute(); };
GAME.refreshRoute = function () { if (!GAME.target) { GAME.route = []; return; } const lm = W.landmarks.find(l => l.id === GAME.target); const t = lm.trig.slice().sort((a, b) => Math.hypot(a[0] - GAME.car.x, a[1] - GAME.car.z) - Math.hypot(b[0] - GAME.car.x, b[1] - GAME.car.z))[0]; GAME.route = routeTo(t[0], t[1]); };
GAME.setQuality = function (q) { GAME.quality = q; resize(); };
// deterministic stepping (used by automated QA; harmless otherwise)
GAME.step = function (dt, n) { for (let i = 0; i < n; i++) { GAME.t += dt; updateCar(dt); updateFX(dt); updateWorld(dt); updateCamera(dt); updateMood(dt); } GAME.emit('frame', dt); };
// QA hook: advance the simulation without rendering
GAME.simulate = function (sec, dt = 1 / 30) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { GAME.t += dt; updateCar(dt); updateFX(dt); updateWorld(dt); updateCamera(dt); updateMood(dt); } };
GAME.stats = () => ({ staticVerts: statics.reduce((s, c) => s + c.count, 0), chunks: statics.length, signs: W.signs.length, boxes: W.boxes.length, traffic: TRAFFIC.length, peds: PEDS.length });
