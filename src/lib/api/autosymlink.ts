import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  AutoSymlinkRefreshResult,
  AutoSymlinkRefreshTarget,
} from '@/types/autosymlink'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

const AUTOSYMLINK_REFRESH_ERROR_MESSAGE =
  'AutoSymlink 同步任务提交失败，请稍后重试。'

export async function refreshAutoSymlink(
  target: AutoSymlinkRefreshTarget,
): Promise<AutoSymlinkRefreshResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<AutoSymlinkRefreshResult>
    >('/api/v1/admin/autosymlink/refresh', { target })

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(
        response.data.message || AUTOSYMLINK_REFRESH_ERROR_MESSAGE,
      )
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? AUTOSYMLINK_REFRESH_ERROR_MESSAGE,
    )
  }
}
