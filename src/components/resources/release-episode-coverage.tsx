import { useEffect, useRef, useState } from 'react'

import { getReleaseEpisodeCoverage } from '@/lib/api/resources'
import type { ProwlarrRelease, ReleaseEpisodeCoverageData, ReleaseEpisodeCoveragePayload } from '@/types/resources'

const unverified: ReleaseEpisodeCoverageData = { status: 'UNVERIFIED', matched: null, expected: null }
const cache = new Map<string, { coverage: ReleaseEpisodeCoverageData; expires: number }>()
type CoverageJob = {
  key: string
  payload: ReleaseEpisodeCoveragePayload
  controller: AbortController
  listeners: Set<(coverage: ReleaseEpisodeCoverageData) => void>
}
const jobs = new Map<string, CoverageJob>()
const queue: CoverageJob[] = []
let activeRequests = 0

// Magnet trackers/display names do not identify a torrent; hex and base32 BTIH do.
function magnetBtih(downloadRef: string) {
  try {
    const url = new URL(downloadRef)
    if (url.protocol !== 'magnet:') return null
    for (const xt of url.searchParams.getAll('xt')) {
      const hash = /^urn:btih:([a-f\d]{40}|[a-z2-7]{32})$/i.exec(xt)?.[1]
      if (!hash) continue
      if (hash.length === 40) return hash.toLowerCase()
      const bits = [...hash.toUpperCase()].map((letter) =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(letter).toString(2).padStart(5, '0'),
      ).join('')
      return bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2).toString(16).padStart(2, '0')).join('')
    }
  } catch { /* Non-magnet download references cannot be inspected here. */ }
  return null
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
    const timer = setTimeout(finish, 2000)
    signal.addEventListener('abort', finish, { once: true })
    if (signal.aborted) finish()
  })
}

async function inspect(job: CoverageJob) {
  const { signal } = job.controller
  const deadline = setTimeout(() => job.controller.abort(), 15_000)
  let coverage = unverified
  try {
    for (let attempt = 0; attempt < 5 && !signal.aborted; attempt++) {
      const response = await getReleaseEpisodeCoverage(job.payload, signal)
      if (signal.aborted) break
      if (response.status !== 'CHECKING') { coverage = response; break }
      if (attempt < 4) await pause(signal)
    }
  } catch { /* Coverage is advisory; errors never affect selection or submission. */ }
  finally {
    clearTimeout(deadline)
    if (jobs.get(job.key) === job) {
      jobs.delete(job.key)
      if (job.listeners.size) {
        cache.delete(job.key)
        cache.set(job.key, { coverage, expires: Date.now() + (coverage.status === 'VERIFIED' ? 300_000 : 30_000) })
        if (cache.size > 200) cache.delete(cache.keys().next().value!)
        job.listeners.forEach((listener) => listener(coverage))
      }
    }
    activeRequests--
    drainQueue()
  }
}

function drainQueue() {
  while (activeRequests < 2 && queue.length) {
    const job = queue.shift()!
    if (job.controller.signal.aborted) continue
    activeRequests++
    void inspect(job)
  }
}

function subscribe(key: string, payload: ReleaseEpisodeCoveragePayload, listener: (coverage: ReleaseEpisodeCoverageData) => void) {
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    listener(cached.coverage)
    return () => {}
  }
  cache.delete(key)
  let job = jobs.get(key)
  if (!job) {
    job = { key, payload, controller: new AbortController(), listeners: new Set() }
    jobs.set(key, job)
    queue.push(job)
  }
  job.listeners.add(listener)
  drainQueue()
  const subscribedJob = job
  return () => {
    subscribedJob.listeners.delete(listener)
    if (!subscribedJob.listeners.size) {
      subscribedJob.controller.abort()
      if (jobs.get(key) === subscribedJob) jobs.delete(key)
      const queuedIndex = queue.indexOf(subscribedJob)
      if (queuedIndex >= 0) queue.splice(queuedIndex, 1)
    }
  }
}

type ReleaseEpisodeCoverageProps = {
  release: ProwlarrRelease
  tmdbId?: number | null
  seasonNumber?: number | null
}

export function ReleaseEpisodeCoverage({ release, tmdbId, seasonNumber }: ReleaseEpisodeCoverageProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [result, setResult] = useState<{ key: string; coverage: ReleaseEpisodeCoverageData } | null>(null)
  const btih = magnetBtih(release.download_ref)
  const eligible = !!btih && /pansou/i.test(release.match_source ?? '') &&
    Number.isInteger(tmdbId) && tmdbId! > 0 && Number.isInteger(seasonNumber) && seasonNumber! >= 0
  const key = eligible ? `${btih}:${tmdbId}:${seasonNumber}` : null
  const downloadRef = release.download_ref

  useEffect(() => {
    if (!key || !ref.current) return
    let disposed = false
    let unsubscribe: (() => void) | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !unsubscribe) {
        unsubscribe = subscribe(key, { download_ref: downloadRef, tmdb_id: tmdbId!, season_number: seasonNumber! },
          (coverage) => { if (!disposed) setResult({ key, coverage }) })
      } else if (!entry.isIntersecting) {
        unsubscribe?.()
        unsubscribe = undefined
      }
    })
    observer.observe(ref.current)
    return () => { disposed = true; observer.disconnect(); unsubscribe?.() }
  }, [key, downloadRef, tmdbId, seasonNumber])

  if (!key) return null
  const coverage = result?.key === key ? result.coverage : unverified
  return <span ref={ref} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
    title="仅核验文件元数据中的集数覆盖，不代表可下载或可播放。">
    {coverage.status === 'VERIFIED' ? `${coverage.matched}/${coverage.expected} 集` : '未核验'}
  </span>
}
