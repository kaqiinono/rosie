import * as THREE from 'three'
import { GLSL_HELPERS, GLSL_PERLIN } from './glsl'

// ───────────────────────────────────────────────────────────────────────────────
// 时间年轮涟漪：彩枝缩回树干那一刻，在交界处向外扩散的一圈微弱发光环
//
// 实现：一块水平放置的 2×2 平面（以树干轴线为中心），片元着色器按半径画一圈软边环。
//   · 半径：从树干表面 uInnerR 出发，用 easeOutExpo 的进度推到 uMaxR（先快后慢，像水波）。
//   · 宽度：随进度变宽，同时强度按 (1-p)^1.6 衰减 → 扩散出去就淡。
//   · 噪声：沿角度用 Perlin 把环的半径 / 亮度抖一点，避免「完美圆 = 矢量图」。
//   · 混合：浅色雾景用 NormalBlending + 琥珀色；深色夜景换 AdditiveBlending 才会真正「发光」。
//   · 第二道尾波：落后主环 0.18 的更弱、更宽的一圈，像余震。
//
// ── 调参速查 ──────────────────────────────────────────────────────────────────
//  uStrength 0.35–0.6    「微弱」是关键。> 0.8 就变成游戏技能特效，破坏自然感。
//  uThickness 0.035–0.07 环宽（世界单位）。细 = 精致；粗 = 卡通。
//  duration 1.6–2.4s     太快会像冲击波，太慢孩子看不到。
//  颜色                  取暖金而非纯白；和树皮的 uRingGlow 同色，两者才会读成同一件事。
// ───────────────────────────────────────────────────────────────────────────────

type Uni<T> = THREE.IUniform<T>

export type RippleUniforms = {
  uProgress: Uni<number> // 已经过缓动的 0..1
  uInnerR: Uni<number>
  uMaxR: Uni<number>
  uThickness: Uni<number>
  uStrength: Uni<number>
  uColor: Uni<THREE.Color>
  uSeed: Uni<number>
  uTime: Uni<number>
}

const VERT = /* glsl */ `
varying vec2 vXY;
void main() {
  vXY = position.xy;   // PlaneGeometry(2,2)：[-1,1]
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
uniform float uProgress;
uniform float uInnerR;
uniform float uMaxR;
uniform float uThickness;
uniform float uStrength;
uniform float uSeed;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vXY;
${GLSL_PERLIN}
${GLSL_HELPERS}

float ttRing(float r, float center, float w) {
  float d = (r - center) / w;
  return exp(-d * d);
}

void main() {
  float r = length(vXY) * uMaxR;
  float ang = atan(vXY.y, vXY.x);
  float jitter = cnoise(vec3(cos(ang) * 1.5, sin(ang) * 1.5, uSeed + uTime * 0.4));

  float p = clamp(uProgress, 0.0, 1.0);
  float center = mix(uInnerR, uMaxR * 0.96, p) + jitter * 0.03 * p;
  float w = uThickness * (0.8 + 1.6 * p);

  float lead = ttRing(r, center, w);
  float tail = ttRing(r, center - 0.18 * p * (uMaxR - uInnerR), w * 2.2) * 0.35;
  float fade = pow(1.0 - p, 1.6) * smoothstep(0.0, 0.08, p);       // 起手淡入，扩散后淡出
  float inside = smoothstep(uInnerR - 0.02, uInnerR + 0.02, r);       // 不画进树干里面
  float breakup = 0.75 + 0.25 * jitter;

  float a = (lead + tail) * fade * inside * breakup * uStrength;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export interface RippleHandle {
  material: THREE.ShaderMaterial
  uniforms: RippleUniforms
}

export function createRippleMaterial(innerR: number, maxR: number): RippleHandle {
  const uniforms: RippleUniforms = {
    uProgress: { value: 0 },
    uInnerR: { value: innerR },
    uMaxR: { value: maxR },
    uThickness: { value: 0.05 },
    uStrength: { value: 0.62 },
    uColor: { value: new THREE.Color('#f2b13c') },
    uSeed: { value: Math.random() * 10 },
    uTime: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    // 浅色雾景里加色混合会被「吃掉」，所以用普通 alpha 混合 + 饱和一点的琥珀色；
    // 若放进暗色夜景，改回 THREE.AdditiveBlending 并把 uStrength 降到 0.35 即可。
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  })
  return { material, uniforms }
}
