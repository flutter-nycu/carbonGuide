import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface VercelConfig {
  redirects?: { source: string; destination: string; permanent: boolean }[]
  rewrites?: { source: string; destination: string }[]
  headers?: {
    source: string
    headers: { key: string; value: string }[]
  }[]
}

const config = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig

describe('Vercel push-admin deployment', () => {
  it('redirects the physical HTML entry to the secured canonical route', () => {
    expect(config.redirects).toContainEqual({
      source: '/push-admin.html',
      destination: '/push-admin',
      permanent: true,
    })
  })

  it('rewrites the canonical route to the Vite entry', () => {
    expect(config.rewrites).toContainEqual({
      source: '/push-admin',
      destination: '/push-admin.html',
    })
  })

  it('adds anti-framing and restrictive script policies', () => {
    const headers = config.headers?.find(item => item.source === '/push-admin')
      ?.headers
    const csp = headers?.find(header => header.key === 'Content-Security-Policy')
      ?.value

    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(headers).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' })
  })
})
