// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { VersionsPanel } from './VersionsPanel'
import type { RagRepository } from './repository'
import type { VersionData, VersionRepository } from './v1'

afterEach(cleanup)
function fixture() {
  const data: VersionData = { snapshots: [{ id: 'release', name: '合成版本', manifest_hash: 'a'.repeat(64), created_at: '2026-10-26' }],
    sets: [], originals: [], calculations: [], reviews: [], publications: [], evaluations: [] }
  const versions: VersionRepository = { versions: vi.fn(async () => data), snapshotDetail: vi.fn(async () => ({ documents: [], qa: [], personas: [], calculations: [] })),
    createSnapshot: vi.fn(async () => 'release'), reviewSnapshot: vi.fn(async () => {}), activateSnapshot: vi.fn(async () => {}) }
  const repo = { v1: { versions }, list: vi.fn(async (kind: string) => kind === 'rag_service_state' ? [{ active_release_id: null }] : []) } as unknown as RagRepository
  return { repo, versions }
}
async function selectVersion() {
  await screen.findByRole('option', { name: /合成版本/ })
  fireEvent.change(screen.getByLabelText('知識版本'), { target: { value: 'release' } })
  await screen.findByText(/SHA-256/)
}
it('requires an explicit owner acknowledgement and retains the same request key after a lost response', async () => {
  const { repo, versions } = fixture()
  vi.mocked(versions.reviewSnapshot).mockRejectedValueOnce(new Error('暫時斷線')).mockResolvedValueOnce()
  render(<VersionsPanel repo={repo} role="owner" />)
  await selectVersion()
  fireEvent.change(screen.getByLabelText('審核或切換原因'), { target: { value: 'Synthetic review only' } })
  expect((screen.getByRole('button', { name: '記錄人工核准' }) as HTMLButtonElement).disabled).toBe(true)
  expect(versions.reviewSnapshot).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText(/我已核對這個版本及其評測/))
  fireEvent.click(screen.getByRole('button', { name: '記錄人工核准' }))
  await screen.findByText('暫時斷線')
  fireEvent.click(screen.getByRole('button', { name: '記錄人工核准' }))
  await waitFor(() => expect(versions.reviewSnapshot).toHaveBeenCalledTimes(2))
  const calls = vi.mocked(versions.reviewSnapshot).mock.calls
  expect(calls[1]).toEqual(calls[0])
  expect(calls[0].slice(0, 4)).toEqual(['release', 'a'.repeat(64), 'approve', 'Synthetic review only'])
  expect((screen.getByRole('button', { name: '發布此版本' }) as HTMLButtonElement).disabled).toBe(true)
  expect(versions.activateSnapshot).not.toHaveBeenCalled()
})
it('keeps viewer controls read-only without submitting any approval or publication', async () => {
  const { repo, versions } = fixture()
  render(<VersionsPanel repo={repo} role="viewer" />)
  await selectVersion()
  expect(screen.getByRole('button', { name: '記錄人工核准' }).closest('fieldset')?.disabled).toBe(true)
  expect(screen.getByRole('button', { name: '固定快照，準備評測' }).closest('fieldset')?.disabled).toBe(true)
  expect(versions.reviewSnapshot).not.toHaveBeenCalled()
  expect(versions.activateSnapshot).not.toHaveBeenCalled()
})
