import * as THREE from 'three'
import type { SubjectKey } from '../data'
import { GLSL_HELPERS, GLSL_PERLIN } from './glsl'

// ───────────────────────────────────────────────────────────────────────────────
// 果实 / 石头材质：温润玉石、半透明玛瑙
//
// 这是一个完整的 ShaderMaterial（不走 PBR），因为我们要的不是「物理正确」，而是「看起来像有光
// 在石头里面」。用到的都是实时可负担的近似：
//
//  ① 假折射：把视线 refract 进石头内部，在更深处取噪声 → 随视角移动时纹理会「在里面滑动」，
//     这是玉石和贴图塑料最直观的区别（视差深度感）。
//  ② 玛瑙环带：围绕偏心中心的同心 sin 条带，用 FBM 扭曲 → 天然玛瑙的等高线。
//  ③ 次表面散射（Fast SSS, Barré-Brisebois 2011）：
//       透射项  pow(dot(V, -(L + N*distortion)), power) * scale
//       包裹漫反射 (N·L + wrap)/(1+wrap)：明暗交界线变软，暗面被 SSS 色「漏」进去。
//  ④ 内发光：pow(N·V, 2.2) 的中心辉光，石头像被从里面点亮（兼顾「发光石头」的设定）。
//  ⑤ 蜡质高光：一个宽而弱的主瓣 + 一个很小的亮点，再乘一层湿润噪声 → 不是玻璃珠的硬高光。
//  ⑥ 淡菲涅尔轮廓：只在边缘 3 次幂，强度 0.1–0.2。
//
// 形状在顶点着色器里生成：单位球方向 → 鹅卵石（低频噪声鼓包）或苹果（肩宽、底窄、顶部凹窝），
// 法线用有限差分重算，所以几何面数很低也不会看到棱面。uApple 从 1→0 即「果实化成石头」。
//
// ── 「高级有机感」调参速查 ────────────────────────────────────────────────────
//  uSpec ≤ 0.3、uShininess 18–30   高光「宽、低」才是蜡质 / 玉；> 0.6 立刻变玻璃珠。
//  uWrap 0.35–0.6                  越大明暗过渡越软，越像半透明；0 = 普通漫反射（塑料）。
//  uSSSScale 0.8–1.6, uSSSPower 3–6 透射范围。power 小 → 光漏得多、整体偏通透；大 → 只在薄边透光。
//  uDepth 0.3–0.7                  折射深度。越大，转动视角时内部纹理滑动越明显。
//  uBandMix                        0=云雾（玉）；1=条带（玛瑙）；中间=混合。
//  颜色：deep/light 两色明度差拉开、饱和度压低；SSS 色比 light 更暖、更亮 —— 光穿过石头会变暖。
//  uLump 0.04–0.09                 鹅卵石不规则程度。永远不要 0。
// ───────────────────────────────────────────────────────────────────────────────

export type GemKind = SubjectKey | 'rainbow'

export interface GemPreset {
  deep: string
  light: string
  sss: string
  glow: string
  bandMix: number
  bandFreq: number
  warp: number
  iridescence: number
}

// 学科对应：语文=红玛瑙，数学=黄水晶(柠檬石英)，英语=蓝玉髓，生活=绿松石。
// 全部压低饱和度；「红」是陶红、「蓝」是雾蓝，和 tree.md 的颜色身份一致但不刺眼。
export const GEM_PRESETS: Record<GemKind, GemPreset> = {
  chinese: {
    deep: '#6e231f',
    light: '#d4684e',
    sss: '#ff9068',
    glow: '#ff7a55',
    bandMix: 0.5,
    bandFreq: 2.2,
    warp: 0.7,
    iridescence: 0,
  },
  math: {
    deep: '#8a5a10',
    light: '#ecc25a',
    sss: '#ffd988',
    glow: '#ffcb5c',
    bandMix: 0.25,
    bandFreq: 2.2,
    warp: 0.4,
    iridescence: 0,
  },
  english: {
    deep: '#274a86',
    light: '#86abda',
    sss: '#9ed0ff',
    glow: '#7db8ff',
    bandMix: 0.4,
    bandFreq: 2.0,
    warp: 0.65,
    iridescence: 0,
  },
  life: {
    deep: '#1f7f76',
    light: '#86d4c2',
    sss: '#a6f2dd',
    glow: '#7fe6cc',
    bandMix: 0.12,
    bandFreq: 1.8,
    warp: 0.35,
    iridescence: 0,
  },
  rainbow: {
    deep: '#5a4b86',
    light: '#e6c9e8',
    sss: '#ffe2f2',
    glow: '#f3d0ff',
    bandMix: 0.4,
    bandFreq: 2.0,
    warp: 0.65,
    iridescence: 0.85,
  },
}

/** 场景主光方向（世界空间，指向光源）。和场景里的 directionalLight 保持一致，高光 / 透射才对得上。 */
export const KEY_LIGHT_DIR = new THREE.Vector3(0.55, 0.8, 0.45).normalize()
export const KEY_LIGHT_COLOR = new THREE.Color('#ffe3b0')
export const AMBIENT_SKY = new THREE.Color('#9db98a').multiplyScalar(0.42)

type Uni<T> = THREE.IUniform<T>

export type GemUniforms = {
  uTime: Uni<number>
  uSeed: Uni<number>
  uRadius: Uni<number>
  uApple: Uni<number>
  uLump: Uni<number>
  uFlash: Uni<number>
  uOpacity: Uni<number>
  uColorDeep: Uni<THREE.Color>
  uColorLight: Uni<THREE.Color>
  uSSSColor: Uni<THREE.Color>
  uGlowColor: Uni<THREE.Color>
  uBandMix: Uni<number>
  uBandFreq: Uni<number>
  uWarp: Uni<number>
  uIridescence: Uni<number>
  uDepth: Uni<number>
  uIor: Uni<number>
  uWrap: Uni<number>
  uDistortion: Uni<number>
  uSSSPower: Uni<number>
  uSSSScale: Uni<number>
  uGlow: Uni<number>
  uRim: Uni<number>
  uSpec: Uni<number>
  uShininess: Uni<number>
  uLightDir: Uni<THREE.Vector3>
  uLightColor: Uni<THREE.Color>
  uAmbient: Uni<THREE.Color>
}

/** 把预设写进已有的 uniforms（果实 → 石头换色、复用对象池时用）。 */
export function applyGemPreset(u: GemUniforms, p: GemPreset): void {
  u.uColorDeep.value.set(p.deep)
  u.uColorLight.value.set(p.light)
  u.uSSSColor.value.set(p.sss)
  u.uGlowColor.value.set(p.glow)
  u.uBandMix.value = p.bandMix
  u.uBandFreq.value = p.bandFreq
  u.uWarp.value = p.warp
  u.uIridescence.value = p.iridescence
}

/** 挂在树上的「苹果」看起来更像水果：条带弱、云雾强，仍保留玉质的透光。 */
export function appleVariant(p: GemPreset): GemPreset {
  return { ...p, bandMix: Math.min(p.bandMix, 0.14), warp: 0.28, bandFreq: 1.8 }
}

const VERT = /* glsl */ `
uniform float uRadius;
uniform float uSeed;
uniform float uApple;
uniform float uLump;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vObj;
${GLSL_PERLIN}

// 单位方向 n → 表面点。只依赖 n，所以可以用相邻方向做有限差分求法线。
vec3 ttShape(vec3 n) {
  vec3 p = n * uRadius;

  // 鹅卵石：两层低频噪声鼓包，相对半径 ±uLump。
  float lump = cnoise(n * 1.6 + uSeed) * 0.5 + cnoise(n * 3.4 + uSeed * 1.7) * 0.25;
  p *= 1.0 + uLump * lump;

  // 苹果：肩部外扩、底部收窄、顶部凹窝。uApple=0 时全部为 0，退化成鹅卵石。
  float up = n.y;
  float shoulder = smoothstep(-0.3, 0.75, up);
  float bottom = smoothstep(0.1, -1.0, up);
  p.xz *= 1.0 + uApple * (0.10 * shoulder - 0.10 * bottom);
  float dimple = exp(-pow(length(p.xz) / (0.30 * uRadius), 2.0)) * smoothstep(0.2, 0.9, up);
  p.y -= uApple * 0.38 * uRadius * dimple;
  p.y *= 1.0 - 0.06 * uApple;
  return p;
}

void main() {
  vec3 n = normalize(position);
  vec3 t1 = normalize(cross(n, abs(n.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(n, t1);
  const float e = 0.012;

  vec3 p0 = ttShape(n);
  vec3 p1 = ttShape(normalize(n + t1 * e));
  vec3 p2 = ttShape(normalize(n + t2 * e));
  vec3 nn = normalize(cross(p1 - p0, p2 - p0));   // cross(t1, t2) = n，所以朝外

  vObj = p0;
  vWNormal = normalize(mat3(modelMatrix) * nn);    // 仅支持等比缩放
  vec4 w = modelMatrix * vec4(p0, 1.0);
  vWPos = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uRadius;
uniform float uBandMix;
uniform float uBandFreq;
uniform float uWarp;
uniform float uDepth;
uniform float uIor;
uniform float uWrap;
uniform float uDistortion;
uniform float uSSSPower;
uniform float uSSSScale;
uniform float uGlow;
uniform float uRim;
uniform float uSpec;
uniform float uShininess;
uniform float uIridescence;
uniform float uFlash;
uniform float uOpacity;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform vec3 uColorDeep;
uniform vec3 uColorLight;
uniform vec3 uSSSColor;
uniform vec3 uGlowColor;
varying vec3 vWPos;
varying vec3 vWNormal;
varying vec3 vObj;
${GLSL_PERLIN}
${GLSL_HELPERS}

void main() {
  vec3 N = normalize(vWNormal);
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 L = normalize(uLightDir);
  float ndv = clamp(dot(N, V), 0.0, 1.0);

  // ① 假折射：视线折进石头，在更深处取样。
  vec3 R = refract(-V, N, 1.0 / uIor);
  vec3 inner = vObj + R * uDepth * uRadius + uSeed;

  // ② 玛瑙环带 + 云雾
  float warp = ttFbm(inner * 1.3) * uWarp;
  float r = length(inner * vec3(1.0, 1.12, 1.0));
  float bands = 0.5 + 0.5 * sin((r * uBandFreq / max(uRadius, 0.001) + warp) * 6.28318);
  bands = smoothstep(0.15, 0.85, bands);
  float cloud = ttFbm(inner * 1.7 / max(uRadius, 0.001) + 4.0) * 0.5 + 0.5;
  float tone = mix(cloud, bands * (0.7 + 0.3 * cloud), uBandMix);
  // 压缩色阶：两端各留 16% 余量，条带不会一路顶到最深 / 最浅，避免「糖果条纹」。
  vec3 base = mix(uColorDeep, uColorLight, 0.16 + 0.68 * tone);

  // 虹彩（仅彩虹果）：余弦调色板随视角 / 内部纹理走色，再压一点饱和度，避免荧光感。
  vec3 irid = ttPalette(tone * 0.8 + ndv * 0.6 + uTime * 0.03);
  irid = mix(vec3(dot(irid, vec3(0.333))), irid, 0.7);
  base = mix(base, irid * (0.6 + 0.4 * tone), uIridescence);

  // ③ SSS
  float thick = pow(ndv, 0.8);                                       // 中心厚、边缘薄
  float wrapD = clamp((dot(N, L) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  vec3 diffuse = base * (uAmbient + uLightColor * wrapD);
  vec3 H = normalize(L + N * uDistortion);
  float trans = pow(clamp(dot(V, -H), 0.0, 1.0), uSSSPower) * uSSSScale;
  vec3 sss = uSSSColor * trans * (0.35 + 0.65 * (1.0 - thick)) * (0.6 + 0.4 * cloud);
  // 暗面「漏光」：背光侧被 SSS 色轻轻染一层，明暗交界不再发灰。
  diffuse += uSSSColor * 0.16 * pow(1.0 - wrapD, 1.5) * uSSSScale * 0.6;

  // ④ 内发光
  vec3 glow = uGlowColor * pow(ndv, 2.2) * uGlow * (0.55 + 0.45 * cloud);

  // ⑤ 蜡质高光
  vec3 Hh = normalize(L + V);
  float nh = clamp(dot(N, Hh), 0.0, 1.0);
  float wet = 0.65 + 0.35 * cnoise(vObj * 3.0 / max(uRadius, 0.001) + uSeed);
  float spec = (pow(nh, uShininess) * 0.28 + pow(nh, uShininess * 6.0) * 0.55) * uSpec * wet;

  // ⑥ 淡菲涅尔
  float fres = pow(1.0 - ndv, 3.0);
  vec3 rim = mix(uColorLight, vec3(1.0), 0.45) * fres * uRim;

  vec3 col = diffuse + sss + glow + rim + uLightColor * spec + uGlowColor * uFlash;

  // 抖动：8-bit 输出下平滑渐变会出现色带，加 ±0.5/255 的噪点抹掉。
  col += (ttHash12(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export interface GemOptions {
  preset: GemPreset
  seed?: number
  radius?: number
  /** 1=苹果，0=鹅卵石。 */
  apple?: number
}

export interface GemHandle {
  material: THREE.ShaderMaterial
  uniforms: GemUniforms
}

export function createGemMaterial(opts: GemOptions): GemHandle {
  const p = opts.preset
  const uniforms: GemUniforms = {
    uTime: { value: 0 },
    uSeed: { value: opts.seed ?? 1 },
    uRadius: { value: opts.radius ?? 0.26 },
    uApple: { value: opts.apple ?? 0 },
    uLump: { value: 0.065 },
    uFlash: { value: 0 },

    uColorDeep: { value: new THREE.Color(p.deep) },
    uColorLight: { value: new THREE.Color(p.light) },
    uSSSColor: { value: new THREE.Color(p.sss) },
    uGlowColor: { value: new THREE.Color(p.glow) },
    uBandMix: { value: p.bandMix },
    uBandFreq: { value: p.bandFreq },
    uWarp: { value: p.warp },
    uIridescence: { value: p.iridescence },

    uDepth: { value: 0.5 },
    uIor: { value: 1.55 },
    uWrap: { value: 0.45 },
    uDistortion: { value: 0.35 },
    uSSSPower: { value: 4 },
    uSSSScale: { value: 1.15 },
    uGlow: { value: 0.32 },
    uRim: { value: 0.16 },
    uSpec: { value: 0.26 },
    uShininess: { value: 22 },
    uOpacity: { value: 1 },

    uLightDir: { value: KEY_LIGHT_DIR },
    uLightColor: { value: KEY_LIGHT_COLOR },
    uAmbient: { value: AMBIENT_SKY },
  }
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms })
  return { material, uniforms }
}
