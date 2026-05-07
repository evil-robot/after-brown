import {
  Group,
  Mesh,
  ShaderMaterial,
  DoubleSide,
  Vector2,
  Color,
  Scene,
} from 'three';
import { fleshVertex, fleshFragment } from './shaders';

// ============================================================
// VRM DRAG-AND-DROP LOADER
// Loads a VRM file and replaces its materials with Brown-treatment shaders
// ============================================================

export interface VRMState {
  loaded: boolean;
  group: Group | null;
  materials: ShaderMaterial[];
  dispose: () => void;
}

export function setupVRMDropZone(
  dropElement: HTMLElement,
  scene: Scene,
  existingFigureGroup: Group,
  onLoad: (vrmState: VRMState) => void,
) {
  const dropZone = document.getElementById('drop-zone');

  dropElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZone) dropZone.classList.add('active');
  });

  dropElement.addEventListener('dragleave', () => {
    if (dropZone) dropZone.classList.remove('active');
  });

  dropElement.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZone) dropZone.classList.remove('active');

    const file = e.dataTransfer?.files[0];
    if (!file || !file.name.endsWith('.vrm')) {
      console.warn('Please drop a .vrm file');
      return;
    }

    try {
      // Dynamically import three-vrm (optional dependency)
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      // @ts-ignore — optional dependency, loaded dynamically
      const threeVRM = await import('@pixiv/three-vrm');

      const loader = new GLTFLoader();
      loader.register((parser: any) => {
        return new threeVRM.VRMLoaderPlugin(parser);
      });

      const url = URL.createObjectURL(file);
      const gltf = await loader.loadAsync(url);
      URL.revokeObjectURL(url);

      const vrm = gltf.userData.vrm;
      if (!vrm) {
        console.error('No VRM data found in file');
        return;
      }

      // Hide the sphere figure
      existingFigureGroup.visible = false;

      // Apply Brown treatment to the VRM
      const vrmGroup = new Group();
      const vrmMaterials: ShaderMaterial[] = [];

      // Traverse the VRM scene and replace materials
      vrm.scene.traverse((child: any) => {
        if (child instanceof Mesh && child.geometry) {
          // Create flesh shader material for this mesh
          const fleshMat = new ShaderMaterial({
            vertexShader: fleshVertex,
            fragmentShader: fleshFragment,
            uniforms: {
              uTime: { value: 0 },
              uAudioLevel: { value: 0 },
              uMouse: { value: new Vector2(0, 0) },
              uSmearStrength: { value: 0.15 },
              uNoiseScale: { value: 2.0 },
              uNoiseOffset: { value: Math.random() * 10 },
              uBreathing: { value: 1.0 },
              uDripAmount: { value: 0.5 },
              uScreamIntensity: { value: 0 },
              uOpacity: { value: 0.9 },
              uFleshTone: { value: new Color(0.82, 0.62, 0.52) },
              uDeepTone: { value: new Color(0.5, 0.12, 0.1) },
              uHighlight: { value: new Color(0.95, 0.85, 0.78) },
            },
            transparent: true,
            side: DoubleSide,
          });

          // Clone the mesh with our material
          const portraitMesh = new Mesh(child.geometry, fleshMat);
          portraitMesh.position.copy(child.position);
          portraitMesh.rotation.copy(child.rotation);
          portraitMesh.scale.copy(child.scale);

          // Copy world transform from skeleton if available
          child.updateWorldMatrix(true, false);
          portraitMesh.matrixAutoUpdate = false;
          portraitMesh.matrix.copy(child.matrixWorld);

          vrmGroup.add(baconMesh);
          vrmMaterials.push(fleshMat);
        }
      });

      // Center and scale the VRM
      vrmGroup.position.set(0, 0, 0);
      scene.add(vrmGroup);

      const vrmState: VRMState = {
        loaded: true,
        group: vrmGroup,
        materials: vrmMaterials,
        dispose: () => {
          scene.remove(vrmGroup);
          vrmMaterials.forEach(m => m.dispose());
          existingFigureGroup.visible = true;
        },
      };

      onLoad(vrmState);
      console.log('VRM loaded with Brown treatment:', file.name);
    } catch (err) {
      console.error('Failed to load VRM:', err);
      console.log('Install @pixiv/three-vrm for VRM support: npm i @pixiv/three-vrm');
    }
  });
}
