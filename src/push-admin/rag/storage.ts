// Per-browser conveniences only: the folded sidebar and the tutorial's progress. Storage can be missing or throw in a
// private window or when site data is blocked, so every access falls back to the defaults and the page keeps working.

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Nothing to do: the setting lasts until the page reloads.
  }
}
