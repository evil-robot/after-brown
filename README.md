# after-brown

**[portrait.artistsandrobots.com](https://portrait.artistsandrobots.com)**

Your face is made of data. This lets it behave like data.

![after-brown](docs/preview.png)

---

## Glenn Brown

Glenn Brown is one of the most technically extraordinary painters alive. He takes existing works: Rembrandt, Dali, Auerbach, Fragonard. He transforms them into something that looks like it was painted in a frenzy of gesture and impasto, except the surface is completely smooth. Not a single raised brushstroke. The chaos is an illusion. The control underneath it is total.

What gets me about Brown is the gap between what you see and what is actually there. A painting that looks like it was made in grief or ecstasy, painted with a patience and precision that is almost inhuman. The distortion is always faithful to something. The source is always visible underneath the transformation.

That tension between structure and dissolution, between control and apparent chaos, is what this project is about.

---

## What it does

Drop a portrait photo. Your face dissolves into a continuous animated particle system. It does not stop moving. The geometry of you is preserved but the surface behaves like liquid, drifting and reforming in real time. The animation is painterly in the way it moves: not mechanical or physics-based, but driven by layered simplex noise that gives it the quality of a hand moving through wet paint. The figure breathes. It smears. It drips. It does not resolve.

Controls:
- **T**: triptych mode
- **S**: scream
- **R**: reset
- **drop image**: map your own photo onto the surface

Nothing leaves the browser.

---

## How it works

Three.js + custom GLSL shaders. Four layered mesh passes on a single icosahedron geometry create the sense of flesh that is simultaneously present and dissolving.

Each mesh is displaced in real time by 3D simplex noise. The vertex shader has five named stages, each one a direct translation of a painterly technique:

```glsl
// === LOW-FREQUENCY DIRECTIONAL SMEAR ===
// Like a hand dragging across wet paint — the squeegee effect
vec3 smearDir = normalize(vec3(uMouse.x * 0.7, uMouse.y * 0.3 + 0.1, 0.3));
float smearNoise = snoise(pos * 0.8 + uTime * 0.06 + uNoiseOffset);
float directionalFactor = dot(normalize(norm), smearDir) * 0.5 + 0.5;
float smearAmount = smearNoise * directionalFactor * uSmearStrength;
pos += smearDir * smearAmount;

// === HIGH-FREQUENCY CHURNING ===
// The boiling, writhing quality of the flesh
float churn1 = snoise(pos * uNoiseScale + uTime * 0.12 + uNoiseOffset);
float churn2 = snoise(pos * uNoiseScale * 2.1 + uTime * 0.08 - uNoiseOffset * 0.5);
float churnDisplacement = (churn1 * 0.7 + churn2 * 0.3) * (0.12 + uAudioLevel * 0.35);
pos += norm * churnDisplacement;

// === DRIPPING ===
// Heavily displaced vertices start to slide downward
// Like wet oil paint running down a vertical canvas
float dripChannel = snoise(vec3(pos.x * 5.0, 0.0, pos.z * 5.0 + uNoiseOffset)) * 0.5 + 0.5;
dripChannel = pow(dripChannel, 2.0); // Concentrate into narrow channels
float drip = rawDrip * dripChannel * uDripAmount;
pos.y -= drip * (0.8 + uAudioLevel * 0.5);
```

The post-processing pass simulates the physical surface of an oil painting:

```glsl
// === OIL PAINT CANVAS TEXTURE ===
// Linen weave pattern — horizontal and vertical threads
float threadH = sin(vUv.x * 900.0) * 0.5 + 0.5;
float threadV = sin(vUv.y * 700.0) * 0.5 + 0.5;
float weave = threadH * threadV;
// Impasto effect — brighter areas have more texture (thick paint catches light)
float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
float impasto = canvas * brightness * 2.0;
color.rgb += impasto * uCanvasIntensity * 0.02;
```

In triptych mode, each panel is treated as a separate study with its own temporal quality:

```ts
// Left panel: more smeared, past-tense, dragged
{ smearMultiplier: 1.4, noiseOffsetShift: -2.0, screamMultiplier: 0.7 }

// Center panel: primary, most present
{ smearMultiplier: 1.0, noiseOffsetShift: 0.0, screamMultiplier: 1.0 }

// Right panel: fevered, intense, more violent
{ smearMultiplier: 1.2, noiseOffsetShift: 4.5, screamMultiplier: 1.4 }
```

---

## Why

I've been thinking about Glenn Brown's work for a long time. The idea that the most faithful reproduction of something might also be the most transformed version of it. That data and paint have more in common than they appear to. That a face is already a kind of data, and data already has a kind of face.

Brown takes a source, a Rembrandt or a Dali, and makes it behave differently while remaining recognizable. That is exactly what this does with a photograph. The face is still yours. It just isn't pretending to be solid anymore.

---

An [Artists & Robots](https://artistsandrobots.com) project by [Jason Alan Snyder](https://evilrobot.com).
