// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

const authMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signInWithOAuth: authMocks.signInWithOAuth },
  },
}))

afterEach(() => {
  cleanup()
  authMocks.signInWithOAuth.mockReset()
})

describe('LoginForm', () => {
  it('starts Google OAuth and returns to the canonical admin route', async () => {
    authMocks.signInWithOAuth.mockResolvedValue({ error: null })
    render(<LoginForm />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Google 帳號登入' }))

    await waitFor(() => {
      expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/push-admin`,
        },
      })
    })
  })
})
