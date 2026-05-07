import * as THREE from 'three';
import {
  Group,
  Mesh,
  ShaderMaterial,
  IcosahedronGeometry,
  DoubleSide,
  Vector2,
  Color,
  Texture,
  AdditiveBlending,
} from 'three';
import { fleshVertex, fleshFragment } from './shaders';

export interface StudyVariation {
  smearMultiplier: number;
  noiseOffsetShift: number;
  mouseOffset: [number, number];
  screamMultiplier: number;
  dripMultiplier: number;
}

// Three studies: left, center, right. Triptych format after Glenn Brown.
export const STUDY_VARIATIONS: StudyVariation[] = [
  {
    // Left study: more smeared, past-tense, dragged
    smearMultiplier: 1.4,
    noiseOffsetShift: -2.0,
    mouseOffset: [-0.3, 0.1],
    screamMultiplier: 0.7,
    dripMultiplier: 1.3,
  },
  {
    // Center study: primary, most present
    smearMultiplier: 1.0,
    noiseOffsetShift: 0.0,
    mouseOffset: [0, 0],
    screamMultiplier: 1.0,
    dripMultiplier: 1.0,
  },
  {
    // Right study: fevered, intense, more violent
    smearMultiplier: 1.2,
    noiseOffsetShift: 4.5,
    mouseOffset: [0.2, -0.15],
    screamMultiplier: 1.4,
    dripMultiplier: 0.8,
  },
];

interface HeadConfig {
  scale: number;
  offset: [number, number, number];
  opacity: number;
  noiseOffset: number;
  smearStrength: number;
  noiseScale: number;
  fleshTone: [number, number, number];
  deepTone: [number, number, number];
  highlight: [number, number, number];
  blending?: number;
  dripAmount: number;
}

const HEADS: HeadConfig[] = [
  {
    scale: 1.0,
    offset: [0, 0.15, 0],
    opacity: 0.88,
    noiseOffset: 0.0,
    smearStrength: 0.18,
    noiseScale: 2.2,
    fleshTone: [0.82, 0.62, 0.52],
    deepTone: [0.5, 0.12, 0.1],
    highlight: [0.95, 0.85, 0.78],
    dripAmount: 0.15,
  },
  {
    scale: 0.92,
    offset: [-0.12, 0.2, 0.08],
    opacity: 0.35,
    noiseOffset: 3.14,
    smearStrength: 0.32,
    noiseScale: 2.6,
    fleshTone: [0.78, 0.55, 0.48],
    deepTone: [0.55, 0.1, 0.15],
    highlight: [0.9, 0.8, 0.72],
    dripAmount: 0.2,
  },
  {
    scale: 0.87,
    offset: [0.1, 0.1, -0.06],
    opacity: 0.25,
    noiseOffset: 6.28,
    smearStrength: 0.45,
    noiseScale: 3.0,
    fleshTone: [0.75, 0.5, 0.55],
    deepTone: [0.45, 0.15, 0.25],
    highlight: [0.85, 0.75, 0.7],
    dripAmount: 0.25,
  },
  {
    scale: 1.05,
    offset: [0, 0.25, 0.15],
    opacity: 0.12,
    noiseOffset: 9.42,
    smearStrength: 0.6,
    noiseScale: 1.8,
    fleshTone: [0.9, 0.4, 0.35],
    deepTone: [0.6, 0.08, 0.05],
    highlight: [1.0, 0.7, 0.6],
    blending: AdditiveBlending,
    dripAmount: 0.1,
  },
];

export interface FigureState {
  group: Group;
  materials: ShaderMaterial[];
  update: (time: number, audioLevel: number, mouseX: number, mouseY: number, screamIntensity: number) => void;
  applyVariation: (variation: StudyVariation) => void;
  resetVariation: () => void;
  setTexture: (texture: Texture | null) => void;
  dispose: () => void;
}

export function createFigure(): FigureState {
  const group = new Group();
  const materials: ShaderMaterial[] = [];
  const geometry = new IcosahedronGeometry(1, 48);

  // Store base values for variation reset
  const baseSmearStrengths: number[] = [];
  const baseNoiseOffsets: number[] = [];

  for (const head of HEADS) {
    const material = new ShaderMaterial({
      vertexShader: fleshVertex,
      fragmentShader: fleshFragment,
      uniforms: {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
        uMouse: { value: new Vector2(0, 0) },
        uSmearStrength: { value: head.smearStrength },
        uNoiseScale: { value: head.noiseScale },
        uNoiseOffset: { value: head.noiseOffset },
        uBreathing: { value: 1.0 },
        uDripAmount: { value: head.dripAmount },
        uScreamIntensity: { value: 0 },
        uTexture: { value: null },
        uUseTexture: { value: 0.0 },
        uOpacity: { value: head.opacity },
        uFleshTone: { value: new Color(...head.fleshTone) },
        uDeepTone: { value: new Color(...head.deepTone) },
        uHighlight: { value: new Color(...head.highlight) },
      },
      transparent: true,
      side: DoubleSide,
      depthWrite: head.opacity > 0.5,
      blending: head.blending as THREE.Blending | undefined,
    });

    const mesh = new Mesh(geometry, material);
    mesh.position.set(...head.offset);
    mesh.scale.setScalar(head.scale);
    group.add(mesh);
    materials.push(material);
    baseSmearStrengths.push(head.smearStrength);
    baseNoiseOffsets.push(head.noiseOffset);
  }

  let rotationY = 0;
  let currentVariation: StudyVariation | null = null;

  function update(time: number, audioLevel: number, mouseX: number, mouseY: number, screamIntensity: number) {
    const mx = mouseX + (currentVariation?.mouseOffset[0] ?? 0);
    const my = mouseY + (currentVariation?.mouseOffset[1] ?? 0);
    const screamMul = currentVariation?.screamMultiplier ?? 1.0;

    for (const mat of materials) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uAudioLevel.value = audioLevel;
      mat.uniforms.uMouse.value.set(mx, my);
      mat.uniforms.uScreamIntensity.value = screamIntensity * screamMul;
    }

    rotationY += 0.001 + Math.sin(time * 0.2) * 0.0005;
    group.rotation.y = rotationY;

    const separation = 1.0 + audioLevel * 0.5;
    group.children.forEach((child, i) => {
      if (i < HEADS.length) {
        const base = HEADS[i].offset;
        child.position.set(
          base[0] * separation,
          base[1] + Math.sin(time * 0.5 + i) * 0.02,
          base[2] * separation
        );
      }
    });
  }

  function applyVariation(variation: StudyVariation) {
    currentVariation = variation;
    materials.forEach((mat, i) => {
      mat.uniforms.uSmearStrength.value = baseSmearStrengths[i] * variation.smearMultiplier;
      mat.uniforms.uNoiseOffset.value = baseNoiseOffsets[i] + variation.noiseOffsetShift;
      mat.uniforms.uDripAmount.value = HEADS[i].dripAmount * variation.dripMultiplier;
    });
  }

  function resetVariation() {
    currentVariation = null;
    materials.forEach((mat, i) => {
      mat.uniforms.uSmearStrength.value = baseSmearStrengths[i];
      mat.uniforms.uNoiseOffset.value = baseNoiseOffsets[i];
      mat.uniforms.uDripAmount.value = HEADS[i].dripAmount;
    });
  }

  function setTexture(texture: Texture | null) {
    for (const mat of materials) {
      mat.uniforms.uTexture.value = texture;
      mat.uniforms.uUseTexture.value = texture ? 1.0 : 0.0;
    }
  }

  function dispose() {
    geometry.dispose();
    materials.forEach(m => m.dispose());
  }

  return { group, materials, update, applyVariation, resetVariation, setTexture, dispose };
}
