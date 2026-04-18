import axios from 'axios'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
export const API_REQUEST_TIMEOUT_MS = 60_000

export const apiClient = axios.create({
  baseURL: apiBaseUrl || undefined,
  timeout: API_REQUEST_TIMEOUT_MS,
})

export default apiClient
