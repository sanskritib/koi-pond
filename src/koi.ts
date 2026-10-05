import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { POND, SUN_DIR, pondValue, randomPointInPond } from './config';
import { NOISE_GLSL } from './noise';
import type { RippleField } from './water';

const HALF = 0.6; // half the body length

interface Palette {
  base: string;
  patch: string;
  spot: string;
  patchAmt: number;
  spotAmt: number;
}

// Add your own koi here.
const PALETTES: Palette[] = [
  { base: '#f3eee4', patch: '#e2461b', spot: '#151515', patchAmt: 1, spotAmt: 0 }, // kohaku: white + red
  { base: '#f3eee4', patch: '#df4a1c', spot: '#141414', patchAmt: 1, spotAmt: 1 }, // sanke: + black spots
  { base: '#f2b13c', patch: '#ffd987', spot: '#000000', patchAmt: 0.7, spotAmt: 0 }, // ogon: gold
  { base: '#1a1a1a', patch: '#e4521f', spot: '#f2ece2', patchAmt: 1, spotAmt: 0.9 }, // showa: black base
  { base: '#ff7b2e', patch: '#fff3e6', spot: '#000000', patchAmt: 0.8, spotAmt: 0 }, // orange + white
];

function tagFin(geo: THREE.BufferGeometry, fin: number): THREE.BufferGeometry {
  const n = geo.getAttribute('position').count;
  geo.setAttribute('aFin', new THREE.Float32BufferAttribute(new Float32Array(n).fill(fin), 1));
  return geo;
}

function buildKoiGeometry(): THREE.BufferGeometry {
  // Body: a sphere stretched along x (head at +x) that tapers toward the tail.
  const body = new THREE.SphereGeometry(1, 32, 18);
  const pos = body.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const taper = 0.3 + 0.7 * THREE.MathUtils.smoothstep(x, -1, 0.3);
    pos.setXYZ(i, x * HALF, y * 0.12 * taper, z * 0.19 * taper);
  }
  body.computeVertexNormals();
  tagFin(body, 0);

  // Tail fin, flat so you see it from above.
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0.04, 0);
  tailShape.quadraticCurveTo(-0.12, 0.1, -0.36, 0.24);
  tailShape.quadraticCurveTo(-0.26, 0.0, -0.36, -0.24);
  tailShape.quadraticCurveTo(-0.12, -0.1, 0.04, 0);
  const tail = new THREE.ShapeGeometry(tailShape, 10);
  tail.rotateX(-Math.PI / 2);
  tail.translate(-HALF * 0.88, 0, 0);
  tagFin(tail, 1);

  // Pectoral fins.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.quadraticCurveTo(0.06, 0.16, -0.1, 0.2);
  finShape.quadraticCurveTo(-0.09, 0.06, 0, 0);
  const finL = new THREE.ShapeGeometry(finShape, 6);
  finL.rotateX(-Math.PI / 2);
  finL.translate(HALF * 0.35, -0.02, -0.1);
  const finR = new THREE.ShapeGeometry(finShape, 6);
  finR.scale(1, -1, 1);
  finR.rotateX(-Math.PI / 2);
  finR.translate(HALF * 0.35, -0.02, 0.1);
  tagFin(finL, 1);
  tagFin(finR, 1);

  const merged = mergeGeometries([body, tail, finL, finR], false);
  if (!merged) throw new Error('could not build koi geometry');
  return merged;
}

function makeKoiMaterial(p: Palette, sun: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      uPhase: { value: 0 },
      uBend: { value: 0 },
      uSeed: { value: Math.random() * 100 },
      uBase: { value: new THREE.Color(p.base) },
      uPatch: { value: new THREE.Color(p.patch) },
      uSpot: { value: new THREE.Color(p.spot) },
      uPatchAmt: { value: p.patchAmt },
      uSpotAmt: { value: p.spotAmt },
      uSunDir: { value: sun },
    },
    vertexShader: /* glsl */ `
      attribute float aFin;
      uniform float uPhase;
      uniform float uBend;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      varying float vFin;
      void main() {
        vec3 p = position;
        // k is 0 at the head and grows toward the tail, so the tail does the swimming.
        float k = clamp((${HALF.toFixed(2)} - p.x) / ${(HALF * 2).toFixed(2)}, 0.0, 1.4);
        p.z += sin(uPhase - p.x * 5.0) * 0.12 * k * k;
        p.z += uBend * k * k * 0.25;
        vLocal = position;
        vFin = aFin;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSeed;
      uniform vec3 uBase;
      uniform vec3 uPatch;
      uniform vec3 uSpot;
      uniform float uPatchAmt;
      uniform float uSpotAmt;
      uniform vec3 uSunDir;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      varying float vFin;
      ${NOISE_GLSL}
      void main() {
        vec2 q = vLocal.xz * vec2(2.2, 4.0) + uSeed;
        float patchMask = smoothstep(0.48, 0.56, fbm(q)) * uPatchAmt;
        float spotMask = smoothstep(0.66, 0.72, vnoise(vLocal.xz * vec2(7.0, 9.0) + uSeed * 1.7)) * uSpotAmt;
        vec3 col = mix(uBase, uPatch, patchMask);
        col = mix(col, uSpot, spotMask);

        vec3 n = normalize(vNormalW);
        if (!gl_FrontFacing) n = -n;
        float diff = 0.5 + 0.5 * max(dot(n, normalize(uSunDir)), 0.0);
        vec3 lit = col * diff;

        float streak = 0.85 + 0.15 * sin(atan(vLocal.z, vLocal.x + 0.6) * 40.0);
        lit = mix(lit, mix(col, vec3(1.0), 0.45) * streak, vFin);
        lit = mix(lit, lit * vec3(0.75, 0.95, 0.95), 0.35); // a little water tint

        gl_FragColor = vec4(lit, mix(1.0, 0.55, vFin));
        #include <colorspace_fragment>
      }
    `,
  });
}

interface Fish {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  x: number;
  z: number;
  y: number;
  heading: number;
  base: number;
  speed: number;
  boost: number;
  tx: number;
  tz: number;
  phase: number;
  bend: number;
  scale: number;
  kiss: number;
}

export class KoiSchool {
  readonly group = new THREE.Group();
  readonly fish: Fish[] = [];

  constructor(count: number) {
    const geo = buildKoiGeometry();
    const sun = new THREE.Vector3(...SUN_DIR).normalize();
    for (let i = 0; i < count; i++) {
      const mat = makeKoiMaterial(PALETTES[i % PALETTES.length], sun);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 1;
      const scale = 0.8 + Math.random() * 0.55;
      mesh.scale.setScalar(scale);
      const [x, z] = randomPointInPond(0.7);
      const f: Fish = {
        mesh, mat, x, z,
        y: -0.3 - Math.random() * 0.7,
        heading: Math.random() * Math.PI * 2,
        base: 0.5 + Math.random() * 0.35,
        speed: 0, boost: 0, tx: 0, tz: 0,
        phase: Math.random() * 10, bend: 0, scale,
        kiss: 3 + Math.random() * 12,
      };
      this.pickTarget(f);
      this.group.add(mesh);
      this.fish.push(f);
    }
  }

  private pickTarget(f: Fish) {
    const [tx, tz] = randomPointInPond(0.78);
    f.tx = tx;
    f.tz = tz;
  }

  // Fish near a tap dart away from it.
  scatter(x: number, z: number) {
    for (const f of this.fish) {
      const dx = f.x - x, dz = f.z - z;
      const d = Math.hypot(dx, dz);
      if (d >= 4) continue;
      const a = Math.atan2(dz, dx);
      f.tx = x + Math.cos(a) * 5;
      f.tz = z + Math.sin(a) * 5;
      const v = pondValue(f.tx, f.tz);
      if (v > 0.6) {
        const k = Math.sqrt(0.6 / v);
        f.tx *= k;
        f.tz *= k;
      }
      f.boost = Math.max(f.boost, 2.2 * (1 - d / 4) + 0.6);
    }
  }

  update(dt: number, time: number, ripples: RippleField) {
    for (const f of this.fish) {
      let dx = f.tx - f.x, dz = f.tz - f.z;
      if (dx * dx + dz * dz < 1.2) {
        this.pickTarget(f);
        dx = f.tx - f.x;
        dz = f.tz - f.z;
      }
      const len = Math.hypot(dx, dz) || 1;
      let sx = dx / len, sz = dz / len;

      // Keep a little personal space.
      for (const o of this.fish) {
        if (o === f) continue;
        const ox = f.x - o.x, oz = f.z - o.z;
        const d2 = ox * ox + oz * oz;
        if (d2 < 1.4 && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          sx += (ox / d) * (1.2 - d) * 1.5;
          sz += (oz / d) * (1.2 - d) * 1.5;
        }
      }

      // Turn back before the edge.
      const e = pondValue(f.x, f.z);
      if (e > 0.7) {
        sx -= (f.x / POND.rx) * (e - 0.7) * 8;
        sz -= (f.z / POND.rz) * (e - 0.7) * 8;
      }

      const desired = Math.atan2(sz, sx);
      let diff = desired - f.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const maxTurn = (1.3 + f.boost * 1.5) * dt;
      f.heading += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);

      f.speed = f.base * (1 + f.boost);
      f.boost = Math.max(0, f.boost - dt * 0.9);
      f.x += Math.cos(f.heading) * f.speed * dt;
      f.z += Math.sin(f.heading) * f.speed * dt;

      f.phase += dt * (3.5 + f.speed * 6);
      f.bend += (THREE.MathUtils.clamp(diff * 0.9, -1, 1) - f.bend) * Math.min(1, dt * 3);
      f.mat.uniforms.uPhase.value = f.phase;
      f.mat.uniforms.uBend.value = f.bend;

      f.mesh.position.set(f.x, f.y + Math.sin(time * 0.4 + f.phase * 0.05) * 0.05, f.z);
      f.mesh.rotation.y = -f.heading;

      // Every so often a shallow fish nibbles at the surface.
      f.kiss -= dt;
      if (f.kiss <= 0) {
        f.kiss = 8 + Math.random() * 14;
        if (f.y > -0.55) {
          ripples.add(
            f.x + Math.cos(f.heading) * HALF * f.scale,
            f.z + Math.sin(f.heading) * HALF * f.scale,
            0.22,
            time,
          );
        }
      }
    }
  }

  writeShadows(out: THREE.Vector4[], start: number): number {
    let i = start;
    for (const f of this.fish) {
      if (i >= out.length) break;
      out[i++].set(f.x, f.z, 0.42 * f.scale, 0.55);
    }
    return i;
  }
}
