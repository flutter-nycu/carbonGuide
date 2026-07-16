import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AdminRole } from './auth'
import { isAdminRole, isAllowedPushAdminEmail } from './auth'
import Dashboard from './components/Dashboard'
import LoginForm from './components/LoginForm'
import { supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminError, setAdminError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      if (currentSession) {
        void checkAdmin(currentSession.user.id, currentSession.user.email)
      }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
        if (currentSession) {
          setAdminError(null)
          void checkAdmin(currentSession.user.id, currentSession.user.email)
        } else {
          setAdminRole(null)
          setLoading(false)
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  async function checkAdmin(userId: string, email: string | undefined) {
    setLoading(true)

    if (!isAllowedPushAdminEmail(email)) {
      await supabase.auth.signOut()
      setAdminError('此 Google 帳號不在推播管理員白名單中。')
      setLoading(false)
      return
    }

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (error) {
      await supabase.auth.signOut()
      setAdminError('暫時無法驗證管理員權限，請稍後再試。')
      setLoading(false)
      return
    }

    if (!admin || !isAdminRole(admin.role)) {
      await supabase.auth.signOut()
      setAdminError('此 Google 帳號不在推播管理員白名單中。')
      setLoading(false)
      return
    }

    setAdminRole(admin.role)
    setAdminError(null)
    setLoading(false)
  }

  async function handleLogout() {
    setAdminError(null)
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">載入中…</div>
      </div>
    )
  }

  if (!session || !adminRole) {
    return <LoginForm error={adminError} />
  }

  return <Dashboard role={adminRole} onLogout={handleLogout} />
}
