// ============================================================
// GLSL Shader Code — Francis Bacon Avatar Experiment
// Study After a Human Head — Full Treatment
// ============================================================

// Ashima's webgl-noise: 3D Simplex Noise
const NOISE_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// ============================================================
// FLESH VERTEX SHADER — Smear + Displacement + Drip + Scream
// ============================================================
export const fleshVertex = /* glsl */ `
uniform float uTime;
uniform float uAudioLevel;
uniform vec2 uMouse;
uniform float uSmearStrength;
uniform float uNoiseScale;
uniform float uNoiseOffset;
uniform float uBreathing;
uniform float uDripAmount;
uniform float uScreamIntensity;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vSmear;
varying float vDrip;

${NOISE_3D}

void main() {
  vec3 pos = position;
  vec3 norm = normal;

  // === LOW-FREQUENCY DIRECTIONAL SMEAR ===
  // Like a hand dragging across wet paint — the squeegee effect
  vec3 smearDir = normalize(vec3(uMouse.x * 0.7, uMouse.y * 0.3 + 0.1, 0.3));
  float smearNoise = snoise(pos * 0.8 + uTime * 0.06 + uNoiseOffset);
  float directionalFactor = dot(normalize(norm), smearDir) * 0.5 + 0.5;
  float smearAmount = smearNoise * directionalFactor * uSmearStrength;
  smearAmount *= (1.0 + uAudioLevel * 2.5);
  pos += smearDir * smearAmount;

  // === HIGH-FREQUENCY CHURNING ===
  // The boiling, writhing quality of Bacon's flesh
  float churn1 = snoise(pos * uNoiseScale + uTime * 0.12 + uNoiseOffset);
  float churn2 = snoise(pos * uNoiseScale * 2.1 + uTime * 0.08 - uNoiseOffset * 0.5);
  float churnDisplacement = (churn1 * 0.7 + churn2 * 0.3) * (0.12 + uAudioLevel * 0.35);
  pos += norm * churnDisplacement;

  // === DRIPPING ===
  // Heavily displaced vertices start to slide downward
  // Like wet oil paint running down a vertical canvas
  float dripThreshold = 0.06;
  float rawDrip = max(abs(churnDisplacement) - dripThreshold, 0.0) * 6.0;
  // Drip channels — paint runs in rivulets, not uniformly
  float dripChannel = snoise(vec3(pos.x * 5.0, 0.0, pos.z * 5.0 + uNoiseOffset)) * 0.5 + 0.5;
  dripChannel = pow(dripChannel, 2.0); // Concentrate into narrow channels
  float drip = rawDrip * dripChannel * uDripAmount;
  // Drip accelerates over time (gravity)
  drip *= (1.0 + sin(uTime * 0.4 + pos.x * 3.0) * 0.3);
  pos.y -= drip * (0.8 + uAudioLevel * 0.5);

  // === BREATHING ===
  float breath = sin(uTime * 0.8) * 0.015 * uBreathing;
  pos += norm * breath;

  // === THE SCREAM ===
  // When audio peaks, the face tears apart violently
  // Reference: Study after Velázquez's Portrait of Pope Innocent X
  float scream = uScreamIntensity;
  if (scream > 0.0) {
    // The mouth tears open — lower hemisphere stretches down
    float mouthZone = smoothstep(0.1, -0.3, pos.y); // Below center
    float mouthOpen = scream * mouthZone * 0.6;
    pos.y -= mouthOpen;

    // Horizontal tear — the face splits
    float tearNoise = snoise(pos * 2.0 + uTime * 0.8);
    pos.x += tearNoise * scream * 0.2;

    // Vertical stretch — anguish elongation
    float stretchZone = smoothstep(-0.5, 0.5, pos.y);
    pos.y += stretchZone * scream * 0.15;

    // Explosive displacement at peak scream
    if (scream > 0.6) {
      float explode = (scream - 0.6) * 2.5;
      float explodeNoise = snoise(pos * 3.0 + uTime * 1.5);
      pos += norm * explodeNoise * explode * 0.15;
    }
  }

  vNormal = normalize(normalMatrix * norm);
  vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
  vViewPosition = -(modelViewMatrix * vec4(pos, 1.0)).xyz;
  vUv = uv;
  vDisplacement = churnDisplacement;
  vSmear = smearAmount;
  vDrip = drip;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// ============================================================
// FLESH FRAGMENT SHADER — Subsurface + Painterly + Drip Color
// ============================================================
export const fleshFragment = /* glsl */ `
uniform float uTime;
uniform float uAudioLevel;
uniform float uOpacity;
uniform vec3 uFleshTone;
uniform vec3 uDeepTone;
uniform vec3 uHighlight;
uniform float uScreamIntensity;
uniform sampler2D uTexture;
uniform float uUseTexture;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vSmear;
varying float vDrip;

${NOISE_3D}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);

  // === LIGHTING — Dual key lights like a Bacon studio ===
  vec3 light1 = normalize(vec3(0.4, 0.8, 0.6));
  vec3 light2 = normalize(vec3(-0.6, 0.3, -0.4));

  // Wrap lighting for subsurface scattering approximation
  float NdotL1 = dot(normal, light1);
  float wrap1 = clamp((NdotL1 + 0.6) / 1.6, 0.0, 1.0);
  float NdotL2 = dot(normal, light2);
  float wrap2 = clamp((NdotL2 + 0.4) / 1.4, 0.0, 1.0);
  float lighting = wrap1 * 0.7 + wrap2 * 0.3;

  // === FLESH COLOR PALETTE ===
  vec3 deep = uDeepTone;
  vec3 mid = uFleshTone;
  vec3 highlight = uHighlight;
  vec3 color = mix(deep, mid, lighting);
  color = mix(color, highlight, pow(lighting, 3.5));

  // === MEAT / DISPLACEMENT COLOR ===
  float meatFactor = clamp(abs(vDisplacement) * 4.0, 0.0, 1.0);

  // === TEXTURE MAPPING (Bacon painting projected onto flesh) ===
  if (uUseTexture > 0.5) {
    vec4 texColor = texture2D(uTexture, vUv);
    // Lighting modulates the painting — gives it 3D depth
    vec3 litTexture = texColor.rgb * (0.5 + lighting * 0.7);
    // Mostly texture, with raw flesh bleeding through in displaced areas
    float texBlend = 0.85 - meatFactor * 0.3;
    color = mix(color, litTexture, texBlend);
  }
  vec3 meatColor = vec3(0.65, 0.12, 0.08);
  color = mix(color, meatColor, meatFactor * 0.5);

  // Smeared areas get a bruised quality
  float bruiseFactor = clamp(abs(vSmear) * 2.0, 0.0, 1.0);
  vec3 bruiseColor = vec3(0.35, 0.15, 0.3);
  color = mix(color, bruiseColor, bruiseFactor * 0.3);

  // === DRIP COLOR ===
  // Dripping areas are darker, more saturated — exposed raw beneath
  float dripFactor = clamp(vDrip * 3.0, 0.0, 1.0);
  vec3 dripColor = vec3(0.55, 0.08, 0.06); // Dark arterial
  color = mix(color, dripColor, dripFactor * 0.6);

  // === PAINTERLY TEXTURE ===
  float paint1 = snoise(vWorldPosition * 6.0 + uTime * 0.015);
  float paint2 = snoise(vWorldPosition * 12.0 - uTime * 0.008);
  color += (paint1 * 0.04 + paint2 * 0.02);

  // Subtle vein-like patterns
  float vein = snoise(vWorldPosition * vec3(8.0, 3.0, 8.0) + uTime * 0.02);
  vein = smoothstep(0.3, 0.5, abs(vein));
  color = mix(color, deep * 0.7, (1.0 - vein) * 0.15);

  // === RIM — figure emerging from void ===
  float rim = 1.0 - abs(dot(normal, viewDir));
  rim = pow(rim, 1.5);
  color *= 1.0 - rim * 0.5;

  // === SCREAM COLOR ===
  if (uScreamIntensity > 0.0) {
    // Violent red shift
    vec3 screamColor = vec3(0.9, 0.1, 0.05);
    color = mix(color, screamColor, uScreamIntensity * 0.35);
    // Electric blue flash at peak
    float flash = smoothstep(0.7, 1.0, uScreamIntensity);
    vec3 electricBlue = vec3(0.15, 0.3, 0.95);
    color = mix(color, electricBlue, flash * 0.2);
  }

  // === AUDIO REACTIVE ===
  color = mix(color, vec3(0.8, 0.2, 0.15), uAudioLevel * 0.2);

  // === ALPHA ===
  float edgeAlpha = 1.0 - pow(rim, 2.5);
  float alpha = uOpacity * edgeAlpha;
  // Dripping areas are more opaque (thick paint)
  alpha = mix(alpha, min(alpha + 0.2, 1.0), dripFactor);

  gl_FragColor = vec4(color, alpha);
}
`;

// ============================================================
// CHROMATIC ABERRATION + DISTORTION
// ============================================================
export const chromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.5 },
    uAudioLevel: { value: 0.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uAudioLevel;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);

      float intensity = uIntensity * (1.0 + uAudioLevel * 3.0);
      float offset = intensity * dist * 0.015;
      float wobble = sin(uTime * 3.0 + dist * 10.0) * uAudioLevel * 0.003;

      float r = texture2D(tDiffuse, vUv + dir * (offset + wobble)).r;
      float g = texture2D(tDiffuse, vUv + dir * wobble * 0.5).g;
      float b = texture2D(tDiffuse, vUv - dir * (offset * 0.7 + wobble)).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

// ============================================================
// COLOR GRADE + FILM GRAIN + VIGNETTE + CANVAS TEXTURE
// ============================================================
export const gradeGrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uGrainIntensity: { value: 0.08 },
    uVignetteIntensity: { value: 0.85 },
    uVignetteSize: { value: 0.45 },
    uCanvasIntensity: { value: 0.4 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    uniform float uVignetteIntensity;
    uniform float uVignetteSize;
    uniform float uCanvasIntensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // === OIL PAINT CANVAS TEXTURE ===
      // Linen weave pattern — horizontal and vertical threads
      float threadH = sin(vUv.x * 900.0) * 0.5 + 0.5;
      float threadV = sin(vUv.y * 700.0) * 0.5 + 0.5;
      float weave = threadH * threadV;
      // Canvas grain — larger scale texture
      float canvasGrain = hash(floor(vUv * 400.0)) * 0.5 + 0.5;
      float canvas = mix(weave, canvasGrain, 0.4);
      // Impasto effect — brighter areas have more texture (thick paint catches light)
      float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float impasto = canvas * brightness * 2.0;
      color.rgb += (canvas - 0.5) * uCanvasIntensity * 0.04;
      color.rgb += impasto * uCanvasIntensity * 0.02;

      // === BACON COLOR GRADE ===
      color.r = pow(color.r, 0.92);
      color.g = pow(color.g, 1.08);
      color.b = pow(color.b, 1.2);

      // Warm midtone push
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 warmShift = vec3(1.12, 0.94, 0.82);
      color.rgb = mix(color.rgb, color.rgb * warmShift, 0.4);

      // Crush blacks (Bacon's deep darks)
      color.rgb = max(color.rgb - 0.02, 0.0);

      // Desaturate highlights slightly
      float highMask = smoothstep(0.5, 0.9, luma);
      color.rgb = mix(color.rgb, vec3(luma) * warmShift * 0.9, highMask * 0.2);

      // === FILM GRAIN (slow, painterly — not video static) ===
      vec2 grainUv = vUv * vec2(600.0, 450.0);
      float grain = hash(floor(grainUv) + floor(uTime * 8.0)) - 0.5;
      color.rgb += grain * uGrainIntensity;

      // === HEAVY VIGNETTE ===
      float dist = length(vUv - 0.5);
      float vignette = smoothstep(uVignetteSize + 0.4, uVignetteSize, dist);
      vignette = pow(vignette, 1.3);
      color.rgb *= mix(0.0, 1.0, mix(1.0, vignette, uVignetteIntensity));

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `,
};

// ============================================================
// TRIPTYCH DIVIDER + PER-PANEL COLOR TREATMENT
// ============================================================
export const triptychOverlayShader = {
  uniforms: {
    tDiffuse: { value: null },
    uEnabled: { value: 1.0 },
    uDividerWidth: { value: 0.003 },
    uDividerColor: { value: [0.06, 0.04, 0.03] },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uEnabled;
    uniform float uDividerWidth;
    uniform vec3 uDividerColor;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      if (uEnabled > 0.5) {
        // Panel positions
        float third = 1.0 / 3.0;
        float twoThird = 2.0 / 3.0;

        // Divider lines
        float d1 = smoothstep(uDividerWidth, 0.0, abs(vUv.x - third));
        float d2 = smoothstep(uDividerWidth, 0.0, abs(vUv.x - twoThird));
        float divider = max(d1, d2);

        // Per-panel color treatment
        // Left panel: cooler, slightly blue — the past
        if (vUv.x < third) {
          color.rgb *= vec3(0.88, 0.92, 1.08);
          color.rgb = mix(color.rgb, color.rgb * 0.9, 0.1);
        }
        // Center panel: neutral — the present
        // (no modification)
        // Right panel: warmer, more saturated — the fever
        else if (vUv.x > twoThird) {
          color.rgb *= vec3(1.12, 0.93, 0.82);
          float sat = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          color.rgb = mix(vec3(sat), color.rgb, 1.15);
        }

        // Apply dividers
        color.rgb = mix(color.rgb, uDividerColor, divider * 0.9);

        // Subtle frame border (outer edge)
        float border = 0.0;
        float bw = 0.002;
        border = max(border, smoothstep(bw, 0.0, vUv.x));
        border = max(border, smoothstep(bw, 0.0, 1.0 - vUv.x));
        border = max(border, smoothstep(bw, 0.0, vUv.y));
        border = max(border, smoothstep(bw, 0.0, 1.0 - vUv.y));
        color.rgb = mix(color.rgb, uDividerColor, border * 0.5);
      }

      gl_FragColor = color;
    }
  `,
};

// ============================================================
// CAGE SHADERS
// ============================================================
export const cageVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  varying float vEdgeFactor;
  void main() {
    vec3 pos = position;
    float pulse = sin(uTime * 0.3) * 0.005 * uPulse;
    pos *= 1.0 + pulse;
    vEdgeFactor = position.y * 0.5 + 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const cageFragment = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vEdgeFactor;
  void main() {
    float alpha = uOpacity * (0.6 + vEdgeFactor * 0.4);
    gl_FragColor = vec4(uColor, alpha);
  }
`;
