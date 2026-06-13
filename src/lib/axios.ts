import axios from 'axios'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
export const API_REQUEST_TIMEOUT_MS = 60_000

export const apiClient = axios.create({
  baseURL: apiBaseUrl || undefined,
  timeout: API_REQUEST_TIMEOUT_MS,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    logApiRequestFailure(error)
    return Promise.reject(error)
  },
)

function logApiRequestFailure(error: unknown) {
  if (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  ) {
    return
  }

  if (axios.isAxiosError(error)) {
    console.warn('Core API request failed', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      code: error.code,
      message: getAxiosErrorMessage(error),
    })
    return
  }

  if (error instanceof Error) {
    console.warn('Core API request failed', { message: error.message })
  }
}

function getAxiosErrorMessage(error: unknown) {
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

export default apiClient
