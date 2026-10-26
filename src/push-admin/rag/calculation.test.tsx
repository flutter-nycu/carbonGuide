// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CalculationPanel } from './CalculationPanel'
import type { EditorialRepository } from './v1'
afterEach(cleanup)
it('revoking edit permissions removes an existing calculation editor', async () => {
 const api = { calculations: vi.fn(async () => []), saveCalculation: vi.fn() } as unknown as EditorialRepository
 const view = render(<CalculationPanel api={api} role="owner" />)
 fireEvent.click(screen.getByRole('button', { name: '新增計算資料' }))
 expect(screen.getByRole('form', { name: '計算資料草稿' })).toBeTruthy()
 view.rerender(<CalculationPanel api={api} role="viewer" />)
 expect(screen.queryByRole('form', { name: '計算資料草稿' })).toBeNull()
 expect(api.saveCalculation).not.toHaveBeenCalled()
})
