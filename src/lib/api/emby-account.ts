import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type { EmbyCredential } from '@/types/emby-account'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

const EMBY_CREDENTIAL_ERROR_MESSAGE = 'Emby 账号加载失败，请稍后重试。'

export async function getCurrentEmbyCredential(
  signal?: AbortSignal,
): Promise<EmbyCredential> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<EmbyCredential>
    >('/api/v1/emby/account/credentials', { signal })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || EMBY_CREDENTIAL_ERROR_MESSAGE)
    }
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? EMBY_CREDENTIAL_ERROR_MESSAGE,
    )
  }
}
