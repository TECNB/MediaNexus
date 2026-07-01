import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type { JavaApiResponse } from '@/types/magnet-ingest'
import type {
  OpenListTaskCenterListData,
  OpenListTaskCenterListParams,
} from '@/types/task-center'

const JAVA_TASK_CENTER_ERROR_MESSAGE = '任务中心加载失败，请稍后重试。'

export async function listOpenListTaskCenterItems(
  params: OpenListTaskCenterListParams,
  signal?: AbortSignal,
): Promise<OpenListTaskCenterListData> {
  try {
    const keyword = params.keyword?.trim()
    const response = await javaApiClient.get<
      JavaApiResponse<OpenListTaskCenterListData>
    >('/api/v1/task-center/openlist-ingest/tasks', {
      params: {
        view: params.view,
        product_type: params.product_type,
        source_type: params.source_type,
        keyword: keyword || undefined,
        page: params.page,
        page_size: params.page_size,
      },
      signal,
    })

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items) ||
      typeof response.data.data.total !== 'number'
    ) {
      throw new Error(response.data.message || 'task center fetch failed')
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) || JAVA_TASK_CENTER_ERROR_MESSAGE,
    )
  }
}
