import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  getTelegramAutomationOverview,
  getTelegramAutomationRun,
  listTelegramAutomationRuns,
  resolveTelegramSource,
  startTelegramBackfill,
  startTelegramBackfillDryRun,
  startTelegramFollow,
  startTelegramFollowDryRun,
  updateTelegramAutomationConfig,
} from '@/lib/api/telegram-automation'
import { getJavaErrorMessage, isJavaRequestCanceledError } from '@/lib/java-api'
import { telegramResourceModeDefaults } from '@/lib/telegram-channel-defaults'
import { cn } from '@/lib/utils'
import type {
  TelegramAutomationOverview,
  TelegramAutomationRun,
  TelegramBackfillPayload,
  TelegramChannelConfig,
  TelegramChannelInput,
  TelegramConfigUpdatePayload,
  TelegramResourceResult,
} from '@/types/telegram-automation'

type EditableChannel = TelegramChannelInput & {
  source_title: string | null
  source_username: string | null
}

type ConfigForm = {
  enabled: boolean
  target: string
  channels: EditableChannel[]
}

const HISTORY_PAGE_SIZE = 20

const runStatusCopy: Record<string, string> = {
  RUNNING: '运行中',
  SUCCEEDED: '成功',
  PARTIAL_SUCCESS: '部分成功',
  FAILED: '失败',
  INTERRUPTED: '已中断',
}

const modeCopy: Record<string, string> = {
  FOLLOW: '正式追更',
  FOLLOW_DRY_RUN: '追更试运行',
  BACKFILL: '历史回溯',
  BACKFILL_DRY_RUN: '回溯试运行',
}

const stageCopy: Record<string, string> = {
  QUEUED: '等待执行',
  COUNTING_PIKPAK_INBOX: '统计 PikPak 收件箱',
  FORWARDING_CHANNELS: '转发频道资源',
  BACKFILLING_CHANNEL: '转发历史资源',
  WAITING_PIKPAK_FILES: '等待 PikPak 文件到齐并移动',
  REFRESHING_ADULT_AUTOSYMLINK: '刷新 Adult AutoSymlink',
  MEDIA_DELIVERY_FAILED: '媒体入库失败',
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatRate(value: number | null | undefined) {
  return value == null ? '-' : `${(value * 100).toFixed(3)}%`
}

function formatDuration(value: number | null) {
  if (value == null) return '-'
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}分${seconds}秒`
}

function statusTone(status: string) {
  if (status === 'SUCCEEDED' || status === 'FORWARDED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (status === 'FAILED' || status === 'INTERRUPTED' || status === 'PARTIAL_SUCCESS') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (status === 'RUNNING' || status === 'DRY_RUN_SELECTED') return 'bg-sky-50 text-sky-700 ring-sky-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function editableChannel(channel: TelegramChannelConfig): EditableChannel {
  return {
    id: channel.id,
    source_ref: String(channel.source_id),
    source_title: channel.source_title,
    source_username: channel.source_username,
    enabled: channel.enabled,
    percentile: channel.percentile,
    resource_mode: channel.resource_mode,
    min_video_duration: channel.min_video_duration,
    min_views: channel.min_views,
    min_forwards: channel.min_forwards,
    min_age_hours: channel.min_age_hours,
  }
}

function ResourceCard({ resource }: { resource: TelegramResourceResult }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            #{resource.rank || '-'}
          </span>
          <span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(resource.status))}>
            {resource.status}
          </span>
          {resource.hashtags.map((tag) => (
            <span key={tag} className="rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-700">{tag}</span>
          ))}
        </div>
        <span className="text-xs font-semibold text-slate-700">转发率 {formatRate(resource.forwardRate)}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-800">
        {resource.caption || '无 Caption'}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>浏览 {resource.views ?? '-'}</span>
        <span>转发 {resource.forwards ?? '-'}</span>
        <span>视频 {resource.videoCount}</span>
        <span>长视频 {resource.longVideoCount}</span>
        <span>最长 {formatDuration(resource.maxVideoDurationSeconds)}</span>
        <span>来源消息 {resource.sourceMessageCount}</span>
      </div>
    </article>
  )
}

function RunDetails({ run }: { run: TelegramAutomationRun }) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-950">{modeCopy[run.execution_mode] ?? run.execution_mode}</h2>
              <span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(run.status))}>
                {runStatusCopy[run.status] ?? run.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {run.trigger_type === 'SCHEDULED' ? '定时触发' : '管理员触发'} · {formatDateTime(run.started_at)} · 阶段 {stageCopy[run.stage] ?? run.stage}
            </p>
          </div>
          {run.status === 'RUNNING' ? <Loader2 className="h-5 w-5 animate-spin text-sky-500" /> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ['入选资源', run.selected_resource_count],
            ['重复跳过', run.duplicate_resource_count],
            ['新增资源', run.forwarded_resource_count],
            ['发送消息', run.forwarded_message_count],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
        {run.error_message ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{run.error_message}</p> : null}
      </div>

      {run.channels.map((channel) => {
        const resources = channel.worker_response?.selectedResources ?? []
        return (
          <div key={channel.channel_id} className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-950">{channel.source_title || channel.source_id}</h3>
                  <span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(channel.status))}>{runStatusCopy[channel.status] ?? channel.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  阈值 {formatRate(channel.threshold)} · 尝试 {channel.attempt_count} 次 · 入选 {channel.selected_resource_count} · 新增 {channel.forwarded_resource_count}
                </p>
              </div>
            </div>
            {channel.error_message ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{channel.error_message}</p> : null}
            <div className="mt-4 space-y-3">
              {resources.length > 0 ? resources.map((resource) => <ResourceCard key={resource.resourceId} resource={resource} />) : (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">本频道没有入选资源。</p>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

export function TelegramAutomationPage() {
  const [overview, setOverview] = useState<TelegramAutomationOverview | null>(null)
  const [form, setForm] = useState<ConfigForm | null>(null)
  const [newSource, setNewSource] = useState('')
  const [selectedRun, setSelectedRun] = useState<TelegramAutomationRun | null>(null)
  const [history, setHistory] = useState<{ items: TelegramAutomationRun[]; total: number; page: number; page_size: number } | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backfillChannelId, setBackfillChannelId] = useState('')
  const [backfill, setBackfill] = useState<TelegramBackfillPayload>({
    top_resources: 10,
    lookback_days: 365,
    max_messages: 5000,
    start_mode: 'latest',
  })

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await getTelegramAutomationOverview(signal)
      setOverview(data)
      setForm((current) => current ?? {
        enabled: data.config.enabled,
        target: data.config.target,
        channels: data.config.channels.map(editableChannel),
      })
      setBackfillChannelId((current) => current || data.config.channels[0]?.id || '')
      setError(null)
    } catch (caught) {
      if (!isJavaRequestCanceledError(caught)) {
        setError(getJavaErrorMessage(caught) ?? (caught instanceof Error ? caught.message : 'Telegram 自动化加载失败'))
      }
    }
  }, [])

  const loadHistory = useCallback(async (page: number) => {
    try {
      setHistory(await listTelegramAutomationRuns(page, HISTORY_PAGE_SIZE))
    } catch (caught) {
      setError(getJavaErrorMessage(caught) ?? (caught instanceof Error ? caught.message : '运行历史加载失败'))
    }
  }, [])

  const refreshRun = useCallback(async (runId: string) => {
    try {
      setSelectedRun(await getTelegramAutomationRun(runId))
    } catch (caught) {
      setError(getJavaErrorMessage(caught) ?? (caught instanceof Error ? caught.message : '运行详情加载失败'))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadOverview(controller.signal)
    return () => controller.abort()
  }, [loadOverview])

  useEffect(() => {
    void loadHistory(historyPage)
  }, [historyPage, loadHistory])

  useEffect(() => {
    const timer = window.setInterval(() => void loadOverview(), 5000)
    return () => window.clearInterval(timer)
  }, [loadOverview])

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'RUNNING') return
    const timer = window.setInterval(() => void refreshRun(selectedRun.id), 5000)
    return () => window.clearInterval(timer)
  }, [refreshRun, selectedRun])

  useEffect(() => {
    if (overview?.current_run && overview.current_run.id !== selectedRun?.id) {
      void refreshRun(overview.current_run.id)
    }
  }, [overview?.current_run, refreshRun, selectedRun?.id])

  useEffect(() => {
    if (selectedRun && selectedRun.status !== 'RUNNING') {
      void loadHistory(1)
    }
  }, [loadHistory, selectedRun])

  const historyMaxPage = history ? Math.max(1, Math.ceil(history.total / history.page_size)) : 1
  const canRun = !working && !overview?.current_run
  const enabledChannels = useMemo(() => form?.channels.filter((channel) => channel.enabled).length ?? 0, [form?.channels])

  function patchChannel(index: number, patch: Partial<EditableChannel>) {
    setForm((current) => current ? {
      ...current,
      channels: current.channels.map((channel, channelIndex) => channelIndex === index ? { ...channel, ...patch } : channel),
    } : current)
  }

  async function addChannel() {
    if (!newSource.trim()) return
    setWorking(true)
    setError(null)
    try {
      const source = await resolveTelegramSource(newSource.trim())
      if (source.forwards_restricted) throw new Error('该频道禁止转发，不能加入自动化。')
      setForm((current) => current ? {
        ...current,
        channels: [...current.channels, {
          source_ref: String(source.source_id),
          source_title: source.title,
          source_username: source.username,
          enabled: true,
          percentile: 0.9,
          ...telegramResourceModeDefaults('group'),
          min_video_duration: 300,
          min_age_hours: 24,
        }],
      } : current)
      setNewSource('')
      setMessage(`已解析频道：${source.title || source.source_id}，保存配置后生效。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '频道解析失败')
    } finally {
      setWorking(false)
    }
  }

  async function saveConfig() {
    if (!form || form.channels.length === 0) {
      setError('至少需要配置一个频道。')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const payload: TelegramConfigUpdatePayload = {
        enabled: form.enabled,
        target: form.target,
        channels: form.channels.map((channel) => ({
          id: channel.id,
          source_ref: channel.source_ref,
          enabled: channel.enabled,
          percentile: channel.percentile,
          resource_mode: channel.resource_mode,
          min_video_duration: channel.min_video_duration,
          min_views: channel.min_views,
          min_forwards: channel.min_forwards,
          min_age_hours: channel.min_age_hours,
        })),
      }
      const config = await updateTelegramAutomationConfig(payload)
      setOverview((current) => current ? { ...current, config } : current)
      setForm({ enabled: config.enabled, target: config.target, channels: config.channels.map(editableChannel) })
      setBackfillChannelId((current) => current || config.channels[0]?.id || '')
      setMessage('Telegram 自动化配置已保存。')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '配置保存失败')
    } finally {
      setWorking(false)
    }
  }

  async function runFollowDryRun() {
    setWorking(true)
    setError(null)
    try {
      const run = await startTelegramFollowDryRun()
      setSelectedRun(run)
      setHistoryPage(1)
      setMessage('追更试运行已开始。')
      await Promise.all([loadOverview(), loadHistory(1), refreshRun(run.id)])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '追更启动失败')
    } finally {
      setWorking(false)
    }
  }

  async function runFollow() {
    if (!window.confirm(`将真实处理 ${enabledChannels} 个频道并转发到 ${form?.target}，确认继续吗？`)) return
    setWorking(true)
    setError(null)
    try {
      const run = await startTelegramFollow()
      setSelectedRun(run)
      setHistoryPage(1)
      setMessage('Telegram 追更已开始。')
      await Promise.all([loadOverview(), loadHistory(1), refreshRun(run.id)])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '追更启动失败')
    } finally {
      setWorking(false)
    }
  }

  async function runBackfillDryRun() {
    if (!backfillChannelId) {
      setError('请选择回溯频道。')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const run = await startTelegramBackfillDryRun(backfillChannelId, backfill)
      setSelectedRun(run)
      setHistoryPage(1)
      setMessage('历史回溯试运行已开始。')
      await Promise.all([loadOverview(), loadHistory(1), refreshRun(run.id)])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '历史回溯启动失败')
    } finally {
      setWorking(false)
    }
  }

  async function runBackfill() {
    if (!backfillChannelId) {
      setError('请选择回溯频道。')
      return
    }
    if (!window.confirm(`将真实转发该频道排名前 ${backfill.top_resources} 的历史资源，确认继续吗？`)) return
    setWorking(true)
    setError(null)
    try {
      const run = await startTelegramBackfill(backfillChannelId, backfill)
      setSelectedRun(run)
      setHistoryPage(1)
      setMessage('历史回溯已开始。')
      await Promise.all([loadOverview(), loadHistory(1), refreshRun(run.id)])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '历史回溯启动失败')
    } finally {
      setWorking(false)
    }
  }

  return (
    <PageContainer title="Telegram 自动化" description="按频道配置 Forward Rate 分位数，每天零点追更，并保留每次资源筛选、去重和转发结果。">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Button asChild type="button" size="sm" variant="outline"><Link to="/automation">JAVDB 自动化</Link></Button>
          <Button type="button" size="sm">Telegram 自动化</Button>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn('rounded-2xl p-3', overview?.worker_available && overview.worker_authorized ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                {overview?.worker_available && overview.worker_authorized ? <CheckCircle2 className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="font-semibold text-slate-950">Python Worker</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {overview?.worker_available ? overview.worker_authorized ? '已连接并登录 Telegram' : '已连接，但 Session 未登录' : '当前无法连接'}
                  {overview?.worker_version ? ` · v${overview.worker_version}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-400">每日 {overview?.config.schedule_time ?? '00:00'}（{overview?.config.timezone ?? 'Asia/Shanghai'}）运行</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadOverview()}><RefreshCw className="h-4 w-4" />刷新</Button>
          </div>
        </section>

        {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
        {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" aria-live="polite">{message}</p> : null}

        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">频道配置</p><p className="mt-1 text-sm text-slate-500">新增时可输入公开链接、@username 或频道 ID。</p></div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={form?.enabled ?? false}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked
                  setForm((current) => current ? { ...current, enabled } : current)
                }}
              />
              启用每日追更
            </label>
          </div>
          <div className="mt-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>来源频道</span>
              <input value={newSource} onChange={(event) => setNewSource(event.currentTarget.value)} placeholder="https://t.me/example 或 -100..." className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200" />
            </label>
            <Button type="button" variant="outline" onClick={() => void addChannel()} disabled={working || !newSource.trim()}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}解析并添加</Button>
          </div>
          <label className="mt-4 block space-y-2 text-sm font-medium text-slate-700">
            <span>保存目标 Bot</span>
            <input
              value={form?.target ?? ''}
              onChange={(event) => {
                const target = event.currentTarget.value
                setForm((current) => current ? { ...current, target } : current)
              }}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <div className="mt-5 space-y-4">
            {form?.channels.map((channel, index) => (
              <article key={channel.id ?? `${channel.source_ref}-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-900">{channel.source_title || channel.source_ref}</p><p className="mt-1 text-xs text-slate-400">{channel.source_username ? `@${channel.source_username}` : channel.source_ref}</p></div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={channel.enabled} onChange={(event) => patchChannel(index, { enabled: event.currentTarget.checked })} />启用</label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => current ? { ...current, channels: current.channels.filter((_, itemIndex) => itemIndex !== index) } : current)}><Trash2 className="h-4 w-4" />移除</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <label className="space-y-1 text-xs text-slate-500"><span>分位数</span><select value={channel.percentile} onChange={(event) => patchChannel(index, { percentile: Number(event.currentTarget.value) })} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value={0.8}>P80</option><option value={0.85}>P85</option><option value={0.9}>P90</option></select></label>
                  <label className="space-y-1 text-xs text-slate-500"><span>资源结构</span><select value={channel.resource_mode} onChange={(event) => patchChannel(index, telegramResourceModeDefaults(event.currentTarget.value as EditableChannel['resource_mode']))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="group">普通 Group</option><option value="hashtag_resource">Hashtag 分段</option></select></label>
                  {([
                    ['min_video_duration', '视频时长（秒）'],
                    ['min_views', '最低浏览'],
                    ['min_forwards', '最低转发'],
                    ['min_age_hours', '观察时间（小时）'],
                  ] as const).map(([key, label]) => <label key={key} className="space-y-1 text-xs text-slate-500"><span>{label}</span><input type="number" min={0} value={channel[key]} onChange={(event) => patchChannel(index, { [key]: Number(event.currentTarget.value) })} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700" /></label>)}
                </div>
              </article>
            ))}
            {!form?.channels.length ? <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">尚未配置频道。</p> : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveConfig()} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存配置</Button>
            <Button type="button" variant="outline" onClick={() => void runFollowDryRun()} disabled={!canRun || enabledChannels === 0}><Play className="h-4 w-4" />追更试运行</Button>
            <Button type="button" onClick={() => void runFollow()} disabled={!canRun || enabledChannels === 0}><Play className="h-4 w-4" />立即追更</Button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">新频道历史回溯</p><p className="mt-1 text-sm text-slate-500">按 Forward Rate 全局排名取 Top N；Worker 账本会跳过追更或此前回溯已经发送的 Group。</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs text-slate-500"><span>频道</span><select value={backfillChannelId} onChange={(event) => setBackfillChannelId(event.currentTarget.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">请选择</option>{overview?.config.channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.source_title || channel.source_id}</option>)}</select></label>
            <label className="space-y-1 text-xs text-slate-500"><span>Top N</span><input type="number" min={1} max={100} value={backfill.top_resources} onChange={(event) => {
              const topResources = Number(event.currentTarget.value)
              setBackfill((current) => ({ ...current, top_resources: topResources }))
            }} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
            <label className="space-y-1 text-xs text-slate-500"><span>回溯天数</span><input type="number" min={1} max={3650} value={backfill.lookback_days} onChange={(event) => {
              const lookbackDays = Number(event.currentTarget.value)
              setBackfill((current) => ({ ...current, lookback_days: lookbackDays }))
            }} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
            <label className="space-y-1 text-xs text-slate-500"><span>最多扫描消息</span><input type="number" min={200} max={10000} value={backfill.max_messages} onChange={(event) => {
              const maxMessages = Number(event.currentTarget.value)
              setBackfill((current) => ({ ...current, max_messages: maxMessages }))
            }} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
          </div>
          <label className="mt-3 block max-w-xs space-y-1 text-xs text-slate-500"><span>回溯起点</span><select value={backfill.start_mode} onChange={(event) => {
            const startMode = event.currentTarget.value as TelegramBackfillPayload['start_mode']
            setBackfill((current) => ({ ...current, start_mode: startMode }))
          }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="latest">从最新重新排名</option><option value="continue">从上次位置继续向前</option></select></label>
          <div className="mt-4 flex gap-2"><Button type="button" variant="outline" onClick={() => void runBackfillDryRun()} disabled={!canRun || !backfillChannelId}>回溯试运行</Button><Button type="button" onClick={() => void runBackfill()} disabled={!canRun || !backfillChannelId}>正式回溯</Button></div>
        </section>

        {selectedRun ? <RunDetails run={selectedRun} /> : null}

        <section className="rounded-2xl bg-white p-5 shadow-shell ring-1 ring-slate-200">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">运行历史</p><p className="mt-1 text-sm text-slate-500">保存频道级数量、Caption、Hashtag、Forward Rate、阈值和 Worker 原始结果。</p></div><span className="flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-4 w-4" />{history?.total ?? 0} 次</span></div>
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {history?.items.length ? history.items.map((run) => <button key={run.id} type="button" onClick={() => void refreshRun(run.id)} className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><span className={cn('rounded-md px-2 py-1 text-xs font-semibold ring-1', statusTone(run.status))}>{runStatusCopy[run.status] ?? run.status}</span><span className="text-sm font-medium text-slate-800">{modeCopy[run.execution_mode] ?? run.execution_mode}</span><span className="text-xs text-slate-400">{run.trigger_type === 'SCHEDULED' ? '定时' : '手动'}</span></span><span className="text-xs text-slate-500">{formatDateTime(run.started_at)} · 新增 {run.forwarded_resource_count}</span></button>) : <p className="px-4 py-8 text-center text-sm text-slate-500">暂无运行记录。</p>}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>第 {history?.page ?? historyPage} / {historyMaxPage} 页</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}><ChevronLeft className="h-4 w-4" />上一页</Button><Button type="button" size="sm" variant="outline" disabled={historyPage >= historyMaxPage} onClick={() => setHistoryPage((page) => Math.min(historyMaxPage, page + 1))}>下一页<ChevronRight className="h-4 w-4" /></Button></div></div>
        </section>
      </div>
    </PageContainer>
  )
}
