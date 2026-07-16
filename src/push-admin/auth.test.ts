import { describe, expect, it } from 'vitest'
import {
  canWritePushAdmin,
  isAllowedPushAdminEmail,
  isAdminRole,
  oauthErrorFromHash,
  pushAdminRedirectUrl,
  visibleAdminTabs,
} from './auth'

describe('push admin authorization helpers', () => {
  it('allows only the configured Google email', () => {
    expect(isAllowedPushAdminEmail('j20692091@gmail.com')).toBe(true)
    expect(isAllowedPushAdminEmail(' J20692091@GMAIL.COM ')).toBe(true)
    expect(isAllowedPushAdminEmail('other@example.com')).toBe(false)
    expect(isAllowedPushAdminEmail(undefined)).toBe(false)
  })

  it('accepts only configured database roles', () => {
    expect(isAdminRole('owner')).toBe(true)
    expect(isAdminRole('editor')).toBe(true)
    expect(isAdminRole('viewer')).toBe(true)
    expect(isAdminRole('service_role')).toBe(false)
  })

  it('keeps viewer navigation read-only', () => {
    expect(canWritePushAdmin('viewer')).toBe(false)
    expect(visibleAdminTabs('viewer')).toEqual(['history', 'usage'])
    expect(visibleAdminTabs('editor')).toEqual([
      'system',
      'rules',
      'history',
      'usage',
    ])
  })
})

describe('Google OAuth helpers', () => {
  it('always returns to the canonical push-admin route', () => {
    expect(pushAdminRedirectUrl('https://carbon-guide.vercel.app')).toBe(
      'https://carbon-guide.vercel.app/push-admin',
    )
  })

  it('extracts an OAuth redirect error for display', () => {
    expect(oauthErrorFromHash('#error=access_denied&error_description=Denied')).toBe(
      'Denied',
    )
    expect(oauthErrorFromHash('')).toBeNull()
  })
})
