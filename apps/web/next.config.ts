import type { NextConfig } from 'next'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** Dynamically read all @rosie/* workspace package names from pnpm-workspace packages/ dir */
function getRosiePackages(): string[] {
  try {
    const pkgJsonPath = resolve(__dirname, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return Object.keys(deps).filter((name) => name.startsWith('@rosie/'))
  } catch {
    // Fallback to hardcoded list if dynamic detection fails
    return ['@rosie/core', '@rosie/rewards', '@rosie/player', '@rosie/ui', '@rosie/calc', '@rosie/math-kit', '@rosie/math-content', '@rosie/math', '@rosie/english', '@rosie/flipbook', '@rosie/audio', '@rosie/chinese']
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  transpilePackages: getRosiePackages(),

  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/manifest.json',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
      ],
    },
  ],
}

export default nextConfig
