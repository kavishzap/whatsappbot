export type SystemRole = 'owner' | 'admin' | 'member'

export const ALLOWED_ROLES: SystemRole[] = ['owner', 'admin']

export function isAllowedRole(role: string | null | undefined): role is 'owner' | 'admin' {
  return role === 'owner' || role === 'admin'
}

export interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  system_role: SystemRole
  is_active: boolean
}
