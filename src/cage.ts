import {
  Group,
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  ShaderMaterial,
  EllipseCurve,
  Vector3,
  Line,
  BufferAttribute,
} from 'three';
import { cageVertex, cageFragment } from './shaders';

export interface CageState {
  group: Group;
  update: (time: number, audioLevel: number) => void;
  dispose: () => void;
}

export function createCage(): CageState {
  const group = new Group();

  // === BACON'S PARALLELPIPED CAGE ===
  // Slightly trapezoidal — forced perspective creating unease
  const w = 2.0;
  const h = 2.8;
  const d = 1.6;
  const skew = 0.12; // Asymmetric distortion

  const corners = [
    // Bottom face (wider)
    [-w / 2 - skew, -h / 2, -d / 2],
    [w / 2 + skew, -h / 2, -d / 2],
    [w / 2 + skew * 0.5, -h / 2, d / 2],
    [-w / 2 - skew * 0.5, -h / 2, d / 2],
    // Top face (narrower — forced perspective)
    [-w / 2 + skew, h / 2, -d / 2 + skew],
    [w / 2 - skew, h / 2, -d / 2 + skew],
    [w / 2 - skew * 1.5, h / 2, d / 2 - skew],
    [-w / 2 + skew * 1.5, h / 2, d / 2 - skew],
  ];

  const edges: [number, number][] = [
    // Bottom
    [0, 1], [1, 2], [2, 3], [3, 0],
    // Top
    [4, 5], [5, 6], [6, 7], [7, 4],
    // Verticals
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  const positions: number[] = [];
  for (const [a, b] of edges) {
    positions.push(...corners[a], ...corners[b]);
  }

  const cageGeo = new BufferGeometry();
  cageGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));

  const cageMat = new ShaderMaterial({
    vertexShader: cageVertex,
    fragmentShader: cageFragment,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 1.0 },
      uOpacity: { value: 0.18 },
      uColor: { value: new Vector3(0.85, 0.78, 0.65) }, // Warm cream
    },
    transparent: true,
    depthWrite: false,
  });

  const cageLines = new LineSegments(cageGeo, cageMat);
  group.add(cageLines);

  // === DIAGONAL TENSION LINES ===
  // Diagonal lines cutting through the cage structure
  const diagonalPositions: number[] = [];
  // Cross on back face
  diagonalPositions.push(...corners[0], ...corners[5]);
  diagonalPositions.push(...corners[1], ...corners[4]);
  // One floor diagonal
  diagonalPositions.push(...corners[0], ...corners[2]);

  const diagGeo = new BufferGeometry();
  diagGeo.setAttribute('position', new Float32BufferAttribute(diagonalPositions, 3));

  const diagMat = new ShaderMaterial({
    vertexShader: cageVertex,
    fragmentShader: cageFragment,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0.5 },
      uOpacity: { value: 0.08 },
      uColor: { value: new Vector3(0.9, 0.75, 0.55) }, // Slightly warmer
    },
    transparent: true,
    depthWrite: false,
  });

  const diagLines = new LineSegments(diagGeo, diagMat);
  group.add(diagLines);

  // === GROUND ELLIPSE: circular platform ===
  const ellipse = new EllipseCurve(0, 0, 1.3, 0.7, 0, Math.PI * 2, false, 0);
  const ellipsePoints = ellipse.getPoints(80);
  const ellipsePositions = new Float32Array(ellipsePoints.length * 3);

  for (let i = 0; i < ellipsePoints.length; i++) {
    ellipsePositions[i * 3] = ellipsePoints[i].x;
    ellipsePositions[i * 3 + 1] = 0;
    ellipsePositions[i * 3 + 2] = ellipsePoints[i].y;
  }

  const ellipseGeo = new BufferGeometry();
  ellipseGeo.setAttribute('position', new BufferAttribute(ellipsePositions, 3));

  const ellipseMat = new ShaderMaterial({
    vertexShader: cageVertex,
    fragmentShader: cageFragment,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0.3 },
      uOpacity: { value: 0.12 },
      uColor: { value: new Vector3(0.8, 0.7, 0.55) },
    },
    transparent: true,
    depthWrite: false,
  });

  const ellipseLine = new Line(ellipseGeo, ellipseMat);
  ellipseLine.position.y = -h / 2 + 0.01;
  // Tilt slightly for perspective
  ellipseLine.rotation.x = 0;
  group.add(ellipseLine);

  // All shader materials for uniform updates
  const allMaterials = [cageMat, diagMat, ellipseMat];

  function update(time: number, audioLevel: number) {
    for (const mat of allMaterials) {
      mat.uniforms.uTime.value = time;
    }
    // Audio makes cage pulse and brighten slightly
    cageMat.uniforms.uOpacity.value = 0.18 + audioLevel * 0.12;
    diagMat.uniforms.uOpacity.value = 0.08 + audioLevel * 0.06;
  }

  function dispose() {
    cageGeo.dispose();
    diagGeo.dispose();
    ellipseGeo.dispose();
    allMaterials.forEach(m => m.dispose());
  }

  return { group, update, dispose };
}
