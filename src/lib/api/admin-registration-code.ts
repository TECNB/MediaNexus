import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type { AdminRegistrationCode } from '@/types/admin-users'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

const ADMIN_REGISTRATION_CODE_ERROR_MESSAGE =
  '注册码数据加载失败，请稍后重试。'
const ADMIN_REGISTRATION_CODE_ACTION_ERROR_MESSAGE =
  '注册码操作失败，请稍后重试。'

export async function getAdminRegistrationCode(
  signal?: AbortSignal,
): Promise<AdminRegistrationCode> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<AdminRegistrationCode>
    >('/api/v1/admin/registration-code', { signal })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(
        response.data.message || ADMIN_REGISTRATION_CODE_ERROR_MESSAGE,
      )
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? ADMIN_REGISTRATION_CODE_ERROR_MESSAGE,
    )
  }
}

export async function generateAdminRegistrationCode(): Promise<AdminRegistrationCode> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<AdminRegistrationCode>
    >('/api/v1/admin/registration-code/generate')

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(
        response.data.message || ADMIN_REGISTRATION_CODE_ACTION_ERROR_MESSAGE,
      )
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ??
        ADMIN_REGISTRATION_CODE_ACTION_ERROR_MESSAGE,
    )
  }
}
