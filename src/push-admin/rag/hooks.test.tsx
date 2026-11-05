// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useLoader, type Loaded } from './hooks'

afterEach(() => cleanup())

describe('useLoader', () => {
  it('keeps the newest answer when an older request finishes last', async () => {
    const pending: ((value: string) => void)[] = []
    let loaded: Loaded<string> | undefined
    function Probe() {
      loaded = useLoader(() => new Promise<string>(resolve => { pending.push(resolve) }))
      return <p>{loaded.data}</p>
    }
    const view = render(<Probe />)
    await act(async () => { void loaded!.reload() })
    expect(pending).toHaveLength(2)
    await act(async () => { pending[1]('新的') })
    await act(async () => { pending[0]('舊的') })
    expect(view.container.textContent).toBe('新的')
    expect(loaded!.loading).toBe(false)
  })
})
