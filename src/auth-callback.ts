import './auth-callback.css'

const APP_CALLBACK_BASE = 'carbonguide://auth/callback'
const MAX_CALLBACK_VALUE_LENGTH = 2048

export type RecoveryCallback =
  | { kind: 'recovery'; appUrl: string }
  | { kind: 'error'; message: string }

export function parseRecoveryCallback(search: string): RecoveryCallback {
  const input = new URLSearchParams(search)
  const code = input.get('code')

  if (!code) {
    return {
      kind: 'error',
      message: '這個重設密碼連結無效或已過期，請回到 App 重新申請。',
    }
  }

  if (code.length > MAX_CALLBACK_VALUE_LENGTH) {
    return {
      kind: 'error',
      message: '這個重設密碼連結格式不正確，請回到 App 重新申請。',
    }
  }

  // A successful PKCE recovery callback only needs the first `code` value.
  // Do not forward arbitrary or duplicate parameters into the app boundary.
  const forwarded = new URLSearchParams({ code })

  return {
    kind: 'recovery',
    appUrl: `${APP_CALLBACK_BASE}?${forwarded.toString()}`,
  }
}

function showCallback(): void {
  const title = document.querySelector<HTMLElement>('#callback-title')
  const message = document.querySelector<HTMLElement>('#callback-message')
  const openApp = document.querySelector<HTMLAnchorElement>('#open-app')
  const help = document.querySelector<HTMLElement>('#callback-help')

  if (!title || !message || !openApp || !help) return

  const callback = parseRecoveryCallback(window.location.search)

  // Keep the one-time code out of browser history and referrer data after it
  // has been copied into the fixed-scheme app link held by this page.
  window.history.replaceState(null, '', '/auth/callback')

  if (callback.kind === 'error') {
    title.textContent = '無法重設密碼'
    message.textContent = callback.message
    return
  }

  openApp.href = callback.appUrl
  openApp.hidden = false
  help.hidden = false

  window.setTimeout(() => {
    window.location.assign(callback.appUrl)
  }, 150)
}

if (typeof document !== 'undefined') {
  showCallback()
}
