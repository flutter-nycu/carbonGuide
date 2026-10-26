import { useCallback, useEffect, useState } from 'react'
import type { EntityMap, RagRepository } from './repository'

export function useResource<K extends keyof EntityMap>(repo: RagRepository | null, kind: K, filter?: { column: string; value: string }, page?: { offset: number; limit: number }) {
  const [data, setData] = useState<EntityMap[K][]>([])
  const [loading, setLoading] = useState(Boolean(repo))
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(n => n + 1), [])
  const column = filter?.column, value = filter?.value
  const offset = page?.offset, limit = page?.limit
  useEffect(() => {
    let current = true
    setData([])
    setError('')
    setLoading(Boolean(repo))
    if (repo) repo.list(kind, column && value ? { column, value } : undefined, offset !== undefined && limit !== undefined ? { offset, limit } : undefined).then(result => {
      if (current) setData(result)
    }).catch(reason => {
      if (current) setError(reason instanceof Error ? reason.message : '無法讀取資料，請稍後重試。')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [repo, kind, column, value, offset, limit, revision])
  return { data, loading, error, reload, connected: Boolean(repo) }
}
