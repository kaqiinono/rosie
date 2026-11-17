import type { CSSProperties } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Flex, Text } from '@rosie/ui/themes'
import RainbowAppleArt, { RAINBOW_COLORS } from '@/components/tree-demo/garden/RainbowAppleArt'

export default function DailyRainbowReward() {
  return (
    <StickerCard tone="warning" size="md" className="w-full text-center">
      <Flex direction="column" align="center" gap="3" role="status">
        <div className="tg-victory-art" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => (
            <i key={index} className="tg-victory-confetti" style={{
              '--confetti-x': `${((index * 73) % 300) - 150}px`,
              '--confetti-y': `${-70 - ((index * 37) % 100)}px`,
              '--confetti-turn': `${index % 2 ? -430 : 430}deg`,
              backgroundColor: RAINBOW_COLORS[index % RAINBOW_COLORS.length],
              animationDelay: `${(index % 7) * 60}ms`,
            } as CSSProperties} />
          ))}
          <svg className="tg-victory-apple" viewBox="-40 -40 80 80"><RainbowAppleArt /></svg>
        </div>
        <Badge color="amber" size="3">今日学习任务全部完成！</Badge>
        <Text size="5" weight="bold">最后一颗苹果变成彩虹果啦！</Text>
        <Text>每一份努力都算数，你做到了！</Text>
        <Text weight="bold">摘下彩虹果，自选 1 颗红、黄或蓝宝石。</Text>
        <Text size="2" color="gray">彩虹果已经长在树上，快去收获吧！符合盲盒领取间隔时，还能获得一次盲盒机会。</Text>
      </Flex>
    </StickerCard>
  )
}
