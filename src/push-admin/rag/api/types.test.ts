import { describe, expect, it } from 'vitest'
import { fileProblem, urlProblem, validateSettings } from './types'

describe('shared input rules', () => {
  it('accepts only PDF, DOCX and TXT between 1 byte and 20 MB', () => {
    expect(fileProblem({ name: '報告.PDF', size: 10 })).toBeNull()
    expect(fileProblem({ name: 'notes.txt', size: 20 * 1024 * 1024 })).toBeNull()
    expect(fileProblem({ name: 'data.json', size: 10 })).toBe('unsupported_format')
    expect(fileProblem({ name: 'pdf', size: 10 })).toBe('unsupported_format')
    expect(fileProblem({ name: 'a.docx', size: 0 })).toBe('file_empty')
    expect(fileProblem({ name: 'a.docx', size: 20 * 1024 * 1024 + 1 })).toBe('file_too_large')
    expect(fileProblem({ name: 'a/b.pdf', size: 10 })).toBe('file_name_invalid')
  })

  it('accepts https addresses on any public host name', () => {
    expect(urlProblem('https://www.example.gov.tw/files/report.pdf')).toBeNull()
    expect(urlProblem('  https://example.org/a.pdf  ')).toBeNull()
    for (const bad of ['http://example.org/a.pdf', 'ftp://example.org/a.pdf', 'https://10.0.0.1/a.pdf', 'https://[::1]/a.pdf',
      'https://u:p@example.org/a.pdf', 'https://example.org/a.pdf#page=2', 'https://example.org:8443/a.pdf', 'https://example.org?a=1', 'https://127.1/a.pdf', 'https://0x7f.0.0.1/a.pdf', 'https://exa_mple.org/a.pdf', 'not a url', '']) {
      expect(urlProblem(bad)).toBe('url_source_not_allowed')
    }
  })

  it('keeps retrieval settings inside the backend limits', () => {
    expect(validateSettings({ candidates: 20, contextChunks: 6 })).toBeNull()
    expect(validateSettings({ candidates: 50, contextChunks: 12 })).toBeNull()
    expect(validateSettings({ candidates: 51, contextChunks: 6 })).toContain('1 到 50')
    expect(validateSettings({ candidates: 20, contextChunks: 13 })).toContain('1 到 12')
    expect(validateSettings({ candidates: 4, contextChunks: 6 })).toBe('回答時參考的段數，不能比先找的資料筆數多。')
    expect(validateSettings({ candidates: 2.5, contextChunks: 1 })).not.toBeNull()
  })
})
