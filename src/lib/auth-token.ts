export const AUTH_TOKEN_STORAGE_KEY = 'medianexus.auth.token'
export const AUTH_TOKEN_CHANGE_EVENT = 'medianexus:auth-token-change'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function emitAuthTokenChange() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGE_EVENT))
}

export function getAuthToken() {
  if (!canUseLocalStorage()) {
    return null
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function setAuthToken(token: string) {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  emitAuthTokenChange()
}

export function clearAuthToken() {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  emitAuthTokenChange()
}
