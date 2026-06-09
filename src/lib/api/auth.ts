import { getJavaErrorMessage, javaApiClient } from '@/lib/java-api'
import type {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthSession,
  AuthUser,
} from '@/types/auth'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

const AUTH_LOGIN_ERROR_MESSAGE = '登录失败，请稍后重试。'
const AUTH_REGISTER_ERROR_MESSAGE = '注册失败，请稍后重试。'
const AUTH_ME_ERROR_MESSAGE = '登录状态已过期，请重新登录。'

export async function login(payload: AuthLoginPayload): Promise<AuthSession> {
  try {
    const response = await javaApiClient.post<JavaApiResponse<AuthSession>>(
      '/api/v1/auth/login',
      payload,
    )

    if (response.data.code !== 200 || !response.data.data?.token) {
      throw new Error(response.data.message || AUTH_LOGIN_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) ?? AUTH_LOGIN_ERROR_MESSAGE)
  }
}

export async function register(
  payload: AuthRegisterPayload,
): Promise<AuthSession> {
  try {
    const response = await javaApiClient.post<JavaApiResponse<AuthSession>>(
      '/api/v1/auth/register',
      payload,
    )

    if (response.data.code !== 200 || !response.data.data?.token) {
      throw new Error(response.data.message || AUTH_REGISTER_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) ?? AUTH_REGISTER_ERROR_MESSAGE)
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  try {
    const response =
      await javaApiClient.get<JavaApiResponse<AuthUser>>('/api/v1/auth/me')

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || AUTH_ME_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    throw new Error(getJavaErrorMessage(error) ?? AUTH_ME_ERROR_MESSAGE)
  }
}

export async function logout(): Promise<void> {
  await javaApiClient.post('/api/v1/auth/logout')
}

