import axios, { AxiosHeaders } from 'axios'

import { clearAuthToken, getAuthToken } from '@/lib/auth-token'
import { API_REQUEST_TIMEOUT_MS } from '@/lib/axios'

const javaApiBaseUrl =
  import.meta.env.VITE_JAVA_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

export const javaApiClient = axios.create({
  baseURL: javaApiBaseUrl || undefined,
  timeout: API_REQUEST_TIMEOUT_MS,
})

javaApiClient.interceptors.request.use((config) => {
  const token = getAuthToken()

  if (token) {
    config.headers = AxiosHeaders.from(config.headers)
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})

javaApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuthToken()
    }

    return Promise.reject(error)
  },
)

export function getJavaErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message

    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return null
}

export function isJavaRequestCanceledError(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  )
}

