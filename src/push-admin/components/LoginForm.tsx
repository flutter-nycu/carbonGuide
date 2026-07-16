import { useState } from 'react'
import { oauthErrorFromHash, pushAdminRedirectUrl } from '../auth'
import { supabase } from '../lib/supabase'

interface Props {
  error?: string | null
}

export default function LoginForm({ error }: Props) {
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  async function handleGoogleLogin() {
    setLoading(true)
    setLoginError(null)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: pushAdminRedirectUrl(window.location.origin),
      },
    })

    if (oauthError) {
      setLoginError(oauthError.message)
      setLoading(false)
    }
  }

  const displayError = loginError ?? error ?? oauthErrorFromHash(window.location.hash)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-800 mb-1">推播管理台</h1>
        <p className="text-sm text-gray-400 mb-6">CarbonGuide Push Admin</p>

        {displayError && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
            {displayError}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full border border-gray-300 bg-white text-gray-700 rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-3"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z" />
            <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
          </svg>
          {loading ? '正在前往 Google…' : '使用 Google 帳號登入'}
        </button>

        <p className="text-xs text-gray-400 mt-5 leading-relaxed">
          僅限已加入 CarbonGuide 管理員白名單的帳號。
        </p>
      </div>
    </div>
  )
}
