import * as THREE from 'three'
import { damp } from './ease'
import { GLSL_HELPERS, GLSL_PERLIN } from './glsl'

// ───────────────────────────────────────────────────────────────────────────────
// 空气泡泡：顶点形变 + 菲涅尔流光 + 弹簧驱动
//
// 一个肥皂泡的三个特征，分别对应三处实现：
//  1. 被风吹得「扁平化拉伸」，体积基本守恒
//       → vertex：沿风向拉长 a = 1+uStretch，垂直方向缩 1/√a（a·(1/√a)² = 1 → 体积不变）。
//         法线按逆缩放矩阵变换，高光才会跟着形变走。
//  2. 拉伸松开后会「晃」
//       → vertex：Legendre P2 振型  P2(cosθ) = (3cos²θ − 1)/2，θ 为与风向夹角。
//         这是液滴 / 气泡最低阶的椭球振荡模态。幅度 uWobble 由 CPU 端阻尼弹簧给出。
//       → 另有一层极低幅度的 Perlin 表面波纹 uRipple（<0.02），让轮廓「呼吸」。
//  3. 表面流光
//       → fragment：菲涅尔 (1-N·V)^p 控制「边缘不透明、中心几乎全透」；
//         薄膜干涉用余弦调色板近似（厚度 = 低频噪声 + 视角项），再压低饱和度；
//         外加两处「窗口反光」小高光——真实泡泡里最容易认出来的细节。
//
// ── 「高级有机感」调参速查 ────────────────────────────────────────────────────
//  uFresnelPower 2.2–3.5   越大，只有最外圈亮，中心越透明；太小会像发白的塑料球。
//  uFilmSat 0.3–0.55       彩虹膜饱和度。> 0.7 立刻变荧光贴纸；0 = 玻璃球。
//  BubbleSpring.k/c        k 越大越「紧」；c 越小晃得越久。k=70, c=4.5 约 3 次可见摆动。
//  uOpacity 0.5–0.8        整体不透明度上限，被风吹的泡泡更透。
//  拉伸上限 0.35           超过会像面团被拉长而不是气泡被吹扁。
// ───────────────────────────────────────────────────────────────────────────────

type Uni<T> = THREE.IUniform<T>

export type BubbleUniforms = {
  uTime: Uni<number>
  uSeed: Uni<number>
  uStretch: Uni<number>
  uWindDir: Uni<THREE.Vector3>
  uWobble: Uni<number>
  uRipple: Uni<number>
  uFresnelPower: Uni<number>
  uFilmBase: Uni<THREE.Color>
  uFilmSat: Uni<number>
  uFilmScale: Uni<number>
  uOpacity: Uni<number>
  uLightDir: Uni<THREE.Vector3>
  uPop: Uni<number>
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uStretch;
uniform vec3 uWindDir;
uniform float uWobble;
uniform float uRipple;
uniform float uPop;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vObj;
${GLSL_PERLIN}

void main() {
  vec3 n0 = normalize(position);
  vec3 d = normalize(uWindDir);
  float a = 1.0 + uStretch;           // 风向拉长
  float b = inversesqrt(a);           // 垂直方向收窄 → 体积守恒

  // P2 振型 + 表面波纹
  float c = dot(n0, d);
  float p2 = 0.5 * (3.0 * c * c - 1.0);
  float rip = cnoise(n0 * 2.2 + vec3(uTime * 0.7, uSeed, uTime * 0.5)) * uRipple;
  vec3 P = position * (1.0 + uWobble * p2 + rip) * (1.0 + uPop * 0.25);

  float pd = dot(P, d);
  vec3 Ps = (P - pd * d) * b + d * (pd * a);

  // 非等比缩放的法线 = 逆缩放（沿 d 除以 a，垂直除以 b）
  float nd = dot(n0, d);
  vec3 nS = (n0 - nd * d) / b + d * (nd / a);

  vObj = n0;
  vWNormal = normalize(mat3(modelMatrix) * nS);
  vec4 w = modelMatrix * vec4(Ps, 1.0);
  vWPos = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uFresnelPower;
uniform float uFilmSat;
uniform float uFilmScale;
uniform float uOpacity;
uniform float uPop;
uniform vec3 uFilmBase;
uniform vec3 uLightDir;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vObj;
${GLSL_PERLIN}
${GLSL_HELPERS}

void main() {
  vec3 N = normalize(vWNormal);
  vec3 V = normalize(cameraPosition - vWPos);
  float ndv = clamp(dot(N, V), 0.0, 1.0);

  // 菲涅尔：边缘 1 → 中心 0。
  float fres = pow(1.0 - ndv, uFresnelPower);

  // 薄膜厚度：低频噪声缓慢流动 + 视角项（视角变，色相变，所以转动镜头时「流光」会走）。
  float thick = ttFbm(vObj * uFilmScale + vec3(uTime * 0.08, uSeed, -uTime * 0.05)) * 0.5 + 0.5;
  vec3 film = ttPalette(thick * 0.9 + (1.0 - ndv) * 0.55 + uTime * 0.02);
  film = mix(vec3(dot(film, vec3(0.333))), film, uFilmSat);      // 压饱和
  film = mix(uFilmBase, film, 0.55 + 0.45 * fres);

  // 两处窗口反光：主光方向的亮斑 + 对侧的一抹弱反光。
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);
  float hl1 = pow(clamp(dot(N, H), 0.0, 1.0), 90.0);
  vec3 L2 = normalize(vec3(-L.x, 0.25, -L.z));
  float hl2 = pow(clamp(dot(N, normalize(L2 + V)), 0.0, 1.0), 40.0) * 0.35;

  vec3 col = film * (0.6 + 0.4 * fres) + vec3(hl1 + hl2);
  float alpha = clamp(0.035 + fres * 0.9 + (hl1 + hl2) * 0.9, 0.0, 1.0) * uOpacity;
  alpha *= 1.0 - uPop;   // 破裂时整体淡出

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export interface BubbleHandle {
  material: THREE.ShaderMaterial
  uniforms: BubbleUniforms
}

export function createBubbleMaterial(seed = 1): BubbleHandle {
  const uniforms: BubbleUniforms = {
    uTime: { value: 0 },
    uSeed: { value: seed },
    uStretch: { value: 0 },
    uWindDir: { value: new THREE.Vector3(1, 0, 0) },
    uWobble: { value: 0 },
    uRipple: { value: 0.014 },
    uFresnelPower: { value: 2.6 },
    uFilmBase: { value: new THREE.Color('#d4e6ee') },
    uFilmSat: { value: 0.55 },
    uFilmScale: { value: 1.6 },
    uOpacity: { value: 0.72 },
    uLightDir: { value: new THREE.Vector3(0.55, 0.8, 0.45).normalize() },
    uPop: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
  })
  return { material, uniforms }
}

// ───────────────────────────── 风 + 弹簧 ─────────────────────────────

export interface Wind {
  x: number
  z: number
  /** 0..1 */
  strength: number
}

/**
 * 一个廉价但自然的风场：两个不同频率的正弦叠加成阵风，再按位置错相，
 * 让相邻泡泡不是同步摆动。主风向略偏 +X，带一点 Z 的游移。
 */
export function windAt(t: number, px: number, pz: number): Wind {
  const gust = 0.5 + 0.5 * Math.sin(t * 0.7 + px * 0.9 + pz * 0.6)
  const flutter = 0.5 + 0.5 * Math.sin(t * 1.9 + px * 1.7 - pz * 1.1)
  const strength = Math.pow(gust, 1.6) * (0.7 + 0.3 * flutter)
  const ang = 0.35 * Math.sin(t * 0.31 + pz) + 0.25
  return { x: Math.cos(ang), z: Math.sin(ang), strength }
}

/**
 * 泡泡的二阶弹簧：
 *   stretch：目标 = strength × maxStretch，欠阻尼 → 风来时先冲过头再回弹（弹性扁平化）。
 *   wobble ：P2 振型的独立振子，被「风强度的变化率」推动 → 阵风一过、泡泡还会晃几下。
 */
export class BubbleSpring {
  private s = 0
  private sv = 0
  private w = 0
  private wv = 0
  private prevTarget = 0
  private dir = new THREE.Vector3(1, 0, 0)

  constructor(
    private readonly uniforms: BubbleUniforms,
    private readonly origin: { x: number; z: number },
    private readonly opts = {
      k: 70,
      c: 4.5,
      maxStretch: 0.3,
      wobbleK: 120,
      wobbleC: 3.2,
      kick: 0.9,
    },
  ) {}

  update(dt: number, t: number): void {
    const step = Math.min(dt, 1 / 30)
    const wind = windAt(t, this.origin.x, this.origin.z)
    const { k, c, maxStretch, wobbleK, wobbleC, kick } = this.opts

    const target = wind.strength * maxStretch
    // 半隐式欧拉：弹簧稳定、实现简单
    this.sv += (-k * (this.s - target) - c * this.sv) * step
    this.s += this.sv * step

    const dTarget = (target - this.prevTarget) / Math.max(step, 1e-4)
    this.prevTarget = target
    this.wv += (-wobbleK * this.w - wobbleC * this.wv + dTarget * kick) * step
    this.w += this.wv * step

    this.dir.set(wind.x, 0.12, wind.z).normalize()
    this.uniforms.uWindDir.value.lerp(this.dir, 1 - Math.exp(-3 * step))
    this.uniforms.uStretch.value = THREE.MathUtils.clamp(this.s, -0.1, maxStretch * 1.5)
    this.uniforms.uWobble.value = THREE.MathUtils.clamp(this.w, -0.18, 0.18)
    this.uniforms.uTime.value = t
  }

  /** 戳破 / 淡出辅助：把 uPop 平滑推向目标值。 */
  pop(target: number, dt: number): void {
    this.uniforms.uPop.value = damp(this.uniforms.uPop.value, target, 8, dt)
  }
}
