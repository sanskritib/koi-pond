import * as THREE from 'three';
import { POND, SUN_DIR } from './config';

const MAX_RIPPLES = 32;

// A ring buffer of ripples: (x, z, start time, strength). The shader reads all of them.
export class RippleField {
  readonly data: THREE.Vector4[] = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -1000, 0));
  private next = 0;

  add(x: number, z: number, strength: number, time: number) {
    this.data[this.next].set(x, z, time, strength);
    this.next = (this.next + 1) % MAX_RIPPLES;
  }
}

export function createWater(ripples: RippleField, time: THREE.IUniform<number>): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(POND.rx * 2, POND.rz * 2, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: time,
      uRipples: { value: ripples.data },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
      uRadii: { value: new THREE.Vector2(POND.rx, POND.rz) },
      uTint: { value: new THREE.Color('#1f5f5c') },
      uHorizon: { value: new THREE.Color('#dcebe4') },
      uZenith: { value: new THREE.Color('#86b9c2') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      #define MAX_RIPPLES ${MAX_RIPPLES}
      uniform float uTime;
      uniform vec4 uRipples[MAX_RIPPLES];
      uniform vec3 uSunDir;
      uniform vec2 uRadii;
      uniform vec3 uTint;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vWorld;

      // Surface height: a few slow waves plus every live ripple ring.
      float height(vec2 p) {
        float t = uTime;
        float h = 0.018 * sin(p.x * 0.9 + t * 0.7)
                + 0.014 * sin(p.y * 1.3 - t * 0.55)
                + 0.008 * sin((p.x + p.y) * 2.1 + t * 1.3);
        for (int i = 0; i < MAX_RIPPLES; i++) {
          vec4 r = uRipples[i];
          float age = t - r.z;
          if (age < 0.0 || age > 5.0) continue;
          float d = distance(p, r.xy);
          float x = d - age * 1.7;            // 1.7 = how fast rings travel
          h += r.w * 0.06 * sin(x * 10.0) * exp(-x * x * 3.0) * exp(-age * 0.8) / (1.0 + d * 0.6);
        }
        return h;
      }

      void main() {
        vec2 p = vWorld.xz;
        vec2 q = p / uRadii;
        float e2 = dot(q, q);
        if (e2 > 1.0) discard;

        float eps = 0.04;
        float h0 = height(p);
        float hx = height(p + vec2(eps, 0.0));
        float hz = height(p + vec2(0.0, eps));
        vec3 n = normalize(vec3(-(hx - h0) / eps, 1.0, -(hz - h0) / eps));

        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uHorizon, uZenith, clamp(r.y, 0.0, 1.0));
        float sunDot = max(dot(reflect(-uSunDir, n), v), 0.0);
        float spec = pow(sunDot, 220.0) * 2.2;
        float glint = pow(sunDot, 24.0) * 0.12;

        float edge = smoothstep(0.8, 1.0, e2);
        vec3 col = mix(uTint, sky, fres) + spec + glint;
        float alpha = mix(0.28, 0.85, fres) + spec;
        alpha = mix(alpha, 0.9, edge * 0.6);
        col = mix(col, uTint * 0.6, edge * 0.4);

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = POND.waterY;
  mesh.renderOrder = 2;
  return mesh;
}
