import axios from 'axios'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''

export const apiClient = axios.create({
  baseURL: apiBaseUrl || undefined,
  timeout: 10000,
})

export default apiClient
