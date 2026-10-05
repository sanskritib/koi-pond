import * as THREE from 'three';
import { POND, SUN_DIR } from './config';
import { NOISE_GLSL } from './noise';

export const MAX_SHADOWS = 24;

// Pond bed: pebbly sand, moving caustics, and soft shadows under the fish and lily pads.
export function createFloor(time: THREE.IUniform<number>, shadows: THREE.Vector4[]): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(POND.rx * 2.2, POND.rz * 2.2, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uRadii: { value: new THREE.Vector2(POND.rx, POND.rz) },
      uShadows: { value: shadows },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
      uSandA: { value: new THREE.Color('#8c7b5a') },
      uSandB: { value: new THREE.Color('#55614a') },
      uDeep: { value: new THREE.Color('#123b3a') },
      uCaustic: { value: new THREE.Color('#d8f3e6') },
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
      #define MAX_SHADOWS ${MAX_SHADOWS}
      #define TAU 6.28318530718
      uniform float uTime;
      uniform vec2 uRadii;
      uniform vec4 uShadows[MAX_SHADOWS];
      uniform vec3 uSunDir;
      uniform vec3 uSandA;
      uniform vec3 uSandB;
      uniform vec3 uDeep;
      uniform vec3 uCaustic;
      varying vec3 vWorld;
      ${NOISE_GLSL}

      // Tileable water caustic (after Dave Hoskins / joltz0r).
      float caustic(vec2 uv, float time) {
        vec2 p = mod(uv * TAU, TAU) - 250.0;
        vec2 i = p;
        float c = 1.0;
        float inten = 0.005;
        for (int n = 0; n < 5; n++) {
          float t = time * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
        }
        c /= 5.0;
        c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.0);
      }

      void main() {
        vec2 p = vWorld.xz;
        vec2 q = p / (uRadii * 1.05);
        float e2 = dot(q, q);
        if (e2 > 1.0) discard;

        float big = fbm(p * 0.3 + 11.0);
        float peb = fbm(p * 2.6);
        vec3 col = mix(uSandA, uSandB, big);
        col *= 0.8 + 0.4 * smoothstep(0.45, 0.8, peb);

        float c = clamp(caustic(p * 0.16, uTime * 0.4), 0.0, 1.0);

        // Soft blob shadows, pushed away from the sun.
        float sh = 0.0;
        vec2 off = -uSunDir.xz / uSunDir.y * 1.2;
        for (int i = 0; i < MAX_SHADOWS; i++) {
          vec4 s = uShadows[i];
          if (s.w <= 0.0) continue;
          float d = length(p - (s.xy + off)) / s.z;
          sh = max(sh, s.w * (1.0 - smoothstep(0.3, 1.0, d)));
        }

        float depth = smoothstep(1.0, 0.15, e2);
        col = mix(col, uDeep, depth * 0.55);
        col += uCaustic * c * 0.45 * (1.0 - sh);
        col *= 1.0 - sh * 0.5;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = POND.floorY;
  mesh.renderOrder = 0;
  return mesh;
}
