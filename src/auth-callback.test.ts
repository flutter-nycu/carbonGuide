import { describe, expect, it } from 'vitest'

import { parseRecoveryCallback } from './auth-callback'

describe('parseRecoveryCallback', () => {
  it('forwards a PKCE recovery code to the fixed app callback', () => {
    expect(parseRecoveryCallback('?code=abc-123')).toEqual({
      kind: 'recovery',
      appUrl: 'carbonguide://auth/callback?code=abc-123',
    })
  })

  it('encodes callback values without allowing a destination override', () => {
    expect(
      parseRecoveryCallback(
        '?code=value%26next%3Dhttps%3A%2F%2Fevil.example&next=https://evil.example',
      ),
    ).toEqual({
      kind: 'recovery',
      appUrl:
        'carbonguide://auth/callback?code=value%26next%3Dhttps%3A%2F%2Fevil.example',
    })
  })

  it('forwards only the first recovery code', () => {
    expect(parseRecoveryCallback('?code=first&code=second')).toEqual({
      kind: 'recovery',
      appUrl: 'carbonguide://auth/callback?code=first',
    })
  })

  it('rejects callbacks without a recovery code', () => {
    expect(parseRecoveryCallback('?error_code=otp_expired')).toEqual({
      kind: 'error',
      message: '這個重設密碼連結無效或已過期，請回到 App 重新申請。',
    })
  })

  it('rejects excessively long recovery codes', () => {
    expect(parseRecoveryCallback(`?code=${'a'.repeat(2049)}`)).toEqual({
      kind: 'error',
      message: '這個重設密碼連結格式不正確，請回到 App 重新申請。',
    })
  })
})
