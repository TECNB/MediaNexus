import type {
  RecentIngestTask,
  RecentIngestTaskStatus,
} from '@/data/mock-magnet-ingest'
import { cn } from '@/lib/utils'

type RecentTasksTableProps = {
  tasks: RecentIngestTask[]
  onViewAll: () => void
}

const statusMeta: Record<
  RecentIngestTaskStatus,
  { label: string; dotClassName: string }
> = {
  parsing: {
    label: '解析中',
    dotClassName: 'bg-sky-500',
  },
  downloading: {
    label: '离线下载中',
    dotClassName: 'bg-amber-500',
  },
  submitted: {
    label: '已提交',
    dotClassName: 'bg-slate-500',
  },
  completed: {
    label: '已完成',
    dotClassName: 'bg-emerald-500',
  },
  failed: {
    label: '失败',
    dotClassName: 'bg-rose-500',
  },
}

export function RecentTasksTable({
  tasks,
  onViewAll,
}: RecentTasksTableProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/95 shadow-shell">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Recent Tasks
          </p>
          <p className="mt-2 text-sm text-slate-500">
            纯前端 mock 任务流，仅用于展示提交后的任务状态骨架。
          </p>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="text-sm font-semibold text-slate-900 transition-colors hover:text-slate-600"
        >
          VIEW ALL
        </button>
      </div>

      <div className="overflow-hidden border-t border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/90">
              <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <th className="px-5 py-3 font-medium">任务名称</th>
                <th className="px-5 py-3 font-medium">关联项目</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 text-right font-medium">时间</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {tasks.map((task) => {
                const meta = statusMeta[task.status]

                return (
                  <tr
                    key={task.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="max-w-[320px] px-5 py-4 text-sm font-medium text-slate-900">
                      <span className="block truncate">{task.name}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {task.libraryTitle}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn('h-2 w-2 rounded-full', meta.dotClassName)}
                        />
                        <span>{meta.label}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-slate-400">
                      {task.time}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
