import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { DoubanChartCandidate, DoubanChartProgressEvidence } from '../src/types/douban-charts.ts'

const source = readFileSync(new URL('../src/pages/automation/douban-chart-progress.tsx', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText
const exported: Record<string, unknown> = {}
runInNewContext(output, { exports: exported, require: createRequire(import.meta.url), Intl, Date })
const Progress = exported.DoubanChartProgress as (props: { candidate: DoubanChartCandidate }) => ReturnType<typeof createElement>
const observed = '2026-11-22T01:00:00Z'
const candidate: DoubanChartCandidate = {
  subject: { id: 1, title: '测试剧', originalTitle: null, coverUrl: null, year: 2026, mediaType: 'SERIES', score: null, votes: null, rank: 1, progress: null, observedAt: observed },
  current: true, firstSeenAt: observed, lastSeenAt: observed, lastRank: 1, excluded: false, observations: [], identity: null, reason: null,
}
const evidence: DoubanChartProgressEvidence = {
  sourceObservedAt: observed, checkedAt: observed, doubanStatus: 'NOT_PROVIDED', doubanProgress: null, doubanCheckedAt: observed, doubanMessage: null,
  catalog: { status: 'SUCCEEDED', checkedAt: observed, identity: { mediaType: 'SERIES', tmdbId: 42, seasonNumber: 1, title: '测试剧', originalTitle: 'Show', year: 2026 }, seriesStatus: 'Returning Series', totalEpisodes: 12, pastEpisodes: 10, todayEpisodes: 0, undatedEpisodes: 0, nextEpisodeNumber: 11, nextAirDate: '2026-11-23', seasonStatus: 'AIRING', message: '目标季有后续播出安排' },
}
const render = (c: DoubanChartCandidate) => renderToStaticMarkup(createElement(Progress, { candidate: c }))

test('separates absent Douban progress from verified target-season airing evidence', () => {
  const html = render({ ...candidate, progressEvidence: evidence })
  assert.match(html, /豆瓣未提供更新进度/)
  assert.match(html, /当前季：更新中/)
  assert.match(html, /TMDB/)
  assert.match(html, /2026-11-23/)
  assert.match(html, /E11/)
  assert.doesNotMatch(html, /更新至10集|12集全/)
})

test('distinguishes queued checks, missing fields, failures and identity decisions', () => {
  assert.match(render(candidate), /排队补查中/)
  const failed = render({ ...candidate, progressEvidence: { ...evidence, doubanStatus: 'FAILED', catalog: { ...evidence.catalog!, status: 'FAILED' } } })
  assert.match(failed, /豆瓣详情：本次补查失败/)
  assert.match(failed, /目录补查失败/)
  assert.doesNotMatch(failed, /当前季：更新中/)
  assert.match(render({ ...candidate, progressEvidence: { ...evidence, catalog: { ...evidence.catalog!, status: 'IDENTITY_REQUIRED' } } }), /目标季待确认/)
})

test('keeps conflicting Douban and catalogue evidence visible without granting ingestion', () => {
  const html = render({ ...candidate, subject: { ...candidate.subject, progress: '更新至10集' }, progressEvidence: { ...evidence, doubanStatus: 'NOT_NEEDED', catalog: { ...evidence.catalog!, seasonStatus: 'CONFLICT' } } })
  assert.match(html, /豆瓣榜单进度：更新至10集/)
  assert.match(html, /来源冲突/)
  assert.match(html, /不表示已找到片源或已入库/)
})

test('uses detail progress only as detail evidence and never labels films as unknown TV', () => {
  assert.match(render({ ...candidate, progressEvidence: { ...evidence, doubanStatus: 'SUPPLIED', doubanProgress: '更新至10集' } }), /豆瓣详情进度：更新至10集/)
  assert.equal(render({ ...candidate, subject: { ...candidate.subject, mediaType: 'MOVIE' } }), '')
})

test('does not show old progress evidence under a newer source snapshot', () => {
  const html = render({ ...candidate, subject: { ...candidate.subject, observedAt: '2026-11-23T01:00:00Z' }, progressEvidence: evidence })
  assert.match(html, /排队补查中/)
  assert.doesNotMatch(html, /当前季：更新中|2026-11-23（非片源/)
})

test('does not reuse a catalogue verdict after the administrator changes the target season', () => {
  const html = render({ ...candidate, identity: { ...evidence.catalog!.identity!, seasonNumber: 2 }, progressEvidence: evidence })
  assert.match(html, /目录证据待补查/)
  assert.doesNotMatch(html, /当前季：更新中/)
})

test('does not claim a historical candidate is queued for current-board checks', () => {
  const html = render({ ...candidate, current: false, progressEvidence: { ...evidence, doubanStatus: 'PENDING', doubanProgress: null, doubanMessage: '等待后台补查豆瓣详情', catalog: null } })
  assert.match(html, /历史候选/)
  assert.doesNotMatch(html, /排队补查中/)
  assert.doesNotMatch(html, /等待后台补查豆瓣详情/)
})
