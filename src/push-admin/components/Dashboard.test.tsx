// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

vi.mock('./SystemPushTab', () => ({ default: () => <div>system panel</div> }))
vi.mock('./RulesTab', () => ({ default: () => <div>rules panel</div> }))
vi.mock('./HistoryTab', () => ({ default: () => <div>history panel</div> }))
vi.mock('./UsageTab', () => ({ default: () => <div>usage panel</div> }))

afterEach(cleanup)

describe('Dashboard role navigation', () => {
  it('keeps viewer accounts on read-only tabs', () => {
    render(<Dashboard role="viewer" onLogout={() => undefined} />)

    expect(screen.queryByRole('button', { name: '系統推播' })).toBeNull()
    expect(screen.queryByRole('button', { name: '個人化規則' })).toBeNull()
    expect(screen.getByRole('button', { name: '發送紀錄' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '推播用量' })).toBeTruthy()
    expect(screen.getByText('history panel')).toBeTruthy()
  })

  it('shows write tabs to editor accounts', () => {
    render(<Dashboard role="editor" onLogout={() => undefined} />)

    expect(screen.getByRole('button', { name: '系統推播' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '個人化規則' })).toBeTruthy()
    expect(screen.getByText('system panel')).toBeTruthy()
  })
})
