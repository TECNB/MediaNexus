export type AuthUserRole = 'ADMIN' | 'USER'

export type AuthUser = {
  id: number
  username: string
  email: string
  role: AuthUserRole
  created_at: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type AuthLoginPayload = {
  account: string
  password: string
}

export type AuthRegisterPayload = {
  username: string
  email: string
  password: string
  confirm_password: string
  registration_code: string
}

