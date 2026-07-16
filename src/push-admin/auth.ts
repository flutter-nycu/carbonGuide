export const ADMIN_ROLES = ['owner', 'editor', 'viewer'] as const
export const PUSH_ADMIN_EMAIL = 'j20692091@gmail.com'

export type AdminRole = (typeof ADMIN_ROLES)[number]
export type AdminTab = 'system' | 'rules' | 'history' | 'usage'

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' &&
    (ADMIN_ROLES as readonly string[]).includes(value)
}

export function isAllowedPushAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === PUSH_ADMIN_EMAIL
}

export function canWritePushAdmin(role: AdminRole): boolean {
  return role === 'owner' || role === 'editor'
}

export function visibleAdminTabs(role: AdminRole): readonly AdminTab[] {
  return canWritePushAdmin(role)
    ? ['system', 'rules', 'history', 'usage']
    : ['history', 'usage']
}

export function pushAdminRedirectUrl(origin: string): string {
  return new URL('/push-admin', origin).toString()
}

export function oauthErrorFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return params.get('error_description')
}
