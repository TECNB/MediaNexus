import { useEffect, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export function SettingsDialog({ title, children, confirmLabel, busy = false, confirmDisabled = false, onConfirm, onCancel }: {
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} aria-labelledby="settings-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/40">
    <h2 id="settings-dialog-title" className="text-lg font-semibold">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onCancel}>取消</Button><Button type="button" className="min-h-11" disabled={busy || confirmDisabled} onClick={onConfirm}>{busy ? '处理中…' : confirmLabel}</Button></div>
  </dialog>
}
