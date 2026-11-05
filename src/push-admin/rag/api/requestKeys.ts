// Request keys live outside React so a remount never turns a retry into a second paid request.

const keys = new Map<string, string>()

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const fingerprint = (kind: string, payload: unknown) => `${kind}:${stable(payload)}`

/** Same operation and content → same key, until the request settles. */
export function requestKeyFor(kind: string, payload: unknown): string {
  const id = fingerprint(kind, payload)
  let key = keys.get(id)
  if (!key) {
    key = crypto.randomUUID()
    keys.set(id, key)
  }
  return key
}

/** Call after a confirmed result so the next identical request is treated as new. */
export function settleRequestKey(kind: string, payload: unknown): void {
  keys.delete(fingerprint(kind, payload))
}

export function clearRequestKeys(): void {
  keys.clear()
}
