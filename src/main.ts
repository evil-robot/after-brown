import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Color,
  ACESFilmicToneMapping,
  Clock,
  TextureLoader,
  SRGBColorSpace,
} from 'three';
import { createFigure } from './figure';
import { createCage } from './cage';
import { createPostProcessing } from './post';
import { createAudioReactive } from './audio';
import { setupVRMDropZone, VRMState } from './vrm-loader';
import './style.css';

// ============================================================
// STUDY AFTER A HUMAN HEAD
// Data portrait after Glenn Brown
// ============================================================

const container = document.getElementById('canvas-container')!;
const promptEl = document.getElementById('prompt')!;
const titleEl = document.getElementById('title')!;
const modeEl = document.getElementById('mode-indicator')!;
const controlsEl = document.getElementById('controls')!;

// === RENDERER ===
const renderer = new WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(new Color(0x0a0608), 1);
container.appendChild(renderer.domElement);

// === SCENE ===
const scene = new Scene();
scene.background = new Color(0x0a0608);

// === CAMERA ===
const camera = new PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0.3, 4.2);
camera.lookAt(0, 0.15, 0);

// === CREATE ELEMENTS ===
const figure = createFigure();
scene.add(figure.group);

const cage = createCage();
scene.add(cage.group);

// === POST PROCESSING ===
const post = createPostProcessing(renderer, scene, camera, figure);

// === AUDIO ===
const audio = createAudioReactive();

// === VRM LOADER ===
let vrmState: VRMState | null = null;
setupVRMDropZone(document.body, scene, figure.group, (state) => {
  vrmState = state;
});

// === IMAGE DROP: map a photo onto the surface ===
const dropZone = document.getElementById('drop-zone')!;
const textureLoader = new TextureLoader();

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('active');
});
document.body.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) dropZone.classList.remove('active');
});
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('active');

  const file = e.dataTransfer?.files[0];
  if (!file) return;

  // Handle image files (jpg, png, webp)
  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    textureLoader.load(url, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      figure.setTexture(texture);
      URL.revokeObjectURL(url);

      modeEl.textContent = 'painting mapped';
      modeEl.classList.add('visible');
      setTimeout(() => modeEl.classList.remove('visible'), 2000);
    });
    return;
  }
  // VRM files handled by setupVRMDropZone
});

// === STATE ===
let triptychMode = false;
let mouseX = 0;
let mouseY = 0;
let awakened = false;

// Simulated audio state (before mic is enabled)
let simLevel = 0.05;
let simSpike = 0;
let simScream = 0;

// === MOUSE TRACKING ===
document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// === CLICK TO AWAKEN ===
document.addEventListener('click', async () => {
  if (awakened) return;
  awakened = true;
  promptEl.classList.add('hidden');
  controlsEl.classList.add('visible');
  await audio.init();
  if (audio.active) {
    modeEl.textContent = 'mic active';
    modeEl.classList.add('visible');
    setTimeout(() => modeEl.classList.remove('visible'), 2000);
  }
}, { once: true });

// === KEYBOARD CONTROLS ===
document.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 't':
      triptychMode = !triptychMode;
      post.setTriptychMode(triptychMode);
      if (!triptychMode) {
        // Force exact same state as page load
        camera.position.set(0, 0.3, 4.2);
        camera.lookAt(0, 0.15, 0);
        camera.fov = 35;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
        renderer.setScissorTest(false);
      }
      titleEl.textContent = triptychMode
        ? 'THREE STUDIES OF A HUMAN HEAD'
        : 'STUDY AFTER A HUMAN HEAD';
      modeEl.textContent = triptychMode ? 'triptych' : 'single study';
      modeEl.classList.add('visible');
      setTimeout(() => modeEl.classList.remove('visible'), 1500);
      break;

    case 's':
      // Force scream (for testing without mic)
      simScream = 1.0;
      break;

    case 'r':
      // Reset — clear texture and VRM
      figure.setTexture(null);
      if (vrmState) {
        vrmState.dispose();
        vrmState = null;
      }
      break;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 's') {
    simScream = 0;
  }
});

// === RESIZE ===
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.resize(w, h, Math.min(window.devicePixelRatio, 2));
});

// === ANIMATION LOOP ===
const clock = new Clock();

function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  // === AUDIO ===
  audio.update();
  let audioLevel: number;
  let screamIntensity: number;

  if (audio.active) {
    audioLevel = audio.level;
    screamIntensity = audio.screamIntensity;
  } else {
    // Simulated breathing + occasional stirs
    simLevel = Math.sin(time * 0.8) * 0.04 + 0.06;
    if (Math.random() < 0.0005) {
      simSpike = 0.15 + Math.random() * 0.15;
    }
    simSpike *= 0.96;
    audioLevel = Math.max(0, simLevel + simSpike);

    // Manual scream override (S key)
    screamIntensity = simScream;
  }

  // === UPDATE ===
  figure.update(time, audioLevel, mouseX, mouseY, screamIntensity);
  cage.update(time, audioLevel);
  post.update(time, audioLevel);

  // Update VRM materials if loaded
  if (vrmState?.materials) {
    for (const mat of vrmState.materials) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uAudioLevel.value = audioLevel;
      mat.uniforms.uMouse.value.set(mouseX, mouseY);
      mat.uniforms.uScreamIntensity.value = screamIntensity;
    }
  }

  // === RENDER ===
  post.render();
}

// Start with single study title
titleEl.textContent = 'STUDY AFTER A HUMAN HEAD';
post.setTriptychMode(false);

animate();
