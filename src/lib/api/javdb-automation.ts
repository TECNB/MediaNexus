import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  JavaApiResponse,
  JavdbAutomationConfig,
  JavdbAutomationOverview,
  JavdbAutomationRun,
  JavdbAutomationRunList,
  JavdbCredentialStatus,
  UpdateJavdbAutomationConfigPayload,
} from '@/types/javdb-automation'

const JAVDB_AUTOMATION_ERROR_MESSAGE = 'JAVDB 自动化处理失败，请稍后重试。'

async function request<T>(requester: () => Promise<{ data: JavaApiResponse<T> }>) {
  try {
    const response = await requester()
    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || JAVDB_AUTOMATION_ERROR_MESSAGE)
    }
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(
      getJavaErrorMessage(error) ?? JAVDB_AUTOMATION_ERROR_MESSAGE,
    )
  }
}

export function getJavdbAutomationOverview(signal?: AbortSignal) {
  return request<JavdbAutomationOverview>(() =>
    javaApiClient.get<JavaApiResponse<JavdbAutomationOverview>>(
      '/api/v1/admin/javdb-automation',
      { signal },
    ),
  )
}

export function updateJavdbAutomationConfig(
  payload: UpdateJavdbAutomationConfigPayload,
) {
  return request<JavdbAutomationConfig>(() =>
    javaApiClient.put<JavaApiResponse<JavdbAutomationConfig>>(
      '/api/v1/admin/javdb-automation/config',
      payload,
    ),
  )
}

export function updateJavdbCookie(cookie: string) {
  return request<JavdbCredentialStatus>(() =>
    javaApiClient.put<JavaApiResponse<JavdbCredentialStatus>>(
      '/api/v1/admin/javdb-automation/credential',
      { cookie },
    ),
  )
}

export function startJavdbDryRun() {
  return request<JavdbAutomationRun>(() =>
    javaApiClient.post<JavaApiResponse<JavdbAutomationRun>>(
      '/api/v1/admin/javdb-automation/runs/dry-run',
    ),
  )
}

export function startJavdbExecution() {
  return request<JavdbAutomationRun>(() =>
    javaApiClient.post<JavaApiResponse<JavdbAutomationRun>>(
      '/api/v1/admin/javdb-automation/runs',
    ),
  )
}

export function listJavdbAutomationRuns(page = 1, pageSize = 20) {
  return request<JavdbAutomationRunList>(() =>
    javaApiClient.get<JavaApiResponse<JavdbAutomationRunList>>(
      '/api/v1/admin/javdb-automation/runs',
      { params: { page, page_size: pageSize } },
    ),
  )
}

export function getJavdbAutomationRun(runId: string) {
  return request<JavdbAutomationRun>(() =>
    javaApiClient.get<JavaApiResponse<JavdbAutomationRun>>(
      `/api/v1/admin/javdb-automation/runs/${encodeURIComponent(runId)}`,
    ),
  )
}
