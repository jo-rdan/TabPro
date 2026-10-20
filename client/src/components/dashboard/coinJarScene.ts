import * as THREE from 'three';

// The 3D coin jar (the locked design): glass jar, honey coins that drop in as
// money arrives, a glowing rust ring for the night to beat. Loaded on demand,
// so phones never download three.js.

const R = 1.6;
const H = 4.2;
const MAX_COINS = 84;
const PER_LAYER = 7;
const LAYER_H = 0.105 * 2.6;
const RING_Y = 0.06 + (70 / PER_LAYER) * LAYER_H;

function label(text: string, color: string, size: number) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 96;
  const g = c.getContext('2d')!;
  g.font = '700 44px Figtree, sans-serif';
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 192, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; // keep the brand colours true, not washed out
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(size * 4, size, 1);
  return sprite;
}

// Light theme: darker glass on a cream card. Dark theme: milky glass on espresso.
const THEMES = {
  light: { glass: 0x7a6a5f, glassOpacity: 0.14, rim: 0x7a6a5f, rimOpacity: 0.6, base: 0xe3d6c6, ground: 0xe3d6c6, ringLabel: '#A63F15', nowLabel: '#73500E' },
  dark: { glass: 0xf4ede3, glassOpacity: 0.16, rim: 0xf4ede3, rimOpacity: 0.5, base: 0x3a2d26, ground: 0x2b201b, ringLabel: '#F0884F', nowLabel: '#F2B33A' },
};

export function createCoinJarScene(canvas: HTMLCanvasElement, initialDark: boolean) {
  let theme = THEMES[initialDark ? 'dark' : 'light'];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const hemi = new THREE.HemisphereLight(0xfff4e6, theme.ground, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1e0, 0.55);
  sun.position.set(5, 10, 7);
  scene.add(sun);

  const resize = () => {
    const w = canvas.clientWidth || 380, h = canvas.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const glassMat = new THREE.MeshStandardMaterial({ color: theme.glass, transparent: true, opacity: theme.glassOpacity, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 48, 1, true), glassMat);
  glass.position.y = H / 2; scene.add(glass);
  const rimMat = new THREE.MeshStandardMaterial({ color: theme.rim, transparent: true, opacity: theme.rimOpacity });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 12, 64), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = H; scene.add(rim);
  const baseMat = new THREE.MeshStandardMaterial({ color: theme.base });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.12, 48), baseMat);
  base.position.y = -0.06; scene.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.12, 0.05, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0xd06b4a, emissive: 0x7a2c18, emissiveIntensity: 0.6 }),
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = RING_Y; scene.add(ring);
  let ringTag: THREE.Sprite | null = null;
  let nowTag: THREE.Sprite | null = null;
  let nowText = '';
  let ringText: string | null = null;

  const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 28);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xe0ad4c, metalness: 0.2, roughness: 0.45, emissive: 0x5a3a08, emissiveIntensity: 0.35 });
  const coins = Array.from({ length: MAX_COINS }, (_, i) => {
    const layer = Math.floor(i / PER_LAYER), k = i % PER_LAYER;
    const a = (k / PER_LAYER) * Math.PI * 2 + layer * 0.5, rr = k === 0 ? 0 : 0.95;
    const target = new THREE.Vector3(Math.cos(a) * rr, 0.06 + layer * LAYER_H, Math.sin(a) * rr);
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 3, (Math.random() - 0.5) * 0.3);
    m.visible = false; scene.add(m);
    return { m, target, droppedAt: -1 };
  });

  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const t0 = performance.now();
  let shown = 0;
  let frame = 0;

  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    const a = still ? 0.5 : 0.5 + Math.sin(t * 0.3) * 0.35;
    camera.position.set(Math.sin(a) * 10.2, 4.4, Math.cos(a) * 10.2);
    camera.lookAt(0.4, 2.05, 0);
    let top = 0;
    coins.forEach((c) => {
      if (c.droppedAt < 0) { c.m.visible = false; return; }
      const q = still ? 1 : Math.min(1, Math.max(0, (t - c.droppedAt) / 0.55));
      c.m.visible = q > 0;
      c.m.position.set(c.target.x, c.target.y + (1 - q * q) * 5, c.target.z);
      if (q >= 1) top = Math.max(top, c.target.y);
    });
    // Labels stay beside the jar as the camera sways, never behind it.
    const rx = Math.cos(a), rz = -Math.sin(a);
    if (ringTag) ringTag.position.set(rx * (R + 2.2), RING_Y, rz * (R + 2.2));
    if (nowTag) {
      nowTag.position.set(-rx * (R + 2.1), top + 0.3, -rz * (R + 2.1));
      nowTag.material.opacity = top > 0 ? 1 : 0;
    }
    if (!still) ring.material.emissiveIntensity = 0.45 + Math.max(0, Math.sin(t * 2)) * 0.35;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  const dropTag = (tag: THREE.Sprite | null) => {
    if (!tag) return;
    scene.remove(tag);
    tag.material.map?.dispose();
    tag.material.dispose();
  };

  const redrawLabels = () => {
    dropTag(ringTag);
    ringTag = ringText ? label(ringText, theme.ringLabel, 0.75) : null;
    if (ringTag) scene.add(ringTag);
    dropTag(nowTag);
    nowTag = nowText ? label(nowText, theme.nowLabel, 0.85) : null;
    if (nowTag) scene.add(nowTag);
  };

  return {
    update(count: number, ringLabel: string | null, nowLabel: string) {
      const t = (performance.now() - t0) / 1000;
      // New coins drop one after another; fewer coins (a new night) just vanish.
      for (let i = 0; i < MAX_COINS; i++) {
        if (i < count && coins[i].droppedAt < 0) coins[i].droppedAt = t + (i - shown) * 0.12;
        if (i >= count) coins[i].droppedAt = -1;
      }
      shown = count;
      ring.visible = !!ringLabel;
      ringText = ringLabel;
      nowText = nowLabel;
      redrawLabels();
    },
    setDark(dark: boolean) {
      theme = THEMES[dark ? 'dark' : 'light'];
      glassMat.color.setHex(theme.glass); glassMat.opacity = theme.glassOpacity;
      rimMat.color.setHex(theme.rim); rimMat.opacity = theme.rimOpacity;
      baseMat.color.setHex(theme.base);
      hemi.groundColor.setHex(theme.ground);
      redrawLabels();
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      dropTag(ringTag);
      dropTag(nowTag);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    },
  };
}
