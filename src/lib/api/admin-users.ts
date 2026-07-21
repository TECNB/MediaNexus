import {
  getJavaErrorMessage,
  isJavaRequestCanceledError,
  javaApiClient,
} from '@/lib/java-api'
import type {
  AdminDefaultQuota,
  AdminUser,
  AdminUserListData,
  AdminUserListParams,
  AdminUserQuotaUpdatePayload,
  AdminUserSummary,
} from '@/types/admin-users'
import type { EmbyCredential } from '@/types/emby-account'

type JavaApiResponse<T> = {
  code: number
  message: string
  data: T | null
}

const ADMIN_USERS_ERROR_MESSAGE = '用户管理数据加载失败，请稍后重试。'
const ADMIN_USERS_ACTION_ERROR_MESSAGE = '用户管理操作失败，请稍后重试。'

export async function listAdminUsers(
  params: AdminUserListParams,
  signal?: AbortSignal,
): Promise<AdminUserListData> {
  try {
    const keyword = params.keyword?.trim()
    const response = await javaApiClient.get<JavaApiResponse<AdminUserListData>>(
      '/api/v1/admin/users',
      {
        params: {
          page: params.page,
          page_size: params.page_size,
          keyword: keyword || undefined,
          role: params.role,
          sort: params.sort,
        },
        signal,
      },
    )

    if (
      response.data.code !== 200 ||
      !response.data.data ||
      !Array.isArray(response.data.data.items)
    ) {
      throw new Error(response.data.message || ADMIN_USERS_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(getJavaErrorMessage(error) ?? ADMIN_USERS_ERROR_MESSAGE)
  }
}

export async function getAdminUserSummary(
  signal?: AbortSignal,
): Promise<AdminUserSummary> {
  try {
    const response = await javaApiClient.get<JavaApiResponse<AdminUserSummary>>(
      '/api/v1/admin/users/summary',
      { signal },
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || ADMIN_USERS_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(getJavaErrorMessage(error) ?? ADMIN_USERS_ERROR_MESSAGE)
  }
}

export async function getAdminDefaultQuota(
  signal?: AbortSignal,
): Promise<AdminDefaultQuota> {
  try {
    const response = await javaApiClient.get<JavaApiResponse<AdminDefaultQuota>>(
      '/api/v1/admin/quota/default',
      { signal },
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || ADMIN_USERS_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error)) {
      throw error
    }
    throw new Error(getJavaErrorMessage(error) ?? ADMIN_USERS_ERROR_MESSAGE)
  }
}

export async function updateAdminDefaultQuota(
  dailyContentCreateLimit: number,
): Promise<AdminDefaultQuota> {
  try {
    const response = await javaApiClient.put<JavaApiResponse<AdminDefaultQuota>>(
      '/api/v1/admin/quota/default',
      { daily_content_create_limit: dailyContentCreateLimit },
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || ADMIN_USERS_ACTION_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ?? ADMIN_USERS_ACTION_ERROR_MESSAGE,
    )
  }
}

export async function updateAdminUserQuota(
  userId: number,
  payload: AdminUserQuotaUpdatePayload,
): Promise<void> {
  try {
    const response = await javaApiClient.put<JavaApiResponse<unknown>>(
      `/api/v1/admin/users/${userId}/quota`,
      payload,
    )

    if (response.data.code !== 200) {
      throw new Error(response.data.message || ADMIN_USERS_ACTION_ERROR_MESSAGE)
    }
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ?? ADMIN_USERS_ACTION_ERROR_MESSAGE,
    )
  }
}

export async function resetAdminUserTodayUsage(
  userId: number,
): Promise<AdminUser> {
  try {
    const response = await javaApiClient.post<JavaApiResponse<AdminUser>>(
      `/api/v1/admin/users/${userId}/usage/reset-today`,
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || ADMIN_USERS_ACTION_ERROR_MESSAGE)
    }

    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ?? ADMIN_USERS_ACTION_ERROR_MESSAGE,
    )
  }
}

export async function deleteAdminUser(userId: number): Promise<void> {
  try {
    const response = await javaApiClient.delete<JavaApiResponse<unknown>>(
      `/api/v1/admin/users/${userId}`,
    )

    if (response.data.code !== 200) {
      throw new Error(response.data.message || ADMIN_USERS_ACTION_ERROR_MESSAGE)
    }
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ?? ADMIN_USERS_ACTION_ERROR_MESSAGE,
    )
  }
}

export async function getAdminUserEmbyCredential(
  userId: number,
): Promise<EmbyCredential> {
  try {
    const response = await javaApiClient.get<JavaApiResponse<EmbyCredential>>(
      `/api/v1/admin/users/${userId}/emby-credentials`,
    )

    if (response.data.code !== 200 || !response.data.data) {
      throw new Error(response.data.message || ADMIN_USERS_ACTION_ERROR_MESSAGE)
    }
    return response.data.data
  } catch (error) {
    throw new Error(
      getJavaErrorMessage(error) ?? ADMIN_USERS_ACTION_ERROR_MESSAGE,
    )
  }
}
