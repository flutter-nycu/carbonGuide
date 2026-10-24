// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signOut: authMocks.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: authMocks.maybeSingle }),
      }),
    }),
  },
}))

vi.mock('./components/Dashboard', () => ({
  default: ({ role }: { role: string }) => <div>dashboard:{role}</div>,
}))

vi.mock('./components/LoginForm', () => ({
  default: ({ error }: { error?: string | null }) => <div>{error ?? 'login'}</div>,
}))

beforeEach(() => {
  authMocks.getSession.mockResolvedValue({
    data: {
      session: {
        user: { id: 'auth-user-1', email: 'j20692091@gmail.com' },
      },
    },
  })
  authMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  authMocks.signOut.mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('App admin gate', () => {
  it('keeps signed-out deep links outside the dashboard', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } })
    window.history.replaceState(null, '', '/push-admin#rag')
    render(<App />)
    expect(await screen.findByText('login')).toBeTruthy()
    expect(authMocks.maybeSingle).not.toHaveBeenCalled()
    window.history.replaceState(null, '', '/')
  })

  it('does not restore a dashboard from an admin check that finishes after logout', async () => {
    let finish!: (value: unknown) => void
    authMocks.maybeSingle.mockReturnValue(new Promise(resolve => { finish = resolve }))
    render(<App />)
    await waitFor(() => expect(authMocks.maybeSingle).toHaveBeenCalled())
    act(() => authMocks.onAuthStateChange.mock.calls[0][0]('SIGNED_OUT', null))
    await act(async () => finish({ data: { role: 'owner' }, error: null }))
    expect(await screen.findByText('login')).toBeTruthy()
    expect(screen.queryByText('dashboard:owner')).toBeNull()
  })

  it('fails closed when the admin lookup rejects', async () => {
    authMocks.maybeSingle.mockRejectedValue(new Error('offline'))
    render(<App />)
    expect(await screen.findByText('暫時無法驗證管理員權限，請稍後再試。')).toBeTruthy()
    expect(screen.queryByText('dashboard:owner')).toBeNull()
  })
  it('restores an authorized viewer session', async () => {
    authMocks.maybeSingle.mockResolvedValue({
      data: { role: 'viewer' },
      error: null,
    })

    render(<App />)

    expect(await screen.findByText('dashboard:viewer')).toBeTruthy()
    expect(authMocks.signOut).not.toHaveBeenCalled()
  })

  it('signs out a Google account outside the admin allowlist', async () => {
    authMocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    render(<App />)

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce())
    expect(
      await screen.findByText('此 Google 帳號不在推播管理員白名單中。'),
    ).toBeTruthy()
  })

  it('rejects a different email before querying the admin table', async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'auth-user-2', email: 'other@example.com' },
        },
      },
    })
    authMocks.maybeSingle.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    })

    render(<App />)

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce())
    expect(authMocks.maybeSingle).not.toHaveBeenCalled()
  })
})
