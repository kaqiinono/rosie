import type { FruitItem, Lesson34Mode } from './type'

export interface MergeStep {
  story: string
  btn: string
}

export function getMergeSteps(A: number, B: number, P: number, fruit: FruitItem): MergeStep[] {
  return [
    {
      story: `去${fruit.name}店啦！${fruit.emoji} 一袋 <span class="price">${P} 元</span>，我们去看看吧！`,
      btn: '开始 ▶',
    },
    {
      story: `妈妈先来了，她买了 <strong>${A} 袋</strong>${fruit.name}！每袋 <span class="price">${P} 元</span>。`,
      btn: '下一步 ▶',
    },
    {
      story: `爸爸也来了！他买了 <strong>${B} 袋</strong>${fruit.name}！<br>现在妈妈 ${A} 袋，爸爸 ${B} 袋，<strong>分开放着</strong>。`,
      btn: '下一步 ▶',
    },
    {
      story: `<strong>分开算</strong>要多少钱？<br>妈妈：<strong>${A} × ${P} = ${A * P} 元</strong><br>爸爸：<strong>${B} × ${P} = ${B * P} 元</strong><br>一共：<strong>${A * P} + ${B * P} = ${(A + B) * P} 元</strong>`,
      btn: '下一步 ▶',
    },
    {
      story: `反正每袋价钱一样，把<strong>所有袋子合到一起</strong>数一数，行不行呢？`,
      btn: '合在一起！ ▶',
    },
    {
      story: `看！妈妈的 <strong>${A} 袋</strong> 和爸爸的 <strong>${B} 袋</strong> 放到一起了！<br>数一数：<strong>${A} + ${B} = ${A + B} 袋</strong>！<br><br>上面还保留着分开的样子，可以对比看哦！`,
      btn: '下一步 ▶',
    },
    {
      story: `<strong>${A + B} 袋</strong>${fruit.name}，每袋 <span class="price">${P} 元</span>：<br><strong>${A + B} × ${P} = ${(A + B) * P} 元</strong><br><br>和分开算的 <strong>${(A + B) * P} 元</strong> 一模一样！`,
      btn: '看总结 ▶',
    },
    {
      story: `太棒了！你发现了 <strong>"乘法分配律"</strong>！<br><strong>分开算再加</strong> 和 <strong>合起来一起算</strong>，结果一样！`,
      btn: '🎉 完成！',
    },
  ]
}

export function getSplitSteps(A: number, B: number, P: number, fruit: FruitItem): MergeStep[] {
  return [
    {
      story: `这次反过来！我们有 <strong>${A + B} 袋</strong>${fruit.name}，每袋 <span class="price">${P} 元</span>。试试拆成两份来算？`,
      btn: '开始 ▶',
    },
    {
      story: `看！这里有 <strong>${A + B} 袋</strong>${fruit.name}，每袋 <span class="price">${P} 元</span>。先算总价吧！`,
      btn: '下一步 ▶',
    },
    {
      story: `合在一起算：<strong>${A + B} × ${P} = ${(A + B) * P} 元</strong>`,
      btn: '下一步 ▶',
    },
    {
      story: `如果我把它拆成两份呢？<br>拿出 <strong>${A} 袋</strong>给妈妈，剩下 <strong>${B} 袋</strong>给爸爸。`,
      btn: '拆开！ ▶',
    },
    {
      story: `拆好了！妈妈拿到 <strong>${A} 袋</strong>，爸爸拿到 <strong>${B} 袋</strong>。<br>下面还保留着合在一起的样子，可以对比看！`,
      btn: '下一步 ▶',
    },
    {
      story: `分开算一算：<br>妈妈：<strong>${A} × ${P} = ${A * P} 元</strong><br>爸爸：<strong>${B} × ${P} = ${B * P} 元</strong><br>一共：<strong>${A * P} + ${B * P} = ${(A + B) * P} 元</strong><br><br>和合起来算的<strong>一模一样</strong>！`,
      btn: '看总结 ▶',
    },
    {
      story: `太棒了！不管是<strong>合起来算</strong>还是<strong>拆开来算</strong>，结果都是 <strong>${(A + B) * P} 元</strong>！<br>这就是 <strong>"乘法分配律"</strong> 的反向应用！`,
      btn: '🎉 完成！',
    },
  ]
}

export function getSteps(mode: Lesson34Mode, A: number, B: number, P: number, fruit: FruitItem) {
  return mode === 'merge' ? getMergeSteps(A, B, P, fruit) : getSplitSteps(A, B, P, fruit)
}
