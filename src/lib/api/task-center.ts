import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type { JavaApiResponse } from '@/types/magnet-ingest'
import type {
  OpenListManualMagnetRetryResult,
  OpenListReleaseRetryContext,
  OpenListReleaseRetryPayload,
  OpenListTaskCenterDetail,
  OpenListTaskCenterListData,
  OpenListTaskCenterListParams,
  OpenListTaskCenterTaskType,
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

export async function getOpenListTaskCenterDetail(
  taskType: OpenListTaskCenterTaskType | string,
  taskId: string,
  signal?: AbortSignal,
): Promise<OpenListTaskCenterDetail> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<OpenListTaskCenterDetail>
    >(
      `/api/v1/task-center/openlist-ingest/tasks/${encodeURIComponent(
        taskType.toLowerCase(),
      )}/${encodeURIComponent(taskId)}`,
      { signal },
    )

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.logs)
    ) {
      throw new Error(response.data.message || 'task center detail fetch failed')
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

export async function reuseOriginalOpenListManualMagnet(
  taskType: OpenListTaskCenterTaskType | string,
  taskId: string,
): Promise<OpenListManualMagnetRetryResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<OpenListManualMagnetRetryResult>
    >(
      `/api/v1/task-center/openlist-ingest/tasks/${encodeURIComponent(
        taskType.toLowerCase(),
      )}/${encodeURIComponent(
        taskId,
      )}/manual-magnet-retries/reuse-original`,
    )

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !response.data.data.detail_path
    ) {
      throw new Error(response.data.message || 'manual magnet retry failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || '创建重试任务失败，请稍后重试。',
    )
  }
}

export async function replaceOpenListManualMagnet(
  taskType: OpenListTaskCenterTaskType | string,
  taskId: string,
  magnet: string,
): Promise<OpenListManualMagnetRetryResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<OpenListManualMagnetRetryResult>
    >(
      `/api/v1/task-center/openlist-ingest/tasks/${encodeURIComponent(
        taskType.toLowerCase(),
      )}/${encodeURIComponent(taskId)}/manual-magnet-retries/replace-magnet`,
      { magnet },
    )

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !response.data.data.detail_path
    ) {
      throw new Error(response.data.message || 'manual magnet retry failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || '创建重试任务失败，请稍后重试。',
    )
  }
}

export async function retryOpenListAdultBatch(
  taskId: string,
  downloadLinks: string[],
): Promise<OpenListManualMagnetRetryResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<OpenListManualMagnetRetryResult>
    >(
      `/api/v1/task-center/openlist-ingest/tasks/adult/${encodeURIComponent(
        taskId,
      )}/batch-retries`,
      { download_links: downloadLinks },
    )

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !response.data.data.detail_path
    ) {
      throw new Error(response.data.message || 'adult batch retry failed')
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || '整批重新提交失败，请稍后重试。',
    )
  }
}

export async function getOpenListReleaseRetryContext(
  taskType: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<OpenListReleaseRetryContext> {
  try {
    const response = await javaApiClient.get<
      JavaApiResponse<OpenListReleaseRetryContext>
    >(
      `/api/v1/task-center/openlist-ingest/tasks/${encodeURIComponent(
        taskType.toLowerCase(),
      )}/${encodeURIComponent(taskId)}/release-retry-context`,
      { signal },
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || 'release retry context failed')
    }
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) || '发布资源恢复上下文加载失败。',
    )
  }
}

export async function retryOpenListWithSelectedRelease(
  taskType: string,
  taskId: string,
  release: OpenListReleaseRetryPayload,
): Promise<OpenListManualMagnetRetryResult> {
  try {
    const response = await javaApiClient.post<
      JavaApiResponse<OpenListManualMagnetRetryResult>
    >(
      `/api/v1/task-center/openlist-ingest/tasks/${encodeURIComponent(
        taskType.toLowerCase(),
      )}/${encodeURIComponent(taskId)}/release-retries`,
      {
        release_title: release.title,
        indexer: release.indexer,
        size: release.size,
        indexer_id: release.indexer_id,
        download_ref: release.download_ref,
        resolution_tags: release.resolution_tags,
        dynamic_range_tags: release.dynamic_range_tags,
      },
    )

    if (
      response.data.code !== 200 ||
      !response.data.data?.detail_path
    ) {
      throw new Error(response.data.message || 'release retry failed')
    }
    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) || '发布资源重试创建失败，请稍后重试。',
    )
  }
}
