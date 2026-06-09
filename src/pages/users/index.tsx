import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getAdminDefaultQuota,
  getAdminUserSummary,
  listAdminUsers,
  resetAdminUserTodayUsage,
  updateAdminDefaultQuota,
  updateAdminUserQuota,
} from '@/lib/api/admin-users'
import { isJavaRequestCanceledError } from '@/lib/java-api'
import { useAuth } from '@/lib/use-auth'
import { cn } from '@/lib/utils'
import type {
  AdminDefaultQuota,
  AdminQuotaSource,
  AdminUsageStatus,
  AdminUser,
  AdminUserListData,
  AdminUserRoleFilter,
  AdminUserSort,
  AdminUserSummary,
} from '@/types/admin-users'

type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
type ActionStatus = 'idle' | 'saving'

const PAGE_SIZE = 20

const roleFilters: Array<{ label: string; value: AdminUserRoleFilter }> = [
  { label: '全部', value: 'ALL' },
  { label: '普通用户', value: 'USER' },
  { label: '管理员', value: 'ADMIN' },
]

const sortOptions: Array<{ label: string; value: AdminUserSort }> = [
  { label: '注册时间倒序', value: 'CREATED_AT_DESC' },
  { label: '注册时间正序', value: 'CREATED_AT_ASC' },
  { label: '今日已用从高到低', value: 'USED_COUNT_DESC' },
  { label: '今日已用从低到高', value: 'USED_COUNT_ASC' },
]

const roleLabel = {
  ADMIN: '管理员',
  USER: '普通用户',
} satisfies Record<AdminUser['role'], string>

const quotaSourceLabel = {
  GLOBAL_DEFAULT: '全局默认',
  USER_OVERRIDE: '用户覆盖',
  SYSTEM_UNLIMITED: '系统无限制',
} satisfies Record<AdminQuotaSource, string>

const usageStatusLabel = {
  AVAILABLE: '可用',
  REACHED_LIMIT: '已达上限',
  EXCEEDED: '已超额',
  UNLIMITED: '无限制',
} satisfies Record<AdminUsageStatus, string>

function formatDateTime(value: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function clampQuotaInput(value: string) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return ''
  }
  return String(Math.min(9, Math.max(0, Math.trunc(numberValue))))
}

function isValidQuotaValue(value: string) {
  if (!/^\d$/.test(value)) {
    return false
  }
  const numberValue = Number(value)
  return numberValue >= 0 && numberValue <= 9
}

function usageStatusClass(status: AdminUsageStatus) {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'REACHED_LIMIT':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'EXCEEDED':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    case 'UNLIMITED':
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

function ForbiddenUsersPage() {
  const navigate = useNavigate()

  return (
    <PageContainer
      title="无权限"
      description="你没有访问用户管理的权限。"
    >
      <div className="rounded-2xl bg-white p-8 shadow-shell ring-1 ring-slate-200">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-slate-950">
                你没有访问用户管理的权限
              </p>
              <p className="mt-1 text-sm text-slate-500">
                该页面仅管理员可见。
              </p>
            </div>
            <Button onClick={() => navigate('/resources')} type="button">
              返回资源搜索
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-shell ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function UserManagementPageContent() {
  const [usersData, setUsersData] = useState<AdminUserListData | null>(null)
  const [summary, setSummary] = useState<AdminUserSummary | null>(null)
  const [defaultQuota, setDefaultQuota] = useState<AdminDefaultQuota | null>(
    null,
  )
  const [defaultQuotaDraft, setDefaultQuotaDraft] = useState('3')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>('ALL')
  const [sort, setSort] = useState<AdminUserSort>('CREATED_AT_DESC')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [globalQuotaStatus, setGlobalQuotaStatus] =
    useState<ActionStatus>('idle')
  const [globalQuotaError, setGlobalQuotaError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editingQuotaValue, setEditingQuotaValue] = useState('3')
  const [editingStatus, setEditingStatus] = useState<ActionStatus>('idle')
  const [editingError, setEditingError] = useState<string | null>(null)
  const [resettingUserId, setResettingUserId] = useState<number | null>(null)

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading')
      setErrorMessage(null)

      try {
        const [summaryData, quotaData, listData] = await Promise.all([
          getAdminUserSummary(signal),
          getAdminDefaultQuota(signal),
          listAdminUsers(
            {
              page,
              page_size: PAGE_SIZE,
              keyword: debouncedSearch,
              role: roleFilter,
              sort,
            },
            signal,
          ),
        ])

        setSummary(summaryData)
        setDefaultQuota(quotaData)
        setDefaultQuotaDraft(String(quotaData.daily_content_create_limit))
        setUsersData(listData)
        setStatus('success')
      } catch (error) {
        if (isJavaRequestCanceledError(error)) {
          return
        }
        setStatus('error')
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '用户管理数据加载失败，请稍后重试。',
        )
      }
    },
    [debouncedSearch, page, roleFilter, sort],
  )

  useEffect(() => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    const controller = new AbortController()
    void loadUsers(controller.signal)

    return () => controller.abort()
  }, [loadUsers])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setToastMessage(null)
    }, 3200)

    return () => clearTimeout(timeoutId)
  }, [toastMessage])

  const users = usersData?.items ?? []
  const total = usersData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(total, page * PAGE_SIZE)
  const hasGlobalQuotaChange =
    defaultQuota !== null &&
    isValidQuotaValue(defaultQuotaDraft) &&
    Number(defaultQuotaDraft) !== defaultQuota.daily_content_create_limit

  const highestUsageLabel = useMemo(() => {
    if (!summary || summary.highest_usage_count <= 0) {
      return '0 次 · 暂无使用'
    }
    return `${summary.highest_usage_count} 次 · ${summary.highest_usage_user_count} 人达到`
  }, [summary])

  async function handleSaveGlobalQuota() {
    if (!isValidQuotaValue(defaultQuotaDraft)) {
      setGlobalQuotaError('额度必须为 0-9 的整数')
      return
    }

    setGlobalQuotaStatus('saving')
    setGlobalQuotaError(null)
    try {
      const nextQuota = await updateAdminDefaultQuota(Number(defaultQuotaDraft))
      setDefaultQuota(nextQuota)
      setDefaultQuotaDraft(String(nextQuota.daily_content_create_limit))
      setToastMessage(
        `全局默认额度已更新为 ${nextQuota.daily_content_create_limit} 次/日`,
      )
      await loadUsers()
    } catch (error) {
      setGlobalQuotaError(
        error instanceof Error ? error.message : '全局默认额度保存失败',
      )
    } finally {
      setGlobalQuotaStatus('idle')
    }
  }

  function openQuotaEditor(user: AdminUser) {
    setEditingUser(user)
    setEditingError(null)
    setEditingQuotaValue(
      String(
        user.daily_content_create_limit_override ??
          user.effective_daily_content_create_limit ??
          defaultQuota?.daily_content_create_limit ??
          3,
      ),
    )
  }

  async function handleSaveUserQuota() {
    if (!editingUser) {
      return
    }
    if (!isValidQuotaValue(editingQuotaValue)) {
      setEditingError('额度必须为 0-9 的整数')
      return
    }

    setEditingStatus('saving')
    setEditingError(null)
    try {
      await updateAdminUserQuota(editingUser.id, {
        daily_content_create_limit_override: Number(editingQuotaValue),
      })
      setToastMessage(`已更新 ${editingUser.username} 的用户覆盖额度`)
      setEditingUser(null)
      await loadUsers()
    } catch (error) {
      setEditingError(
        error instanceof Error ? error.message : '用户额度保存失败',
      )
    } finally {
      setEditingStatus('idle')
    }
  }

  async function handleRestoreDefaultQuota() {
    if (!editingUser) {
      return
    }

    setEditingStatus('saving')
    setEditingError(null)
    try {
      await updateAdminUserQuota(editingUser.id, {
        daily_content_create_limit_override: null,
      })
      setToastMessage(`已恢复 ${editingUser.username} 的全局默认额度`)
      setEditingUser(null)
      await loadUsers()
    } catch (error) {
      setEditingError(
        error instanceof Error ? error.message : '恢复全局默认失败',
      )
    } finally {
      setEditingStatus('idle')
    }
  }

  async function handleResetUsage(user: AdminUser) {
    setResettingUserId(user.id)
    try {
      await resetAdminUserTodayUsage(user.id)
      setToastMessage(`已重置 ${user.username} 今日次数`)
      await loadUsers()
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : '重置失败')
    } finally {
      setResettingUserId(null)
    }
  }

  async function handleCopyUserId(userId: number) {
    try {
      await navigator.clipboard.writeText(String(userId))
      setToastMessage(`已复制用户 ID: ${userId}`)
    } catch {
      setToastMessage('复制失败，请手动复制')
    }
  }

  return (
    <TooltipProvider>
      <PageContainer
        title="用户管理"
        description="查看用户额度与今日使用情况。"
      >
        <div className="space-y-5">
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="刷新数据"
                  disabled={status === 'loading'}
                  onClick={() => void loadUsers()}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4',
                      status === 'loading' && 'animate-spin',
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>刷新数据</TooltipContent>
            </Tooltip>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="总用户数" value={summary?.total_users ?? '-'} />
              <MetricCard
                label="普通用户数"
                value={summary?.normal_users ?? '-'}
              />
              <MetricCard label="今日最高用量" value={highestUsageLabel} />
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    全局默认额度
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    影响未设置用户覆盖额度的普通用户。
                  </p>
                </div>
                <Users className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-5 flex items-center gap-3">
                <input
                  aria-label="全局默认额度"
                  className="h-10 w-20 rounded-xl bg-slate-100 px-3 text-center text-sm font-semibold text-slate-950 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-slate-300"
                  max={9}
                  min={0}
                  onChange={(event) =>
                    setDefaultQuotaDraft(clampQuotaInput(event.target.value))
                  }
                  type="number"
                  value={defaultQuotaDraft}
                />
                <span className="text-sm text-slate-500">次/日</span>
                <Button
                  disabled={
                    globalQuotaStatus === 'saving' || !hasGlobalQuotaChange
                  }
                  onClick={() => void handleSaveGlobalQuota()}
                  size="sm"
                  type="button"
                >
                  {globalQuotaStatus === 'saving' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  保存
                </Button>
              </div>
              {globalQuotaError ? (
                <p className="mt-3 text-sm text-rose-600" role="alert">
                  {globalQuotaError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-shell ring-1 ring-slate-200">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-10 w-full rounded-xl bg-slate-100 pl-10 pr-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-slate-300"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索用户名或邮箱"
                  value={search}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  aria-label="角色筛选"
                  className="inline-flex rounded-xl bg-slate-100 p-1"
                  role="tablist"
                >
                  {roleFilters.map((item) => (
                    <button
                      aria-selected={roleFilter === item.value}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition',
                        roleFilter === item.value
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900',
                      )}
                      key={item.value}
                      onClick={() => {
                        setRoleFilter(item.value)
                        setPage(1)
                      }}
                      role="tab"
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <select
                  className="h-10 rounded-xl bg-slate-100 px-3 text-sm font-medium text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-slate-300"
                  onChange={(event) => {
                    setSort(event.target.value as AdminUserSort)
                    setPage(1)
                  }}
                  value={sort}
                >
                  {sortOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-shell ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4">用户</th>
                    <th className="px-5 py-4">邮箱</th>
                    <th className="px-5 py-4">角色</th>
                    <th className="px-5 py-4">今日已用/额度</th>
                    <th className="px-5 py-4">额度来源</th>
                    <th className="px-5 py-4">注册时间</th>
                    <th className="px-5 py-4">最后更新时间</th>
                    <th className="px-5 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {users.map((user) => {
                    const isAdminUser = user.role === 'ADMIN'
                    const isResetting = resettingUserId === user.id
                    const quotaLabel = isAdminUser
                      ? '无限制'
                      : `${user.today_used_count} / ${user.effective_daily_content_create_limit}`

                    return (
                      <tr className="hover:bg-slate-50/80" key={user.id}>
                        <td className="px-5 py-4 align-middle">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-950">
                              {user.username}
                            </p>
                            <button
                              className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-700"
                              onClick={() => void handleCopyUserId(user.id)}
                              type="button"
                            >
                              ID: {user.id}
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {user.email}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {roleLabel[user.role]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex cursor-default items-center gap-2">
                                <span className="font-semibold text-slate-950">
                                  {quotaLabel}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                                    usageStatusClass(user.usage_status),
                                  )}
                                >
                                  {usageStatusLabel[user.usage_status]}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="space-y-1 text-left">
                              <p>
                                磁链入库创建：
                                {user.usage_breakdown.magnet_ingest_create}
                              </p>
                              <p>
                                动漫订阅创建：
                                {user.usage_breakdown.anime_subscribe_create}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {quotaSourceLabel[user.quota_source]}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {formatDateTime(user.created_at)}
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {formatDateTime(user.updated_at)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              disabled={isAdminUser}
                              onClick={() => openQuotaEditor(user)}
                              size="sm"
                              type="button"
                            >
                              <Pencil className="h-4 w-4" />
                              修改额度
                            </Button>
                            <Button
                              disabled={isAdminUser || isResetting}
                              onClick={() => void handleResetUsage(user)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {isResetting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                              重置
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {status === 'loading' && users.length === 0 ? (
              <div className="flex items-center justify-center gap-3 px-5 py-12 text-sm font-medium text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载用户
              </div>
            ) : null}

            {status === 'error' ? (
              <div className="px-5 py-8 text-center" role="alert">
                <p className="text-sm font-medium text-rose-600">
                  {errorMessage}
                </p>
                <Button
                  className="mt-4"
                  onClick={() => void loadUsers()}
                  type="button"
                  variant="outline"
                >
                  重试
                </Button>
              </div>
            ) : null}

            {status !== 'loading' && users.length === 0 && status !== 'error' ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                {debouncedSearch ? '没有匹配的用户' : '暂无用户'}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 bg-slate-50 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                第 {pageStart}-{pageEnd} 条，共 {total} 条
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={page <= 1 || status === 'loading'}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  上一页
                </Button>
                <span className="px-2 text-xs font-semibold text-slate-500">
                  {page} / {totalPages}
                </span>
                <Button
                  disabled={page >= totalPages || status === 'loading'}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        </div>

        {editingUser ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    修改额度
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingUser.username} · {editingUser.email}
                  </p>
                </div>
                <button
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setEditingUser(null)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">当前全局默认额度</span>
                  <span className="font-semibold text-slate-900">
                    {defaultQuota?.daily_content_create_limit ?? '-'} 次/日
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">当前有效额度</span>
                  <span className="font-semibold text-slate-900">
                    {editingUser.effective_daily_content_create_limit ?? '-'} 次/日
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">当前来源</span>
                  <span className="font-semibold text-slate-900">
                    {quotaSourceLabel[editingUser.quota_source]}
                  </span>
                </div>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-700">
                用户覆盖额度
                <div className="mt-2 flex items-center gap-3">
                  <input
                    className="h-11 w-24 rounded-xl bg-slate-100 px-3 text-center text-sm font-semibold text-slate-950 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-slate-300"
                    max={9}
                    min={0}
                    onChange={(event) =>
                      setEditingQuotaValue(clampQuotaInput(event.target.value))
                    }
                    type="number"
                    value={editingQuotaValue}
                  />
                  <span className="text-sm text-slate-500">次/日</span>
                </div>
              </label>

              {editingError ? (
                <p className="mt-4 text-sm text-rose-600" role="alert">
                  {editingError}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  disabled={editingStatus === 'saving'}
                  onClick={() => void handleRestoreDefaultQuota()}
                  type="button"
                  variant="outline"
                >
                  恢复全局默认
                </Button>
                <div className="flex gap-3">
                  <Button
                    disabled={editingStatus === 'saving'}
                    onClick={() => setEditingUser(null)}
                    type="button"
                    variant="ghost"
                  >
                    取消
                  </Button>
                  <Button
                    disabled={editingStatus === 'saving'}
                    onClick={() => void handleSaveUserQuota()}
                    type="button"
                  >
                    {editingStatus === 'saving' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    保存覆盖额度
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {toastMessage ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-2xl">
            {toastMessage}
          </div>
        ) : null}
      </PageContainer>
    </TooltipProvider>
  )
}

export function UserManagementPage() {
  const { user } = useAuth()

  if (user?.role !== 'ADMIN') {
    return <ForbiddenUsersPage />
  }

  return <UserManagementPageContent />
}
