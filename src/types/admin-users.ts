export type AdminUserRole = 'ADMIN' | 'USER'

export type AdminUserRoleFilter = 'ALL' | AdminUserRole

export type AdminUserSort =
  | 'CREATED_AT_DESC'
  | 'CREATED_AT_ASC'
  | 'USED_COUNT_DESC'
  | 'USED_COUNT_ASC'

export type AdminQuotaSource =
  | 'GLOBAL_DEFAULT'
  | 'USER_OVERRIDE'
  | 'SYSTEM_UNLIMITED'

export type AdminUsageStatus =
  | 'AVAILABLE'
  | 'REACHED_LIMIT'
  | 'EXCEEDED'
  | 'UNLIMITED'

export type AdminUserUsageBreakdown = {
  magnet_ingest_create: number
  anime_subscribe_create: number
}

export type AdminUser = {
  id: number
  username: string
  email: string
  role: AdminUserRole
  daily_content_create_limit_override: number | null
  effective_daily_content_create_limit: number | null
  quota_source: AdminQuotaSource
  today_used_count: number
  usage_status: AdminUsageStatus
  usage_breakdown: AdminUserUsageBreakdown
  created_at: string
  updated_at: string
}

export type AdminUserListData = {
  items: AdminUser[]
  page: number
  page_size: number
  total: number
}

export type AdminUserSummary = {
  total_users: number
  normal_users: number
  highest_usage_count: number
  highest_usage_user_count: number
}

export type AdminDefaultQuota = {
  daily_content_create_limit: number
}

export type AdminUserQuotaUpdatePayload = {
  daily_content_create_limit_override: number | null
}

export type AdminUserListParams = {
  page: number
  page_size: number
  keyword?: string
  role?: AdminUserRoleFilter
  sort?: AdminUserSort
}
