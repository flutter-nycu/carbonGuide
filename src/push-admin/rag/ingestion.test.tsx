// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IngestionPanel } from './IngestionPanel'
import { validateFile, type RagV1Repository } from './v1'
import { QualityNotice } from './QualityNotice'

afterEach(cleanup)
function repository(): RagV1Repository {
  return { ingestion: vi.fn().mockResolvedValue({ originals: [], jobs: [] }), upload: vi.fn().mockResolvedValue(undefined),
    download: vi.fn(), campaigns: vi.fn(), stopCampaign: vi.fn() }
}
describe('private ingestion controls', () => {
  it('shows excluded whole chunks as incomplete evidence with review locations', () => {
    render(<QualityNotice quality={{ quarantine: { count: 2, physical_pages: [3, 7], chunk_ordinals: [4, 9], review_required: true } }} />)
    expect(screen.getByText('已隔離 2 個原始段落，內容不完整')).toBeTruthy()
    expect(screen.getByText('受影響物理頁：3、7')).toBeTruthy()
    expect(screen.getByText('原始段落序號：4、9')).toBeTruthy()
    expect(screen.getByText(/原檔與解析紀錄仍保留/)).toBeTruthy()
  })
  it('rejects empty, oversize, unsupported and path-like filenames', () => {
    expect(validateFile({ name: '知識.pdf', size: 20 * 1024 * 1024 })).toBeNull()
    for (const file of [{ name: '知識.pdf', size: 0 }, { name: '知識.pdf', size: 20 * 1024 * 1024 + 1 },
      { name: '知識.exe', size: 10 }, { name: '../知識.pdf', size: 10 }]) expect(validateFile(file)).toBeTruthy()
  })
  it('viewer can inspect status but has no upload controls', async () => {
    const repo = repository()
    render(<IngestionPanel repository={repo} role="viewer" changed={vi.fn()} />)
    await screen.findByText('原始檔 0 份 · 已核對 0 份')
    expect(screen.queryByLabelText('選擇原始檔')).toBeNull()
    expect(screen.queryByRole('button', { name: '上傳並核對' })).toBeNull()
  })
  it('failed upload keeps the selected file and successful retry refreshes documents', async () => {
    const repo = repository(), changed = vi.fn()
    vi.mocked(repo.upload).mockRejectedValueOnce(new Error('連線中斷，請重試。'))
    render(<IngestionPanel repository={repo} role="owner" changed={changed} />)
    const file = new File(['%PDF-1.7'], '知識.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('選擇原始檔'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: '上傳並核對' }))
    await screen.findByText('連線中斷，請重試。')
    expect(changed).not.toHaveBeenCalled()
    await waitFor(() => expect((screen.getByRole('button', { name: '上傳並核對' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '上傳並核對' }))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
    expect(repo.upload).toHaveBeenNthCalledWith(2, file, expect.any(Function))
  })
})
