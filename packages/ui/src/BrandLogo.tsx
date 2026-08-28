import Image from 'next/image'
import Link from 'next/link'

type BrandLogoAssetVariant = 'icon' | 'horizontal' | 'wordmark'
type BrandLogoVariant = 'responsive' | BrandLogoAssetVariant
type BrandLogoSize = 'sm' | 'md' | 'lg'

type BrandLogoProps = {
  /** 品牌素材形态；默认根据可用的屏幕宽度切换横版与图标版。 */
  variant?: BrandLogoVariant
  /** 统一的预设尺寸。 */
  size?: BrandLogoSize
  /** 点击目标；传入 null 时仅展示图片。 */
  href?: string | null
  className?: string
  priority?: boolean
}

const ASSETS: Record<BrandLogoAssetVariant, { src: string; width: number; height: number }> = {
  icon: {
    src: '/brand/rosie-fun-app-icon.png',
    width: 1254,
    height: 1254,
  },
  horizontal: {
    src: '/brand/rosie-fun-horizontal.png',
    width: 1958,
    height: 626,
  },
  wordmark: {
    src: '/brand/rosie-fun-wordmark.png',
    width: 1791,
    height: 428,
  },
}

const SIZE_CLASSES: Record<BrandLogoAssetVariant, Record<BrandLogoSize, string>> = {
  icon: {
    sm: 'h-9 w-9',
    md: 'h-11 w-11',
    lg: 'h-14 w-14',
  },
  horizontal: {
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-14 w-auto',
  },
  wordmark: {
    sm: 'h-7 w-auto',
    md: 'h-9 w-auto',
    lg: 'h-12 w-auto',
  },
}

export default function BrandLogo({
  variant = 'responsive',
  size = 'md',
  href = '/',
  className = '',
  priority = false,
}: BrandLogoProps) {
  const renderImage = (assetVariant: BrandLogoAssetVariant, responsiveClassName = '') => {
    const asset = ASSETS[assetVariant]

    return (
      <Image
        src={asset.src}
        alt="Rosie Fun"
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={`${SIZE_CLASSES[assetVariant][size]} object-contain ${responsiveClassName} ${className}`}
      />
    )
  }

  const image =
    variant === 'responsive' ? (
      <>
        {renderImage('icon', 'md:hidden')}
        {renderImage('horizontal', 'hidden md:block')}
      </>
    ) : (
      renderImage(variant)
    )

  if (!href) return image

  return (
    <Link
      href={href}
      aria-label="返回项目首页"
      className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl outline-none transition hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
    >
      {image}
    </Link>
  )
}

export type { BrandLogoProps, BrandLogoSize, BrandLogoVariant }
