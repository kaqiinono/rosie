import * as THREE from 'three'

// 几何体只负责提供「干净、分段足够」的底模，真正的有机形变全部在 vertex shader 里做：
//  - 树干：y∈[0, height]，shader 里按高度做板根外扩、周向裂瓣、轻微扭转
//  - 彩枝：x∈[0, length]，x=0 在树干交界、x=length 是枝梢。枝的生长 / 缩回 = shader 里缩放 x
//  - 宝石：单位球方向 → shader 里变成鹅卵石或苹果

/** 树干：高度方向 64 段，保证 shader 里的扭转和裂瓣不出现折线。 */
export function createTrunkGeometry(
  height: number,
  rTop: number,
  rBottom: number,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(rTop, rBottom, height, 64, 72, false)
  geometry.translate(0, height / 2, 0)
  return geometry
}

/** 彩枝：轴沿 +X，根部（x=0）在原点，枝梢在 x=length。 */
export function createBranchGeometry(
  length: number,
  rBase: number,
  rTip: number,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(rTip, rBase, length, 20, 40, false)
  geometry.rotateZ(-Math.PI / 2) // +Y → +X
  geometry.translate(length / 2, 0, 0)
  return geometry
}

/** 宝石 / 苹果：二十面体细分到 3 级（约 3.8k 顶点），法线在 shader 里用有限差分重算，所以不会有棱面。 */
export function createGemGeometry(detail = 3): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, detail)
}

/** 泡泡：经纬球，分段多一点，顶点着色器的低频形变才顺滑。 */
export function createBubbleGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, 64, 48)
}
