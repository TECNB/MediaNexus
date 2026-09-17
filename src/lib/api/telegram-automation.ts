import { getJavaErrorMessage, isJavaRequestCanceledError, javaApiClient } from '@/lib/java-api'
import type { JavaApiResponse } from '@/types/javdb-automation'
import type {
  TelegramAutomationConfig,
  TelegramAutomationOverview,
  TelegramAutomationRun,
  TelegramAutomationRunList,
  TelegramBackfillPayload,
  TelegramConfigUpdatePayload,
  TelegramResolvedSource,
} from '@/types/telegram-automation'

const ERROR_MESSAGE = 'Telegram 自动化处理失败，请稍后重试。'

async function request<T>(requester: () => Promise<{ data: JavaApiResponse<T> }>) {
  try {
    const response = await requester()
    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || ERROR_MESSAGE)
    }
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(getJavaErrorMessage(error) ?? ERROR_MESSAGE)
  }
}

export function getTelegramAutomationOverview(signal?: AbortSignal) {
  return request<TelegramAutomationOverview>(() =>
    javaApiClient.get('/api/v1/admin/telegram-automation', { signal }),
  )
}

export function updateTelegramAutomationConfig(payload: TelegramConfigUpdatePayload) {
  return request<TelegramAutomationConfig>(() =>
    javaApiClient.put('/api/v1/admin/telegram-automation/config', payload),
  )
}

export function resolveTelegramSource(sourceRef: string) {
  return request<TelegramResolvedSource>(() =>
    javaApiClient.post('/api/v1/admin/telegram-automation/sources/resolve', {
      source_ref: sourceRef,
    }),
  )
}

export function startTelegramFollowDryRun() {
  return request<TelegramAutomationRun>(() =>
    javaApiClient.post('/api/v1/admin/telegram-automation/runs/follow/dry-run'),
  )
}

export function startTelegramFollow() {
  return request<TelegramAutomationRun>(() =>
    javaApiClient.post('/api/v1/admin/telegram-automation/runs/follow'),
  )
}

export function startTelegramBackfillDryRun(
  channelId: string,
  payload: TelegramBackfillPayload,
) {
  return request<TelegramAutomationRun>(() =>
    javaApiClient.post(
      `/api/v1/admin/telegram-automation/channels/${encodeURIComponent(channelId)}/backfill/dry-run`,
      payload,
    ),
  )
}

export function startTelegramBackfill(
  channelId: string,
  payload: TelegramBackfillPayload,
) {
  return request<TelegramAutomationRun>(() =>
    javaApiClient.post(
      `/api/v1/admin/telegram-automation/channels/${encodeURIComponent(channelId)}/backfill`,
      payload,
    ),
  )
}

export function listTelegramAutomationRuns(page = 1, pageSize = 20) {
  return request<TelegramAutomationRunList>(() =>
    javaApiClient.get('/api/v1/admin/telegram-automation/runs', {
      params: { page, page_size: pageSize },
    }),
  )
}

export function getTelegramAutomationRun(runId: string) {
  return request<TelegramAutomationRun>(() =>
    javaApiClient.get(`/api/v1/admin/telegram-automation/runs/${encodeURIComponent(runId)}`),
  )
}
