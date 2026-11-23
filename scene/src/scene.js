// 3D-сцены VoteConnect на three.js: макет района с проектами бюджета и модель согласия групп.
// Собирается в assets/js/scene.bundle.js (npm run build) и даёт глобальный объект window.VC3D.
// Без сетевых запросов и eval — совместимо с политикой безопасности сайта (script-src 'self').

import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry,
  IcosahedronGeometry, PlaneGeometry, RingGeometry, MeshStandardMaterial, MeshBasicMaterial, HemisphereLight, DirectionalLight,
  Color, Vector3, PCFSoftShadowMap, ACESFilmicToneMapping, SRGBColorSpace, CanvasTexture, Sprite, SpriteMaterial,
  AdditiveBlending, MathUtils, RepeatWrapping
} from "three";

const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const prefersDark = () => {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
};

const easeOutBack = (p) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Цвета макета: существующее — белое, предложенное жителями — зелёное, как на макетах архитекторов.
const PAL = {
  plate: 0xdde2de, land: 0xedf0ec, road: 0xcdd3cf, line: 0xffffff, water: 0xb3cfd9, building: 0xfbfbfa,
  tree: 0xd3ddd6, trunk: 0xc9cfcb, proposed: 0x1f9d5c, proposedSoft: 0x9fd7b8, lamp: 0xffc65c, red: 0xff4d3d, green: 0x3ddc84
};

export function supported() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

/* ================= Общая сцена: рендер, камера, вращение мышью ================= */
function createStage(host, opts) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.className = "m3d-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", opts.label);
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(opts.fov || 30, 1, 0.5, 200);
  const rig = new Group();
  scene.add(rig);

  // Орбита камеры: угол поворота (yaw) и наклона (pitch)
  const orbit = { yaw: opts.yaw || 0.6, pitch: opts.pitch || 0.62, r: 30, target: new Vector3(0, opts.targetY || 0, 0) };
  const goal = { yaw: orbit.yaw, pitch: orbit.pitch };
  const baseYaw = orbit.yaw;
  let lastTouch = -1e9, dragging = false, px = 0, py = 0, moved = false;

  function placeCamera() {
    const { yaw, pitch, r, target } = orbit;
    camera.position.set(target.x + r * Math.cos(pitch) * Math.sin(yaw), target.y + r * Math.sin(pitch), target.z + r * Math.cos(pitch) * Math.cos(yaw));
    camera.lookAt(target);
  }

  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Подбираем расстояние так, чтобы макет помещался и по ширине, и по высоте
    const vfov = MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const fit = Math.min(vfov, hfov);
    const fs = typeof opts.fitScale === "function" ? opts.fitScale(w, h) : (opts.fitScale || 1);
    orbit.r = (opts.radius || 14) / Math.sin(fit / 2) * fs;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false; px = e.clientX; py = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    host.classList.add("m3d-grab");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    goal.yaw -= dx * 0.008;
    goal.pitch = Math.max(opts.minPitch || 0.35, Math.min(opts.maxPitch || 1.05, goal.pitch + dy * 0.004));
    lastTouch = performance.now();
    if (moved && opts.onInteract) opts.onInteract();
  });
  const end = () => { dragging = false; host.classList.remove("m3d-grab"); };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);

  let visible = false, raf = 0, last = performance.now();
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((en) => en.isIntersecting);
    if (visible) start();
  }, { rootMargin: "120px" });
  io.observe(host);
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || !host.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // Лёгкое покачивание, пока человек не трогает макет
    if (!dragging && !reduceMotion() && now - lastTouch > 5000 && opts.sway !== false) {
      goal.yaw += ((baseYaw + Math.sin(now / 5200) * 0.22) - goal.yaw) * 0.02;
    }
    orbit.yaw += (goal.yaw - orbit.yaw) * Math.min(1, dt * 8);
    orbit.pitch += (goal.pitch - orbit.pitch) * Math.min(1, dt * 8);
    placeCamera();
    if (opts.onFrame) opts.onFrame(dt, now);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  resize();
  return { renderer, scene, camera, rig, canvas, start, resize, orbit };
}

function lights(scene) {
  const hemi = new HemisphereLight(0xffffff, 0xa9b5ae, 1.2);
  scene.add(hemi);
  const sun = new DirectionalLight(0xffffff, 2.9);
  sun.position.set(11, 13, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -17; sun.shadow.camera.right = 17;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);
  return { hemi, sun };
}

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,220,150,1)"); grd.addColorStop(0.25, "rgba(255,200,110,.55)"); grd.addColorStop(1, "rgba(255,190,90,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

// Окна для вечернего режима: светятся не все, как в настоящем доме
function windowTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    if (rnd() < 0.58) { g.fillStyle = rnd() < 0.8 ? "#ffd58a" : "#bcd4ff"; g.fillRect(x * 16 + 4, y * 16 + 5, 8, 7); }
  }
  const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; return t;
}

const mat = (color, extra) => new MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });

function box(w, h, d, material, x, y, z, parent) {
  const m = new Mesh(new BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/* ================= Макет района ================= */
export function maquette(host, opts = {}) {
  const projects = opts.projects || [];
  const stage = createStage(host, {
    label: opts.label || "3D-макет Северного округа",
    fov: 28, radius: 13.2, fitScale: opts.fitScale || ((w) => (w < 560 ? 1.32 : 1.14)), yaw: opts.yaw || 0.62, pitch: opts.pitch || 0.7, targetY: -0.9, minPitch: 0.42, maxPitch: 1.1,
    sway: opts.sway, onInteract: () => { host.classList.add("m3d-touched"); },
    onFrame
  });
  if (!stage) return null;
  const { scene, rig, camera } = stage;
  const L = lights(scene);
  const W = { glow: glowTexture(), windows: windowTexture() };

  const mPlate = mat(PAL.plate), mLand = mat(PAL.land), mRoad = mat(PAL.road), mLine = mat(PAL.line);
  const mWater = mat(PAL.water, { roughness: 0.25, metalness: 0.05 });
  const mTree = mat(PAL.tree, { flatShading: true }), mTrunk = mat(PAL.trunk);
  const mNew = mat(PAL.proposed, { roughness: 0.6 }), mNewSoft = mat(PAL.proposedSoft, { roughness: 0.8 });
  const mLamp = new MeshStandardMaterial({ color: 0xfff4dd, emissive: PAL.lamp, emissiveIntensity: 0.2, roughness: 0.4 });
  const mDark = mat(0x2b3430, { roughness: 0.4 });
  const wallMats = [];

  // Основание макета
  const base = box(26.4, 0.9, 18.4, mPlate, 0, -0.9, 0, rig); base.castShadow = false;
  const land = box(26, 0.02, 18, mLand, 0, -0.02, 0, rig); land.castShadow = false;

  // Река Светлая и набережная
  box(26, 0.03, 2.4, mWater, 0, -0.01, 5.4, rig).castShadow = false;
  box(26, 0.1, 1.0, mLand, 0, 0, 3.7, rig);
  box(26, 0.22, 0.08, mPlate, 0, 0.1, 4.16, rig);
  box(26, 0.12, 0.08, mPlate, 0, 0, 6.64, rig);

  // Улицы: Ленинградская (вдоль) и Садовая (поперёк)
  const roadMain = box(26, 0.025, 1.6, mRoad, 0, 0, 0.6, rig); roadMain.castShadow = false;
  const roadSad = box(1.2, 0.025, 8.4, mRoad, -3, 0, -4.4, rig); roadSad.castShadow = false;
  box(1.2, 0.025, 1.8, mRoad, -3, 0, 2.3, rig).castShadow = false;
  for (let x = -12.4; x < 12.6; x += 1.2) if (Math.abs(x + 3) > 0.8) box(0.55, 0.03, 0.06, mLine, x, 0, 0.6, rig).castShadow = false;

  // Здания: существующие — белые; окна светятся вечером
  function building(w, h, d, x, z) {
    const t = W.windows.clone(); t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 0.9)), Math.max(1, Math.round(h / 0.7)));
    const wall = new MeshStandardMaterial({ color: PAL.building, roughness: 0.9, emissive: 0xffd58a, emissiveMap: t, emissiveIntensity: 0 });
    wallMats.push(wall);
    const roof = mat(PAL.building);
    const m = new Mesh(new BoxGeometry(w, h, d), [wall, wall, roof, roof, wall, wall]);
    m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true;
    rig.add(m); return m;
  }
  function tree(x, z, s = 1, material = mTree) {
    const g = new Group();
    const trunk = new Mesh(new CylinderGeometry(0.05 * s, 0.06 * s, 0.45 * s, 6), mTrunk);
    trunk.position.y = 0.22 * s; trunk.castShadow = true; g.add(trunk);
    const crown = new Mesh(new IcosahedronGeometry(0.42 * s, 0), material);
    crown.position.y = 0.72 * s; crown.castShadow = true; crown.receiveShadow = true; g.add(crown);
    g.position.set(x, 0, z); return g;
  }

  // Ряд домов между Ленинградской и набережной
  [[-10.6, 2.2, 0.8], [-7.4, 2.6, 0.95], [-0.2, 2.4, 0.7], [3.4, 2.0, 0.9], [7.2, 2.8, 0.65], [10.8, 1.8, 1.0]].forEach(([x, w, h]) => building(w, h, 1.0, x, 2.3));
  // Двор на Садовой, 14–18: дома вокруг двора
  building(1.3, 2.6, 5.4, -10.9, -4.5);
  building(5.6, 2.1, 1.2, -7.5, -7.3);
  building(1.2, 1.8, 2.6, -4.3, -5.6);
  building(3.2, 1.4, 1.0, -8.2, -1.6);
  // Школа № 12 — Г-образное здание и стадион
  building(5.2, 1.5, 1.4, 6.6, -5.6);
  building(1.4, 1.5, 2.4, 4.7, -3.9);
  box(3.2, 0.02, 2.0, mat(0xdfe5e0), 7.8, 0, -2.85, rig).castShadow = false;
  // Башни на востоке и дома у сквера
  building(1.6, 3.8, 1.6, 11.2, -6.4);
  building(1.6, 3.1, 1.6, 11.2, -3.4);
  building(1.4, 2.2, 3.0, -1.4, -6.2);
  building(2.2, 1.2, 1.2, 1.6, -1.4);
  // Дальний берег
  [[-9, 3.4, 0.55], [-2.5, 4.2, 0.45], [4.5, 3.0, 0.6], [10, 2.6, 0.5]].forEach(([x, w, h]) => building(w, h, 0.9, x, 7.8));

  // Деревья: сквер Юности, набережная, дальний берег
  [[0.2, -4.8], [1.2, -5.8], [2.3, -4.6], [0.6, -3.4], [2.6, -3.3], [1.6, -7.2], [3.4, -6.4]].forEach(([x, z], i) => rig.add(tree(x, z, 0.9 + (i % 3) * 0.12)));
  [-11.8, -6, -1.6, 5.4, 9.2, 12.2].forEach((x) => rig.add(tree(x, 3.45, 0.75)));
  [-12, -6.3, -5.6, 1, 1.8, 7.4, 12.2].forEach((x, i) => rig.add(tree(x, 7.4 + (i % 2) * 0.6, 0.8)));
  [[9.5, -1.4], [12.3, -1.4], [3.6, -2.2]].forEach(([x, z]) => rig.add(tree(x, z, 0.8)));

  /* ---------- Проекты бюджета: появляются зелёным ---------- */
  const parts = {};      // id -> [mesh, ...] — части проекта, которые «строятся»
  const glows = [];      // светящиеся ореолы фонарей и табло (вечером)
  const blinkers = [];   // светофор
  let bus = null;

  function part(id, obj, order = 0) {
    obj.userData.order = order; obj.scale.setScalar(0.0001); obj.visible = false;
    (parts[id] = parts[id] || []).push(obj); rig.add(obj); return obj;
  }
  function glowAt(parent, y, size, opacity = 1) {
    const s = new Sprite(new SpriteMaterial({ map: W.glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
    s.position.y = y; s.scale.setScalar(size); s.userData.max = opacity; parent.add(s); glows.push(s); return s;
  }

  // b3 — освещение набережной: ряд фонарей
  for (let i = 0, x = -11; x <= 11.01; x += 2.75, i++) {
    const g = new Group();
    const pole = new Mesh(new CylinderGeometry(0.035, 0.05, 1.0, 8), mNew); pole.position.y = 0.6; pole.castShadow = true; g.add(pole);
    const head = new Mesh(new SphereGeometry(0.11, 14, 10), mLamp); head.position.y = 1.14; g.add(head);
    glowAt(g, 1.14, 1.5, 0.9);
    g.position.set(x, 0, 3.95);
    part("b3", g, i);
  }

  // b4 — навесы и табло на остановках
  [-8, 1.5, 9].forEach((x, i) => {
    const g = new Group();
    const roof = new Mesh(new BoxGeometry(1.15, 0.05, 0.5), mNew); roof.position.set(0, 0.74, 0); roof.castShadow = true; g.add(roof);
    const back = new Mesh(new BoxGeometry(1.1, 0.5, 0.03), mNewSoft); back.position.set(0, 0.42, -0.22); back.castShadow = true; g.add(back);
    [-0.5, 0.5].forEach((dx) => { const p = new Mesh(new BoxGeometry(0.04, 0.72, 0.04), mNew); p.position.set(dx, 0.36, -0.2); g.add(p); });
    const board = new Mesh(new BoxGeometry(0.34, 0.16, 0.04), new MeshStandardMaterial({ color: 0x14231c, emissive: 0x7cf2b0, emissiveIntensity: 0.6 }));
    board.position.set(0.32, 0.56, -0.19); g.add(board);
    glowAt(board, 0, 0.6, 0.5);
    g.position.set(x, 0, -0.62);
    part("b4", g, i);
  });

  // b1 — светофор с кнопкой и «зебра» у школы
  {
    const zebra = new Group();
    for (let i = 0; i < 6; i++) { const s = new Mesh(new BoxGeometry(0.18, 0.03, 1.5), mat(0xffffff)); s.position.set(-0.55 + i * 0.22, 0.02, 0); s.receiveShadow = true; zebra.add(s); }
    zebra.position.set(6.6, 0, 0.6);
    part("b1", zebra, 0);
    [[6.0, -0.45, 0], [7.2, 1.65, Math.PI]].forEach(([x, z, ry], i) => {
      const g = new Group();
      const pole = new Mesh(new CylinderGeometry(0.035, 0.045, 1.05, 8), mNew); pole.position.y = 0.52; pole.castShadow = true; g.add(pole);
      const head = new Mesh(new BoxGeometry(0.16, 0.38, 0.14), mDark); head.position.y = 1.15; head.castShadow = true; g.add(head);
      const red = new Mesh(new SphereGeometry(0.045, 10, 8), new MeshStandardMaterial({ color: 0x401010, emissive: PAL.red, emissiveIntensity: 0 }));
      red.position.set(0, 1.25, 0.075); g.add(red);
      const green = new Mesh(new SphereGeometry(0.045, 10, 8), new MeshStandardMaterial({ color: 0x0f3020, emissive: PAL.green, emissiveIntensity: 0 }));
      green.position.set(0, 1.05, 0.075); g.add(green);
      const btn = new Mesh(new BoxGeometry(0.08, 0.1, 0.06), mNewSoft); btn.position.set(0, 0.8, 0.05); g.add(btn);
      g.rotation.y = ry; g.position.set(x, 0, z);
      blinkers.push({ red: red.material, green: green.material });
      part("b1", g, i + 1);
    });
  }

  // b2 — вечерний автобус 14
  {
    const g = new Group();
    const body = new Mesh(new BoxGeometry(1.7, 0.42, 0.5), mNew); body.position.y = 0.33; body.castShadow = true; g.add(body);
    const roof = new Mesh(new BoxGeometry(1.66, 0.06, 0.46), mat(0xffffff)); roof.position.y = 0.57; roof.castShadow = true; g.add(roof);
    const glass = new Mesh(new BoxGeometry(1.5, 0.14, 0.52), new MeshStandardMaterial({ color: 0x1d2a24, emissive: 0xfff1c9, emissiveIntensity: 0, roughness: 0.3 }));
    glass.position.set(-0.04, 0.43, 0); g.add(glass);
    [-0.55, 0.55].forEach((dx) => [-0.26, 0.26].forEach((dz) => {
      const w = new Mesh(new CylinderGeometry(0.11, 0.11, 0.06, 12), mDark); w.rotation.x = Math.PI / 2; w.position.set(dx, 0.11, dz); g.add(w);
    }));
    const lightL = glowAt(g, 0.28, 0.7, 0.9); lightL.position.set(0.9, 0.28, 0.16);
    const lightR = glowAt(g, 0.28, 0.7, 0.9); lightR.position.set(0.9, 0.28, -0.16);
    g.userData.glass = glass.material;
    g.position.set(-12, 0, 1.0);
    bus = part("b2", g, 0);
  }

  // b7 — ремонт двора на Садовой: газон, площадка, скамейки, молодые деревья
  {
    const lawn = new Mesh(new BoxGeometry(5.0, 0.03, 3.6), mNewSoft); lawn.position.set(-7.4, 0.015, -4.4); lawn.receiveShadow = true;
    part("b7", lawn, 0);
    const play = new Group();
    const deck = new Mesh(new BoxGeometry(0.9, 0.06, 0.9), mNew); deck.position.y = 0.5; deck.castShadow = true; play.add(deck);
    [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(([dx, dz]) => { const p = new Mesh(new BoxGeometry(0.06, 0.9, 0.06), mNew); p.position.set(dx, 0.45, dz); p.castShadow = true; play.add(p); });
    const roofP = new Mesh(new CylinderGeometry(0, 0.7, 0.4, 4), mNew); roofP.rotation.y = Math.PI / 4; roofP.position.y = 1.1; roofP.castShadow = true; play.add(roofP);
    const slide = new Mesh(new BoxGeometry(0.3, 0.04, 1.0), mNewSoft); slide.rotation.x = -0.55; slide.position.set(0, 0.26, 0.85); play.add(slide);
    play.position.set(-8.2, 0, -4.6);
    part("b7", play, 1);
    [[-6.2, -3.0], [-6.2, -5.8], [-9.4, -3.0]].forEach(([x, z], i) => {
      const b = new Group();
      const seat = new Mesh(new BoxGeometry(0.7, 0.05, 0.22), mNew); seat.position.y = 0.2; seat.castShadow = true; b.add(seat);
      const back = new Mesh(new BoxGeometry(0.7, 0.18, 0.04), mNew); back.position.set(0, 0.32, -0.1); b.add(back);
      b.position.set(x, 0, z); part("b7", b, 2 + i);
    });
    [[-5.4, -3.6], [-5.5, -5.2], [-7.0, -6.1], [-9.6, -5.9]].forEach(([x, z], i) => part("b7", tree(x, z, 0.65, mNew), 5 + i));
  }

  // b8 — велодорожка вдоль Ленинградской: зелёная полоса, кладётся участками
  for (let i = 0, x = -12.4; x < 12.5; x += 2.5, i++) {
    const seg = new Mesh(new BoxGeometry(2.42, 0.035, 0.34), mNewSoft);
    seg.position.set(x + 1.21, 0.02, 1.62); seg.receiveShadow = true;
    const g = new Group(); g.add(seg);
    const line = new Mesh(new BoxGeometry(2.42, 0.04, 0.04), mNew); line.position.set(x + 1.21, 0.025, 1.45); g.add(line);
    part("b8", g, i);
  }

  // b5 — площадка для выгула собак у сквера Юности: газон и ограждение
  {
    const g = new Group();
    const grass = new Mesh(new BoxGeometry(1.5, 0.03, 1.5), mNewSoft); grass.position.y = 0.015; grass.receiveShadow = true; g.add(grass);
    [[0, -0.75, 1.5, 0.04], [0, 0.75, 1.5, 0.04], [-0.75, 0, 0.04, 1.5], [0.75, 0, 0.04, 1.5]].forEach(([x, z, w, d]) => {
      const f = new Mesh(new BoxGeometry(w, 0.22, d), mNew); f.position.set(x, 0.11, z); f.castShadow = true; g.add(f);
    });
    g.position.set(-1.3, 0, -3.3);
    part("b5", g, 0);
  }

  // Подсветка места проекта при наведении: кольцо на земле
  const ringMat = new MeshBasicMaterial({ color: PAL.proposed, transparent: true, opacity: 0, depthWrite: false });
  const ring = new Mesh(new RingGeometry(0.9, 1.15, 48), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; rig.add(ring);
  let hoverId = null;

  const anchors = {
    b1: new Vector3(6.6, 1.9, 0.6), b2: new Vector3(-4.6, 1.3, 0.6), b3: new Vector3(-1.5, 1.9, 3.95),
    b4: new Vector3(1.5, 1.5, -0.62), b7: new Vector3(-7.4, 2.4, -4.4),
    b8: new Vector3(9.6, 0.9, 1.62), b5: new Vector3(-1.3, 1.1, -3.3)
  };
  const ringAt = { b1: [6.6, 0.6, 1.4], b2: [-4.6, 0.6, 1.6], b3: [-1.5, 3.9, 2.4], b4: [1.5, -0.6, 1.1], b7: [-7.4, -4.4, 2.8], b8: [9.6, 1.62, 1.2], b5: [-1.3, -3.3, 1.3] };

  // HTML-метки с ценой поверх макета (дублируют список, поэтому скрыты от скринридеров)
  const pinLayer = document.createElement("div");
  pinLayer.className = "m3d-pins"; pinLayer.setAttribute("aria-hidden", "true");
  host.appendChild(pinLayer);
  const pins = {};
  projects.forEach((p) => {
    if (!anchors[p.id]) return;
    const b = document.createElement("button");
    b.type = "button"; b.tabIndex = -1; b.className = "m3d-pin"; b.dataset.id = p.id;
    const inner = document.createElement("span"); inner.className = "m3d-pin-in";
    const dot = document.createElement("span"); dot.className = "m3d-pin-dot";
    const price = document.createElement("b"); price.className = "m3d-pin-p"; price.textContent = p.price || "";
    const title = document.createElement("span"); title.className = "m3d-pin-t"; title.textContent = p.short || p.title;
    inner.append(dot, price, title); b.appendChild(inner);
    if (opts.interactive === false) b.disabled = true;
    b.addEventListener("click", () => opts.onToggle && opts.onToggle(p.id));
    b.addEventListener("pointerenter", () => setHover(p.id));
    b.addEventListener("pointerleave", () => setHover(null));
    pinLayer.appendChild(b); pins[p.id] = b;
  });

  /* ---------- Состояние и анимация ---------- */
  const selected = new Set();
  const anim = []; // { obj, from, to, start, dur, back }
  function tweenPart(obj, to, delay) {
    const now = performance.now();
    const from = obj.scale.x;
    if (to > 0) obj.visible = true;
    if (reduceMotion()) { obj.scale.setScalar(to || 0.0001); obj.visible = to > 0; return; }
    anim.push({ obj, from, to, start: now + delay, dur: to > 0 ? 620 : 320, back: to > 0 });
  }
  function setSelected(ids) {
    const next = new Set(ids);
    Object.keys(parts).forEach((id) => {
      const was = selected.has(id), on = next.has(id);
      if (was === on) return;
      parts[id].forEach((o) => tweenPart(o, on ? 1 : 0.0001, on ? o.userData.order * 90 : 0));
      if (pins[id]) pins[id].classList.toggle("on", on);
    });
    selected.clear(); next.forEach((id) => selected.add(id));
  }
  function setHover(id) {
    hoverId = id;
    Object.values(pins).forEach((b) => b.classList.toggle("hover", b.dataset.id === id));
    if (id && ringAt[id]) { const [x, z, s] = ringAt[id]; ring.position.x = x; ring.position.z = z; ring.scale.setScalar(s); }
    if (opts.onHover) opts.onHover(id);
  }

  let evening = false, eve = 0;
  function setEvening(on) { evening = !!on; host.classList.toggle("m3d-evening", evening); }

  const v = new Vector3();
  let busX = -12;
  function onFrame(dt, now) {
    // «Стройка»: части проекта вырастают по очереди
    for (let i = anim.length - 1; i >= 0; i--) {
      const a = anim[i];
      const p = clamp01((now - a.start) / a.dur);
      if (now < a.start) continue;
      const k = a.back ? easeOutBack(p) : p * p;
      a.obj.scale.setScalar(Math.max(0.0001, a.from + (a.to - a.from) * k));
      if (p >= 1) { if (a.to < 0.01) a.obj.visible = false; anim.splice(i, 1); }
    }
    // Вечер: свет приглушается, окна, фонари и табло загораются
    eve += ((evening ? 1 : 0) - eve) * Math.min(1, dt * 3);
    L.hemi.intensity = MathUtils.lerp(1.2, 0.3, eve);
    L.hemi.color.setRGB(MathUtils.lerp(1, 0.55, eve), MathUtils.lerp(1, 0.64, eve), MathUtils.lerp(1, 0.85, eve));
    L.sun.intensity = MathUtils.lerp(2.9, 0.28, eve);
    L.sun.color.setRGB(MathUtils.lerp(1, 0.62, eve), MathUtils.lerp(1, 0.7, eve), 1);
    wallMats.forEach((m) => { m.emissiveIntensity = eve * 0.95; });
    mLamp.emissiveIntensity = 0.2 + eve * 2.2;
    glows.forEach((s) => { s.material.opacity = eve * s.userData.max; });
    if (bus) bus.userData.glass.emissiveIntensity = eve * 0.9;

    // Светофор: красный — зелёный по очереди
    const phase = Math.floor(now / 2200) % 2;
    blinkers.forEach((b) => { b.red.emissiveIntensity = phase ? 0 : 2.2; b.green.emissiveIntensity = phase ? 2.2 : 0; });

    // Автобус едет по Ленинградской и «уходит» за край макета
    if (bus && bus.visible && !reduceMotion()) {
      busX += dt * 2.1; if (busX > 13.2) busX = -13.2;
      bus.position.x = busX;
      const edge = Math.min(1, (13.2 - Math.abs(busX)) / 0.9);
      if (!anim.some((a) => a.obj === bus)) bus.scale.set(Math.max(0.0001, edge), 1, 1);
    } else if (bus) { bus.position.x = -4.6; }

    // Кольцо подсветки
    ringMat.opacity += ((hoverId ? 0.55 + Math.sin(now / 180) * 0.2 : 0) - ringMat.opacity) * Math.min(1, dt * 10);

    // Метки следуют за точками на макете
    const w = host.clientWidth, h = host.clientHeight;
    Object.keys(pins).forEach((id) => {
      v.copy(anchors[id]); rig.localToWorld(v); v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      pins[id].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
  }

  setEvening(opts.evening != null ? opts.evening : prefersDark());
  if (opts.selected) setSelected(opts.selected);
  stage.start();
  return { setSelected, setEvening, isEvening: () => evening, hover: setHover, el: host };
}

/* ================= Модель согласия: три группы жителей ================= */
export function consensus(host, opts = {}) {
  const clusters = opts.clusters || [];
  const stage = createStage(host, {
    label: opts.label || "3D-модель: три группы жителей сходятся в центре, когда согласны",
    fov: 30, radius: 6.3, fitScale: 0.86, yaw: 0.3, pitch: 0.72, minPitch: 0.45, maxPitch: 1.2,
    onFrame, sway: false
  });
  if (!stage) return null;
  const { scene, rig } = stage;
  const L = lights(scene);
  L.sun.shadow.camera.left = -8; L.sun.shadow.camera.right = 8; L.sun.shadow.camera.top = 8; L.sun.shadow.camera.bottom = -8;

  const platform = new Mesh(new CylinderGeometry(6, 6.25, 0.5, 72), mat(PAL.plate));
  platform.position.y = -0.25; platform.receiveShadow = true; rig.add(platform);
  const top = new Mesh(new CylinderGeometry(5.85, 5.85, 0.02, 72), mat(PAL.land));
  top.position.y = 0.0; top.receiveShadow = true; rig.add(top);
  const ringMat = new MeshBasicMaterial({ color: PAL.proposed, transparent: true, opacity: 0, depthWrite: false });
  const ring = new Mesh(new RingGeometry(2.62, 2.8, 96), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; rig.add(ring);
  const plinth = new Mesh(new CylinderGeometry(0.42, 0.5, 0.36, 32), mat(PAL.building));
  plinth.position.y = 0.18; plinth.castShadow = true; plinth.receiveShadow = true; rig.add(plinth);

  const grey = new Color(0xd6dcd8);
  const bodyGeo = new CapsuleGeometry(0.18, 0.32, 4, 12), headGeo = new SphereGeometry(0.145, 16, 12);
  const figures = [];
  const homeAngle = [-0.5, Math.PI * 2 / 3 - 0.5, Math.PI * 4 / 3 - 0.5];
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const SECTOR = Math.PI * 2 / 3 * 0.8;   // доля круга на группу, с зазором между группами
  // Ряды в секторе: чем дальше от центра, тем больше мест; шаг между фигурами ~0.48
  function centerSlot(i) {
    let row = 0, left = i;
    for (;;) {
      const inRow = Math.max(1, Math.floor((SECTOR * (0.95 + row * 0.5)) / 0.48) + 1);
      if (left < inRow) return [row, left, inRow];
      left -= inRow; row++;
    }
  }

  clusters.forEach((c, gi) => {
    const color = new Color(c.hex || 0x888888);
    const n = Math.max(6, Math.round((c.size || 40) / 4));
    const a0 = homeAngle[gi % 3];
    const home = new Vector3(Math.cos(a0) * 4.15, 0, Math.sin(a0) * 4.15);
    for (let i = 0; i < n; i++) {
      const m = new MeshStandardMaterial({ color: color.clone(), roughness: 0.65 });
      const g = new Group();
      const body = new Mesh(bodyGeo, m); body.position.y = 0.34; body.castShadow = true; g.add(body);
      const head = new Mesh(headGeo, m); head.position.y = 0.83; head.castShadow = true; g.add(head);
      // Дом группы — подсолнух вокруг центра кластера
      const r = 0.42 * Math.sqrt(i + 0.5), t = i * GOLDEN;
      const hp = new Vector3(home.x + Math.cos(t) * r, 0, home.z + Math.sin(t) * r);
      // Место в центре — свой сектор внутри кольца согласия, ряд за рядом
      const [row, k, inRow] = centerSlot(i);
      const sr = 0.95 + row * 0.5;
      const sa = a0 + (inRow > 1 ? (k / (inRow - 1) - 0.5) : 0) * SECTOR;
      const cp = new Vector3(Math.cos(sa) * sr, 0, Math.sin(sa) * sr);
      g.position.copy(hp);
      g.rotation.y = -Math.atan2(-home.z, -home.x) + Math.PI / 2;
      rig.add(g);
      figures.push({ g, m, color, gi, i, n, home: hp, center: cp, from: hp.clone(), to: hp.clone(), start: 0, agree: false, phase: Math.random() * 6 });
    }
  });

  let allAgree = false;
  function show(statementId) {
    const now = performance.now();
    let minShare = 1;
    clusters.forEach((c, gi) => {
      const share = (c.agree && c.agree[statementId]) || 0;
      minShare = Math.min(minShare, share);
      const group = figures.filter((f) => f.gi === gi);
      const k = Math.round(share * group.length);
      group.forEach((f, idx) => {
        f.agree = idx < k;
        f.from.copy(f.g.position);
        f.to.copy(f.agree ? f.center : f.home);
        f.start = now + (reduceMotion() ? 0 : idx * 28 + gi * 60);
        if (reduceMotion()) f.g.position.copy(f.to);
      });
    });
    allAgree = minShare >= 0.8;
  }

  function onFrame(dt, now) {
    if (!reduceMotion()) rig.rotation.y += dt * 0.06;
    figures.forEach((f) => {
      const p = clamp01((now - f.start) / 1100);
      if (now >= f.start && p <= 1) {
        const k = easeInOut(p);
        f.g.position.lerpVectors(f.from, f.to, k);
        f.g.position.y = Math.abs(Math.sin(p * Math.PI * 4)) * 0.12 * (1 - p);   // шаги
        const dx = f.to.x - f.from.x, dz = f.to.z - f.from.z;
        if (p < 1 && Math.abs(dx) + Math.abs(dz) > 0.05) f.g.rotation.y = Math.atan2(dx, dz);
      } else if (p > 1 && !reduceMotion()) {
        f.g.position.y = f.agree ? Math.max(0, Math.sin(now / 420 + f.phase)) * 0.05 : 0;
      }
      // Несогласные бледнеют, согласные — в цвете группы
      f.m.color.lerp(f.agree ? f.color : grey, Math.min(1, dt * 4));
    });
    ringMat.opacity += ((allAgree ? 0.9 : 0) - ringMat.opacity) * Math.min(1, dt * 4);
  }

  if (opts.statement) show(opts.statement);
  stage.start();
  return { show, el: host };
}

window.VC3D = { supported, maquette, consensus };
document.dispatchEvent(new Event("vc3d-ready"));
