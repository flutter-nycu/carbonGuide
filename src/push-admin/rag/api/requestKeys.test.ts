import { afterEach, describe, expect, it } from 'vitest'
import { clearRequestKeys, requestKeyFor, settleRequestKey } from './requestKeys'

afterEach(() => clearRequestKeys())

describe('request keys', () => {
  it('reuses the key for the same operation and content', () => {
    const first = requestKeyFor('ask', { roundId: 'r1', question: '如何減少食物浪費？' })
    expect(requestKeyFor('ask', { question: '如何減少食物浪費？', roundId: 'r1' })).toBe(first)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('uses a different key for different content or operations', () => {
    const first = requestKeyFor('ask', { roundId: 'r1', question: 'A' })
    expect(requestKeyFor('ask', { roundId: 'r1', question: 'B' })).not.toBe(first)
    expect(requestKeyFor('round', { roundId: 'r1', question: 'A' })).not.toBe(first)
  })

  it('issues a fresh key only after the request settles', () => {
    const payload = { url: 'https://example.org/a.pdf' }
    const first = requestKeyFor('url', payload)
    settleRequestKey('url', payload)
    expect(requestKeyFor('url', payload)).not.toBe(first)
  })
})
