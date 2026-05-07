import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { FigureState, STUDY_VARIATIONS } from './figure';

interface PanelConfig {
  startPct: number;
  widthPct: number;
  cameraPos: Vector3;
  lookAt: Vector3;
  studyIndex: number;
  fov: number;
}

const TRIPTYCH_PANELS: PanelConfig[] = [
  {
    startPct: 0.0,
    widthPct: 0.328,
    cameraPos: new Vector3(-1.2, 0.3, 4.0),
    lookAt: new Vector3(0, 0.15, 0),
    studyIndex: 0,
    fov: 35,
  },
  {
    startPct: 0.336,
    widthPct: 0.328,
    cameraPos: new Vector3(0, 0.3, 4.2),
    lookAt: new Vector3(0, 0.15, 0),
    studyIndex: 1,
    fov: 35,
  },
  {
    startPct: 0.672,
    widthPct: 0.328,
    cameraPos: new Vector3(1.1, 0.25, 4.0),
    lookAt: new Vector3(0, 0.15, 0),
    studyIndex: 2,
    fov: 35,
  },
];

export class TriptychPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  figure: FigureState;
  triptychMode: boolean;

  constructor(scene: Scene, camera: PerspectiveCamera, figure: FigureState) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.figure = figure;
    this.triptychMode = false;
    this.needsSwap = false;
  }

  setTriptychMode(enabled: boolean) {
    this.triptychMode = enabled;
  }

  render(
    renderer: WebGLRenderer,
    _writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ) {
    const target = this.renderToScreen ? null : readBuffer;
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setRenderTarget(target);

    const totalW = target ? target.width : renderer.domElement.width;
    const totalH = target ? target.height : renderer.domElement.height;

    // Clear the full buffer first
    renderer.setViewport(0, 0, totalW, totalH);
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);

    // Save camera
    const origPos = this.camera.position.clone();
    const origFov = this.camera.fov;
    const origAspect = this.camera.aspect;

    for (const panel of TRIPTYCH_PANELS) {
      const x = Math.round(panel.startPct * totalW);
      const w = Math.round(panel.widthPct * totalW);

      renderer.setViewport(x, 0, w, totalH);
      renderer.setScissor(x, 0, w, totalH);
      renderer.setScissorTest(true);

      this.camera.position.copy(panel.cameraPos);
      this.camera.lookAt(panel.lookAt);
      this.camera.aspect = w / totalH;
      this.camera.fov = panel.fov;
      this.camera.updateProjectionMatrix();

      this.figure.applyVariation(STUDY_VARIATIONS[panel.studyIndex]);
      renderer.render(this.scene, this.camera);
    }

    // Restore everything cleanly
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, totalW, totalH);
    this.camera.position.copy(origPos);
    this.camera.fov = origFov;
    this.camera.aspect = origAspect;
    this.camera.updateProjectionMatrix();
    this.figure.resetVariation();
    renderer.autoClear = oldAutoClear;
  }
}
