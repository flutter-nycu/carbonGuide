import { useEffect, useRef, useState } from 'react'
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
  const authRevision = useRef(0)

  useEffect(() => {
    let alive = true
    let authChanged = false
    const acceptSession = (current: Session | null) => {
      authRevision.current++
      setAdminRole(null)
      setSession(current ? { ...current } : null)
      setLoading(Boolean(current))
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, current) => {
      authChanged = true
      if (alive) acceptSession(current)
    })
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (alive && !authChanged) acceptSession(current)
    }).catch(() => {
      if (alive && !authChanged) {
        setAdminError('暫時無法讀取登入狀態，請重新登入。')
        setLoading(false)
      }
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const current = session
    const revision = authRevision.current
    async function verifyAdmin() {
      let message: string | null = null
      let role: AdminRole | null = null
      try {
        if (!isAllowedPushAdminEmail(current.user.email)) {
          message = '此 Google 帳號不在推播管理員白名單中。'
        } else {
          const { data: admin, error } = await supabase.from('admin_users')
            .select('role').eq('auth_user_id', current.user.id).maybeSingle()
          if (error) message = '暫時無法驗證管理員權限，請稍後再試。'
          else if (!admin || !isAdminRole(admin.role)) message = '此 Google 帳號不在推播管理員白名單中。'
          else role = admin.role
        }
      } catch {
        message = '暫時無法驗證管理員權限，請稍後再試。'
      }
      if (cancelled || revision !== authRevision.current) return
      setAdminRole(role)
      setAdminError(message)
      setLoading(false)
      if (!role) {
        setSession(null)
        // Local denial is immediate even if remote sign-out is unavailable.
        void supabase.auth.signOut().catch(() => {})
      }
    }
    void verifyAdmin()
    return () => { cancelled = true }
  }, [session])

  async function handleLogout() {
    authRevision.current++
    setAdminRole(null)
    setSession(null)
    setAdminError(null)
    const { error } = await supabase.auth.signOut().catch(() => ({ error: true }))
    if (error) setAdminError('工作台已關閉；登出未完成，請檢查網路後重試。')
  }

  if (loading) return <div className="login-page"><p role="status">正在確認管理員權限…</p></div>
  if (!session || !adminRole) return <LoginForm error={adminError} />
  return <Dashboard key={session.user.id} role={adminRole} onLogout={handleLogout} />
}
