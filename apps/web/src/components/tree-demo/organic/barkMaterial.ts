import * as THREE from 'three'
import { GLSL_HELPERS, GLSL_PERLIN } from './glsl'

// ───────────────────────────────────────────────────────────────────────────────
// 树干 / 彩枝材质
//
// 做法：在 three 的 MeshStandardMaterial（PBR，自带光照、雾、色调映射）上用 onBeforeCompile
// 「外科手术式」注入我们的 GLSL，而不是从零写 ShaderMaterial。这样：
//   1. 光照 / 雾 / 阴影免费，和场景里其它标准材质一致；
//   2. 只改我们关心的 5 个切入点：begin_vertex、map_fragment、roughnessmap_fragment、
//      normal_fragment_maps、emissivemap_fragment。
//
// 一份材质同时服务「树干」和「彩枝」，用 defines.TT_BRANCH 区分：
//   树干：沿 Y 轴，板根外扩 + 周向裂瓣 + 扭转 + 苔藓 + 年轮刻痕
//   彩枝：沿 X 轴（根 x=0 → 梢 x=length），蜿蜒偏移 + 节疤 + 生长 / 缩回(uGrow) + 衰老(uAge)
//
// ── 「高级有机感」调参速查（按影响从大到小）─────────────────────────────────────
//  uFiberStrength 0.35–0.6   木纹对比。越小越「干净」（塑料），越大越「脏」。0.45 左右最像参考图。
//  uFiberScale               各向异性：纤维方向的分量要小、其它分量要大 → 纵向纤维；
//                            三个分量接近 = 颗粒状石头，一定不要这样。
//  uBump 4–10                法线扰动强度。屏幕空间导数，镜头拉远会增强；远景用 3–4，近景 8。
//  bark 三色                 全部取低饱和（HSL 饱和度 < 35%）。参考图里最亮的绿是叶，不是树皮。
//  uMossAmount 0.2–0.45      树根向上的苔藓覆盖。参考图 1 的树根处苔藓是点睛之笔。
//  uFlare / uLobes           板根外扩 / 周向裂瓣。真实老树几乎没有「正圆柱」。
//  uWobble / 节疤            彩枝不要直。曲线偏差 5–8% 枝长就够了。
// ───────────────────────────────────────────────────────────────────────────────

export const TRUNK_RING_SLOTS = 8

type Uni<T> = THREE.IUniform<T>

export type BarkUniforms = {
  uTime: Uni<number>
  uSeed: Uni<number>
  // 几何
  uLength: Uni<number>
  uHeight: Uni<number>
  uGrow: Uni<number>
  uRadiusScale: Uni<number>
  uFlare: Uni<number>
  uLobes: Uni<number>
  uTwist: Uni<number>
  uWobble: Uni<number>
  // 树皮
  uBarkDark: Uni<THREE.Color>
  uBarkMid: Uni<THREE.Color>
  uBarkLight: Uni<THREE.Color>
  uMoss: Uni<THREE.Color>
  uMossAmount: Uni<number>
  uFiberScale: Uni<THREE.Vector3>
  uFiberStrength: Uni<number>
  uBump: Uni<number>
  // 彩枝上色
  uTint: Uni<THREE.Color>
  uTintMix: Uni<number>
  // 0 点衰老
  uAge: Uni<number>
  uAgeSoft: Uni<number>
  uMinOpacity: Uni<number>
  uDesat: Uni<number>
  uLinen: Uni<THREE.Color>
  uLinenMix: Uni<number>
  uEdgeColor: Uni<THREE.Color>
  uEdgeGlow: Uni<number>
  // 年轮
  uRingYs: Uni<number[]>
  uRingCount: Uni<number>
  uRingPulse: Uni<number>
  uRingPulseY: Uni<number>
  uRingGlow: Uni<THREE.Color>
}

export interface BarkOptions {
  kind: 'trunk' | 'branch'
  /** 树干：总高度。彩枝：枝长。 */
  length: number
  seed?: number
  /** 彩枝的周几颜色（粉彩）。树干忽略。 */
  tint?: string
}

export interface BarkHandle {
  material: THREE.MeshStandardMaterial
  uniforms: BarkUniforms
}

export function createBarkUniforms(opts: BarkOptions): BarkUniforms {
  const trunk = opts.kind === 'trunk'
  return {
    uTime: { value: 0 },
    uSeed: { value: opts.seed ?? 1 },
    uLength: { value: trunk ? 1 : opts.length },
    uHeight: { value: trunk ? opts.length : 1 },
    uGrow: { value: 1 },
    uRadiusScale: { value: 1 },
    uFlare: { value: trunk ? 0.85 : 0 },
    uLobes: { value: trunk ? 0.16 : 0 },
    uTwist: { value: trunk ? 0.5 : 0 },
    uWobble: { value: trunk ? 0 : opts.length * 0.07 },

    // 低饱和的橄榄褐。别用 #8b4513 这类「马鞍棕」——那就是塑料感的来源。
    uBarkDark: { value: new THREE.Color('#4a3d2b') },
    uBarkMid: { value: new THREE.Color('#847052') },
    uBarkLight: { value: new THREE.Color('#b3a07a') },
    uMoss: { value: new THREE.Color('#68763f') },
    uMossAmount: { value: trunk ? 0.38 : 0.1 },
    // 各向异性：纤维方向（树干 Y / 彩枝 X）频率低，其余方向频率高。
    uFiberScale: {
      value: trunk ? new THREE.Vector3(7, 0.9, 7) : new THREE.Vector3(0.9, 9, 9),
    },
    uFiberStrength: { value: 0.72 },
    uBump: { value: 6 },

    uTint: { value: new THREE.Color(opts.tint ?? '#a78bfa') },
    uTintMix: { value: trunk ? 0 : 0.55 },

    uAge: { value: 0 },
    uAgeSoft: { value: 0.2 },
    uMinOpacity: { value: 0.55 },
    uDesat: { value: 0.92 },
    // 亚麻褐：偏黄的灰褐，亮度不高。需要更「旧」就把它调暗并降低 uMinOpacity。
    uLinen: { value: new THREE.Color('#a8957a') },
    uLinenMix: { value: 0.78 },
    uEdgeColor: { value: new THREE.Color('#ffe7b0') },
    uEdgeGlow: { value: 0.55 },

    uRingYs: { value: new Array<number>(TRUNK_RING_SLOTS).fill(-10) },
    uRingCount: { value: 0 },
    uRingPulse: { value: 0 },
    uRingPulseY: { value: 0 },
    uRingGlow: { value: new THREE.Color('#ffd98a') },
  }
}

// ───────────────────────────── GLSL ─────────────────────────────

const VERT_HEADER = /* glsl */ `
uniform float uSeed;
uniform float uLength;
uniform float uHeight;
uniform float uGrow;
uniform float uRadiusScale;
uniform float uFlare;
uniform float uLobes;
uniform float uTwist;
uniform float uWobble;
varying vec3 vTtPos;
${GLSL_PERLIN}
`

// 替换 <begin_vertex>：所有形变都在这里，且只改 transformed，不动 position
// → vTtPos（未形变坐标）永远稳定，噪声贴图不会随生长 / 缩回而「游」。
const VERT_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
vTtPos = position;

#ifdef TT_BRANCH
  // t：沿枝 0（树干交界）→ 1（枝梢）
  float ttT0 = clamp(position.x / uLength, 0.0, 1.0);

  // 1) 粗细：衰老后变细（uRadiusScale）；刚长出来时更细（uGrow）。
  transformed.yz *= uRadiusScale * mix(0.55, 1.0, smoothstep(0.0, 1.0, uGrow));

  // 2) 蜿蜒：用两条互相独立的 Perlin 曲线推 y / z，越靠枝梢偏得越多。
  vec2 sway = vec2(
    cnoise(vec3(ttT0 * 2.2, uSeed, 1.7)),
    cnoise(vec3(ttT0 * 2.2, uSeed + 5.3, 9.1))
  ) * uWobble * ttT0;
  transformed.yz += sway;

  // 3) 节疤：噪声高处局部鼓起 28%，像老枝上的瘤。
  float knot = smoothstep(0.55, 1.0, cnoise(vec3(ttT0 * 5.0, uSeed * 1.3, 3.3)));
  transformed.yz *= 1.0 + knot * 0.28;

  // 4) 生长 / 缩回：沿 X 轴整体缩放。根部在原点，所以缩回时枝梢「退回树干」。
  transformed.x *= uGrow;
#else
  float ttH0 = clamp(position.y / uHeight, 0.0, 1.0);
  float ttAng = atan(position.z, position.x);

  // 板根：靠近地面按指数外扩，9.0 越大外扩越集中在最底部。
  float ttFlare = 1.0 + uFlare * exp(-ttH0 * 9.0);

  // 周向裂瓣：5 瓣正弦 + 沿圆周取样的噪声（用 cos/sin 采样保证首尾无缝），底部最强。
  float ttLobe = 0.6 * sin(ttAng * 5.0 + uSeed)
               + 0.4 * cnoise(vec3(cos(ttAng), sin(ttAng), ttH0 * 2.5 + uSeed) * 1.6);
  float ttLobes = 1.0 + uLobes * ttLobe * (0.35 + exp(-ttH0 * 5.0));

  // 轻微扭转：老树干的纤维会螺旋上升。
  float ttTw = uTwist * ttH0;
  float ttC = cos(ttTw);
  float ttS = sin(ttTw);
  transformed.xz = mat2(ttC, -ttS, ttS, ttC) * transformed.xz * ttFlare * ttLobes;
#endif
`

const FRAG_HEADER = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uLength;
uniform float uHeight;
uniform float uAge;
uniform float uAgeSoft;
uniform float uMinOpacity;
uniform float uDesat;
uniform float uLinenMix;
uniform float uEdgeGlow;
uniform float uTintMix;
uniform float uFiberStrength;
uniform float uBump;
uniform float uMossAmount;
uniform float uRingCount;
uniform float uRingPulse;
uniform float uRingPulseY;
uniform float uRingYs[${TRUNK_RING_SLOTS}];
uniform vec3 uBarkDark;
uniform vec3 uBarkMid;
uniform vec3 uBarkLight;
uniform vec3 uMoss;
uniform vec3 uLinen;
uniform vec3 uEdgeColor;
uniform vec3 uTint;
uniform vec3 uFiberScale;
uniform vec3 uRingGlow;
varying vec3 vTtPos;
${GLSL_PERLIN}
${GLSL_HELPERS}

// 木纤维高度场，值域约 [0,1]。
//   1. 域扭曲：先用低频噪声把采样点推歪 → 纤维不再是笔直的平行线，而是会分叉、会漂移。
//   2. 脊状噪声(1-|n|)平方：得到尖锐的「裂纹谷」，是树皮粗沟壑的来源。
//   3. 中频 / 高频 Perlin：细纤维和微颗粒，拉开层次。
// 三层权重 0.5 / 0.32 / 0.18：想要更「深裂」就加大第一项，想要更「细腻」就加大第三项。
float ttBarkH(vec3 p) {
  vec3 q = p * uFiberScale;
  q += 0.45 * vec3(
    cnoise(q * 0.35 + uSeed),
    cnoise(q * 0.35 + uSeed + 7.7),
    cnoise(q * 0.35 + uSeed + 3.1)
  );
  float ridge = 1.0 - abs(cnoise(q * 0.55));
  ridge *= ridge;
  float fiber = cnoise(q * 2.1) * 0.5 + 0.5;
  float micro = cnoise(q * 6.3) * 0.5 + 0.5;
  return ridge * 0.5 + fiber * 0.32 + micro * 0.18;
}

// 屏幕空间高度场 → 法线（与 three 的 perturbNormalArb 同一公式，自带一份以免依赖 USE_BUMPMAP）。
vec3 ttPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy) {
  vec3 vSigmaX = normalize(dFdx(surfPos));
  vec3 vSigmaY = normalize(dFdy(surfPos));
  vec3 R1 = cross(vSigmaY, surfNorm);
  vec3 R2 = cross(surfNorm, vSigmaX);
  float fDet = dot(vSigmaX, R1);
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surfNorm - vGrad);
}
`

// 追加在 <map_fragment> 之后：决定 diffuseColor（反照率）和 alpha。
const FRAG_ALBEDO = /* glsl */ `
#include <map_fragment>

float ttH = ttBarkH(vTtPos);
float ttHs = mix(0.5, ttH, uFiberStrength);   // 木纹强度：0.5 = 完全没纹理

// ── 年轮刻痕（仅树干）：每个已收起的历史枝在树干留一道环形凹槽 ──
float ttGroove = 0.0;
float ttPulse = 0.0;
#ifndef TT_BRANCH
  for (int i = 0; i < ${TRUNK_RING_SLOTS}; i++) {
    if (float(i) >= uRingCount) break;
    float dy = vTtPos.y - uRingYs[i];
    ttGroove += exp(-dy * dy / (0.035 * 0.035));
  }
  ttGroove = clamp(ttGroove, 0.0, 1.0);
  float pdy = vTtPos.y - uRingPulseY;
  ttPulse = exp(-pdy * pdy / (0.16 * 0.16)) * uRingPulse;
#endif

// ── 基础树皮：三色按高度场分段，避免平滑渐变带来的「塑料」。──
vec3 ttBark = mix(uBarkDark, uBarkMid, smoothstep(0.1, 0.45, ttHs));
ttBark = mix(ttBark, uBarkLight, smoothstep(0.38, 0.8, ttHs) * 0.8);

#ifndef TT_BRANCH
  // 苔藓：越靠近地面越多，再乘一层噪声让它成片、成斑而不是均匀刷色。
  float ttHt = clamp(vTtPos.y / uHeight, 0.0, 1.0);
  float ttMossNoise = cnoise(vTtPos * vec3(2.0, 1.2, 2.0) + uSeed) * 0.5 + 0.5;
  float ttMoss = smoothstep(0.5, 0.85, ttMossNoise + (1.0 - ttHt * 1.6) * 0.45);
  ttBark = mix(ttBark, uMoss * (0.75 + 0.5 * ttHs), ttMoss * uMossAmount);
#endif

ttBark *= 1.0 - 0.35 * ttGroove;
vec3 ttCol = ttBark;

#ifdef TT_BRANCH
  // 彩枝着色：保留树皮明度，只把色相推向周几颜色。乘数 0.62+0.9*luma 让深纹仍然是深的，
  // 这样彩枝看起来是「染了色的木头」而不是「涂了漆的塑料管」。
  float ttLuma0 = dot(ttBark, vec3(0.299, 0.587, 0.114));
  ttCol = mix(ttBark, uTint * (0.62 + 0.9 * ttLuma0), uTintMix);
#endif

// ── 0 点衰老（仅彩枝）──
// ttT：枝上位置 0(树干)→1(枝梢)。衰老前沿 ttFront 从 1+soft（尚未开始）扫到 -0.08（整枝已老），
// 即「沿 X 轴从末端向树干」推进。前沿位置叠一点噪声，让边界是参差的，不是一条直线。
float ttT = clamp(vTtPos.x / max(uLength, 0.001), 0.0, 1.0);
float ttFront = 1.0;
float ttAged = 0.0;
#ifdef TT_BRANCH
  ttFront = mix(1.0 + uAgeSoft, -0.08, uAge) + cnoise(vTtPos * 2.5 + uSeed) * 0.035;
  ttAged = smoothstep(ttFront - uAgeSoft, ttFront, ttT);
#endif

// 饱和度衰减：先向亮度灰靠拢，再向亚麻褐靠拢（乘亮度保留木纹明暗）。
float ttLuma = dot(ttCol, vec3(0.299, 0.587, 0.114));
ttCol = mix(ttCol, vec3(ttLuma), ttAged * uDesat);
ttCol = mix(ttCol, uLinen * (0.65 + 0.7 * ttLuma), ttAged * uLinenMix);

diffuseColor.rgb = ttCol;
// 透明度衰减：老枝不是消失，是「褪」到 uMinOpacity。
diffuseColor.a *= mix(1.0, uMinOpacity, ttAged);
`

const FRAG_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
// 凹处（高度低）更粗糙、凸处略光滑；衰老后更干涩。
roughnessFactor = clamp(roughnessFactor + (0.5 - ttHs) * 0.14 + ttAged * 0.1, 0.45, 1.0);
`

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  float ttHb = ttH - ttGroove * 0.6;          // 年轮凹槽下沉
  vec2 ttD = clamp(vec2(dFdx(ttHb), dFdy(ttHb)) * uBump, -0.6, 0.6);
  normal = ttPerturb(-vViewPosition, normal, ttD);
}
`

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
#ifdef TT_BRANCH
  // 衰老前沿一道很细的暖光：让孩子看见「时间正在从枝梢流向树干」。
  float ttEdgeVis = smoothstep(0.0, 0.05, uAge) * (1.0 - smoothstep(0.94, 1.0, uAge));
  float ttEdge = exp(-pow((ttT - ttFront) / 0.05, 2.0));
  totalEmissiveRadiance += uEdgeColor * uEdgeGlow * ttEdge * ttEdgeVis;
#else
  // 年轮涟漪经过时，树皮自己微微透出暖光。
  totalEmissiveRadiance += uRingGlow * ttPulse * 0.55;
#endif
`

export function createBarkMaterial(opts: BarkOptions): BarkHandle {
  const uniforms = createBarkUniforms(opts)
  const branch = opts.kind === 'branch'
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
    metalness: 0,
    transparent: branch, // 衰老要用到 alpha
  })
  if (branch) material.defines = { TT_BRANCH: '' }
  material.customProgramCacheKey = () => `tt-bark-${opts.kind}`

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${VERT_HEADER}\nvoid main() {`)
      .replace('#include <begin_vertex>', VERT_BEGIN)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FRAG_HEADER}\nvoid main() {`)
      .replace('#include <map_fragment>', FRAG_ALBEDO)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGHNESS)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
  }
  return { material, uniforms }
}

/**
 * 树干年轮控制器：管「涟漪经过时树皮的暖光脉冲」和「永久留下的环形刻痕」。
 * 每帧调用 update(dt)。
 */
export class TrunkRings {
  private readonly ys: number[] = []

  constructor(private readonly uniforms: BarkUniforms) {}

  get count(): number {
    return this.ys.length
  }

  /** 涟漪经过：暖光脉冲，之后指数衰减。 */
  pulse(y: number): void {
    this.uniforms.uRingPulseY.value = y
    this.uniforms.uRingPulse.value = 1
  }

  /** 把一圈年轮永久刻进树干（最多 TRUNK_RING_SLOTS 圈，超出时丢掉最老的）。 */
  addRing(y: number): void {
    if (this.ys.length >= TRUNK_RING_SLOTS) this.ys.shift()
    this.ys.push(y)
    const target = this.uniforms.uRingYs.value
    for (let i = 0; i < TRUNK_RING_SLOTS; i++) target[i] = this.ys[i] ?? -10
    this.uniforms.uRingCount.value = this.ys.length
  }

  update(dt: number): void {
    const u = this.uniforms.uRingPulse
    if (u.value > 0.001) u.value *= Math.exp(-dt * 1.6)
    else u.value = 0
  }
}
