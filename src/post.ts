import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Vector2,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {
  chromaticAberrationShader,
  gradeGrainVignetteShader,
  triptychOverlayShader,
} from './shaders';
import { TriptychPass } from './triptych';
import { FigureState } from './figure';

export interface PostState {
  composer: EffectComposer;
  chromaticPass: ShaderPass;
  gradePass: ShaderPass;
  triptychOverlay: ShaderPass;
  update: (time: number, audioLevel: number) => void;
  resize: (width: number, height: number, dpr: number) => void;
  render: () => void;
  setTriptychMode: (enabled: boolean) => void;
  dispose: () => void;
}

export function createPostProcessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  figure: FigureState,
): PostState {
  const size = renderer.getSize(new Vector2());
  const dpr = renderer.getPixelRatio();

  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);
  composer.setPixelRatio(dpr);

  // Single mode: standard RenderPass (enabled by default)
  const renderPass = new RenderPass(scene, camera);
  renderPass.enabled = true;
  composer.addPass(renderPass);

  // Triptych mode: custom multi-viewport pass (disabled by default)
  const triptychPass = new TriptychPass(scene, camera, figure);
  triptychPass.enabled = false;
  composer.addPass(triptychPass);

  // Chromatic aberration
  const chromaticPass = new ShaderPass(chromaticAberrationShader);
  composer.addPass(chromaticPass);

  // Color grade + grain + vignette + canvas texture
  const gradePass = new ShaderPass(gradeGrainVignetteShader);
  composer.addPass(gradePass);

  // Triptych panel dividers (disabled by default)
  const triptychOverlay = new ShaderPass(triptychOverlayShader);
  triptychOverlay.uniforms.uEnabled.value = 0.0;
  composer.addPass(triptychOverlay);

  function update(time: number, audioLevel: number) {
    chromaticPass.uniforms.uTime.value = time;
    chromaticPass.uniforms.uAudioLevel.value = audioLevel;
    chromaticPass.uniforms.uIntensity.value = 0.4 + audioLevel * 0.8;

    gradePass.uniforms.uTime.value = time;
    gradePass.uniforms.uVignetteIntensity.value = 0.8 + audioLevel * 0.15;
    gradePass.uniforms.uGrainIntensity.value = 0.03 + audioLevel * 0.04;
    gradePass.uniforms.uCanvasIntensity.value = 0.2 + audioLevel * 0.1;
  }

  function resize(width: number, height: number, dpr: number) {
    composer.setSize(width, height);
    composer.setPixelRatio(dpr);
  }

  function render() {
    composer.render();
  }

  function setTriptychMode(enabled: boolean) {
    renderPass.enabled = !enabled;
    triptychPass.enabled = enabled;
    triptychPass.setTriptychMode(enabled);
    triptychOverlay.uniforms.uEnabled.value = enabled ? 1.0 : 0.0;
  }

  function dispose() {
    composer.dispose();
  }

  return {
    composer,
    chromaticPass,
    gradePass,
    triptychOverlay,
    update,
    resize,
    render,
    setTriptychMode,
    dispose,
  };
}
