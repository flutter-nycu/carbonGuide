// Loading and polling helpers for the pages.
import { useCallback, useEffect, useRef, useState } from 'react'
import { toRagError } from './api/errors'
import type { Page } from './api/types'
import { usePageActive } from './ui'

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; reload: () => Promise<void> }

/** Loads once on mount and whenever `reload` is called; keeps the last data while reloading. */
export function useLoader<T>(load: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const latest = useRef(load)
  latest.current = load
  const alive = useRef(true)
  // Polling and a reload after a save can overlap; only the newest request may update the page.
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const current = ++generation.current
    const newest = () => alive.current && current === generation.current
    setLoading(true)
    try {
      const value = await latest.current()
      if (!newest()) return
      setData(value)
      setError(null)
    } catch (caught) {
      if (newest()) setError(toRagError(caught).message)
    } finally {
      if (newest()) setLoading(false)
    }
  }, [])
  useEffect(() => {
    alive.current = true
    void reload()
    return () => { alive.current = false }
  }, [reload])
  return { data, error, loading, reload }
}

/** Runs `tick` every `ms` while `wanted` is true, the page is the visible one and the browser tab is not hidden. */
export function usePolling(tick: () => void, wanted: boolean, ms = 15_000) {
  const active = usePageActive()
  const latest = useRef(tick)
  latest.current = tick
  useEffect(() => {
    if (!wanted || !active) return
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') latest.current() }, ms)
    return () => clearInterval(timer)
  }, [wanted, active, ms])
}

export interface Paged<T> { items: T[] | null; error: string | null; loading: boolean; hasMore: boolean; more: () => Promise<void> }

/** Cursor pages: reloads from the first page whenever `key` changes, and appends on `more`. */
export function usePaged<T>(load: (cursor: string | null) => Promise<Page<T>>, key: string): Paged<T> {
  const [items, setItems] = useState<T[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const latest = useRef(load)
  latest.current = load
  // Answers that arrive after the key changed belong to the old list and are dropped.
  const generation = useRef(0)

  const fetchPage = useCallback(async (cursor: string | null) => {
    const current = generation.current
    setLoading(true)
    try {
      const page = await latest.current(cursor)
      if (current !== generation.current) return
      setItems(previous => (cursor && previous ? [...previous, ...page.items] : page.items))
      setNext(page.nextCursor)
      setError(null)
    } catch (caught) {
      if (current === generation.current) setError(toRagError(caught).message)
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    generation.current += 1
    setItems(null)
    setNext(null)
    void fetchPage(null)
    return () => { generation.current += 1 }
  }, [key, fetchPage])

  const more = useCallback(async () => { if (next) await fetchPage(next) }, [next, fetchPage])
  return { items, error, loading, hasMore: next !== null, more }
}
