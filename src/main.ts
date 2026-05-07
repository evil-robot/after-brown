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
// after-brown
// Data portrait after Glenn Brown
// ============================================================

const container = document.getElementById('canvas-container')!;
const promptEl = document.getElementById('prompt')!;
const titleEl = document.getElementById('title')!;
const modeEl = document.getElementById('mode-indicator')!;
const controlsEl = document.getElementById('controls')!;
const saveBtn = document.getElementById('save-btn')!;

// === RENDERER ===
const renderer = new WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // required for canvas export
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

// === TEXTURE LOADER ===
const textureLoader = new TextureLoader();

// === DEFAULT PORTRAIT: load Rembrandt on arrival ===
textureLoader.load('/default-portrait.jpg', (texture) => {
  texture.colorSpace = SRGBColorSpace;
  figure.setTexture(texture);
});

// === IMAGE DROP: map a photo onto the surface ===
const dropZone = document.getElementById('drop-zone')!;

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

  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    textureLoader.load(url, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      figure.setTexture(texture);
      URL.revokeObjectURL(url);

      modeEl.textContent = 'portrait mapped';
      modeEl.classList.add('visible');
      setTimeout(() => modeEl.classList.remove('visible'), 2000);
    });
    return;
  }
});

// === SAVE PORTRAIT ===
saveBtn.addEventListener('click', () => {
  post.render();
  const dataURL = renderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `after-brown-${Date.now()}.png`;
  link.href = dataURL;
  link.click();

  modeEl.textContent = 'saved';
  modeEl.classList.add('visible');
  setTimeout(() => modeEl.classList.remove('visible'), 1500);
});

// === STATE ===
let triptychMode = false;
let mouseX = 0;
let mouseY = 0;
let awakened = false;

let simLevel = 0.05;
let simSpike = 0;
let simScream = 0;

// === SHOW CONTROLS after a short delay — don't require click ===
setTimeout(() => {
  controlsEl.classList.add('soft-visible');
}, 2500);

// === MOUSE TRACKING ===
document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// === CLICK TO AWAKEN (mic) ===
document.addEventListener('click', async (e) => {
  if (awakened) return;
  if ((e.target as HTMLElement).id === 'save-btn') return;
  awakened = true;
  promptEl.classList.add('hidden');
  controlsEl.classList.remove('soft-visible');
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
        camera.position.set(0, 0.3, 4.2);
        camera.lookAt(0, 0.15, 0);
        camera.fov = 35;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
        renderer.setScissorTest(false);
      }
      titleEl.textContent = triptychMode ? 'THREE STUDIES AFTER BROWN' : 'AFTER BROWN';
      modeEl.textContent = triptychMode ? 'triptych' : 'single study';
      modeEl.classList.add('visible');
      setTimeout(() => modeEl.classList.remove('visible'), 1500);
      break;

    case 's':
      simScream = 1.0;
      break;

    case 'r':
      figure.setTexture(null);
      // Reload default portrait
      textureLoader.load('/default-portrait.jpg', (texture) => {
        texture.colorSpace = SRGBColorSpace;
        figure.setTexture(texture);
      });
      if (vrmState) {
        vrmState.dispose();
        vrmState = null;
      }
      break;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 's') simScream = 0;
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

  audio.update();
  let audioLevel: number;
  let screamIntensity: number;

  if (audio.active) {
    audioLevel = audio.level;
    screamIntensity = audio.screamIntensity;
  } else {
    simLevel = Math.sin(time * 0.8) * 0.04 + 0.06;
    if (Math.random() < 0.0005) simSpike = 0.15 + Math.random() * 0.15;
    simSpike *= 0.96;
    audioLevel = Math.max(0, simLevel + simSpike);
    screamIntensity = simScream;
  }

  figure.update(time, audioLevel, mouseX, mouseY, screamIntensity);
  cage.update(time, audioLevel);
  post.update(time, audioLevel);

  if (vrmState?.materials) {
    for (const mat of vrmState.materials) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uAudioLevel.value = audioLevel;
      mat.uniforms.uMouse.value.set(mouseX, mouseY);
      mat.uniforms.uScreamIntensity.value = screamIntensity;
    }
  }

  post.render();
}

titleEl.textContent = 'AFTER BROWN';
post.setTriptychMode(false);
animate();
