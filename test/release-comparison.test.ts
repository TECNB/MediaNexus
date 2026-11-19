import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Use the existing Vite alias/env transform and node:test, not a new test framework.
test('comparison API preserves nullable recommendations, exact routes, signals and explicit risk', async (t) => {
  const server = await createServer({ cacheDir: `${process.env.PI_SCRATCH_DIR}/guangya-vite-test`, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const api = await server.ssrLoadModule('/src/lib/api/resources.ts')
    const { javaApiClient } = await server.ssrLoadModule('/src/lib/java-api.ts')
    const controller = new AbortController()
    const snapshot = { query: '作品', items: [], item: null, selected_quality: null, comparison: { id: 'a/b', status: 'PAUSED', checked: 2, pending: 3, snapshot_at: '2026-11-18T00:00:00Z', recommended_ref: null } }
    const calls: { method: string; url: string; body: unknown }[] = []
    javaApiClient.defaults.adapter = async (config: { method: string; url: string; data?: string; signal: AbortSignal }) => {
      assert.equal(config.signal, controller.signal)
      calls.push({ method: config.method, url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
      return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, data: snapshot } }
    }
    assert.deepEqual(await api.getReleaseComparison('a/b', controller.signal), snapshot)
    assert.deepEqual(await api.continueReleaseComparison('a/b', controller.signal), snapshot)
    for (const fn of [api.recommendMovieRelease, api.refreshMovieReleaseRecommendation, api.recommendSeriesRelease, api.refreshSeriesReleaseRecommendation]) {
      const data = await fn({ title: '作品', quality: '1080p' }, controller.signal)
      assert.equal(data.item, null)
      assert.equal(data.selected_quality, null)
      assert.equal(data.comparison.status, 'PAUSED')
    }
    assert.deepEqual(calls.slice(0, 2), [
      { method: 'get', url: '/api/v1/resources/releases/comparisons/a%2Fb', body: undefined },
      { method: 'post', url: '/api/v1/resources/releases/comparisons/a%2Fb/continue', body: undefined },
    ])
    javaApiClient.defaults.adapter = async (config: { data: string }) => {
      assert.equal(JSON.parse(config.data).accept_unverified_risk, true)
      return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, data: { id: 'task' } } }
    }
    await api.createMovieReleaseOpenListIngest({ accept_unverified_risk: true })
    await api.createSeriesReleaseOpenListIngest({ accept_unverified_risk: true })
    const retry = await server.ssrLoadModule('/src/lib/api/task-center.ts')
    const bgm = await server.ssrLoadModule('/src/lib/api/bgm-wishlist.ts')
    javaApiClient.defaults.adapter = async (config: { data: string }) => {
      assert.equal(JSON.parse(config.data).accept_unverified_risk, true)
      return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, data: { detail_path: '/tasks/movie/task' } } }
    }
    await retry.retryOpenListWithSelectedRelease('MOVIE', 'task', {}, true)
    await bgm.supplyBgmOperation('operation', 1, {}, {}, true)
    await bgm.confirmBgmCandidate('operation', 1, 'candidate', true)
    await bgm.supplyWeComOperation('operation', 1, {}, {}, true)
    await bgm.confirmWeComCandidate('operation', 1, 'candidate', true)

    const release = { title: 'title', download_ref: 'magnet:ref', resolution_tags: [], season_tags: [], dynamic_range_tags: [], size: null, seeders: null }
    javaApiClient.defaults.adapter = async (config: object) => ({ config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, data: { ...snapshot, items: [release] } } })
    assert.equal((await api.recommendMovieRelease({})).item, null, 'never replace an explicitly empty comparison recommendation with the first candidate')
    javaApiClient.defaults.adapter = async (config: object) => ({ config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, data: { query: 'legacy', items: [release] } } })
    assert.deepEqual((await api.recommendMovieRelease({})).item, release, 'legacy Prowlarr fallback retained')
    const canceled = new AbortController()
    canceled.abort()
    await assert.rejects(api.getReleaseComparison('id', canceled.signal), error => api.isRequestCanceledError(error))
    await assert.rejects(api.recommendMovieRelease({}, canceled.signal), error => api.isRequestCanceledError(error))

    const selection = await server.ssrLoadModule('/src/lib/release-selection.ts')
    assert.equal(selection.isReleaseSelectionDisabled(null), true)
    assert.equal(selection.requiresUnverifiedRisk(release), false, 'legacy Prowlarr needs no new risk override')
    assert.equal(selection.requiresUnverifiedRisk(release, snapshot.comparison), true)
    for (const status of ['NEEDS_PROCESSING', 'UNSUITABLE']) assert.equal(selection.isReleaseSelectionDisabled({ ...release, evidence: { status } }), true)
    assert.equal(selection.requiresUnverifiedRisk({ ...release, evidence: { status: 'UNVERIFIED' } }), true)
    assert.equal(selection.isReleaseSelectionDisabled({ ...release, evidence: { status: 'RECOMMENDABLE' } }), false)
    const review = await server.ssrLoadModule('/src/components/resources/release-review.tsx')
    for (const [status, label] of Object.entries({ RECOMMENDABLE: '可推荐', NEEDS_PROCESSING: '包含目标待处理', UNSUITABLE: '不适合本次目标', UNVERIFIED: '未核验' })) {
      const item = { ...release, evidence: { status, reason: '测试原因', total_bytes: 1024, target_bytes: null, target_files: null } }
      assert.match(renderToStaticMarkup(React.createElement(review.ReleaseReviewBadges, { release: item })), new RegExp(label))
      const details = renderToStaticMarkup(React.createElement(review.ReleaseReviewDetails, { release: item }))
      assert.match(details, /测试原因/)
      assert.match(details, /总包容量：1 KiB/)
      assert.match(details, /目标容量：未知大小/)
      assert.match(details, /目标文件：未知/)
      assert.match(details, /仅为声明/)
    }
    const progress = await server.ssrLoadModule('/src/components/resources/release-comparison-progress.tsx')
    const markup = renderToStaticMarkup(React.createElement(progress.ReleaseComparisonProgress, { comparison: snapshot.comparison, items: [], onUpdate: () => {} }))
    assert.match(markup, /比较已暂停/)
    assert.match(markup, /已查 2 · 待查 3/)
    assert.match(markup, /继续比较/)
    assert.match(markup, /搜索快照/)

    t.mock.timers.enable({ apis: ['setTimeout'] })
    let reads = 0
    let updates = 0
    let errors = 0
    javaApiClient.defaults.adapter = async (config: object) => {
      reads++
      return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, data: { ...snapshot, comparison: { ...snapshot.comparison, status: reads === 1 ? 'RUNNING' : 'PAUSED' } } } }
    }
    const watching = new AbortController()
    const flush = () => new Promise(resolve => setImmediate(resolve))
    api.observeReleaseComparison({ ...snapshot.comparison, status: 'RUNNING' }, { signal: watching.signal, onSnapshot: () => updates++, onError: () => errors++ })
    assert.equal(reads, 0)
    t.mock.timers.tick(1000); await flush()
    assert.equal(reads, 1)
    t.mock.timers.tick(1000); await flush()
    assert.equal(reads, 2)
    t.mock.timers.tick(10_000); await flush()
    assert.equal(reads, 2, 'PAUSED must stop polling and never auto continue')
    assert.equal(updates, 2)
    api.observeReleaseComparison(snapshot.comparison, { signal: watching.signal, onSnapshot: () => updates++, onError: () => errors++ })
    t.mock.timers.tick(1000); await flush()
    assert.equal(reads, 2, 'non-RUNNING snapshots must never poll')
    watching.abort()

    javaApiClient.defaults.adapter = async () => { throw new Error('network unavailable') }
    const failed = new AbortController()
    api.observeReleaseComparison({ ...snapshot.comparison, status: 'RUNNING' }, { signal: failed.signal, onSnapshot: () => updates++, onError: () => errors++ })
    t.mock.timers.tick(1000); await flush()
    assert.equal(errors, 1)
    assert.equal(updates, 2, 'poll failures must not replace existing results')
    t.mock.timers.tick(10_000); await flush()
    assert.equal(errors, 1, 'poll failure waits for explicit retry')
    failed.abort()

    let finish: ((response: object) => void) | undefined
    javaApiClient.defaults.adapter = (config: object) => new Promise(resolve => { finish = response => resolve({ config, headers: {}, status: 200, statusText: 'OK', data: response }) })
    const stale = new AbortController()
    api.observeReleaseComparison({ ...snapshot.comparison, status: 'RUNNING' }, { signal: stale.signal, onSnapshot: () => updates++, onError: () => errors++ })
    t.mock.timers.tick(1000); await flush()
    stale.abort()
    finish!({ code: 200, data: snapshot }); await flush()
    assert.equal(updates, 2, 'aborted season/unmount callbacks cannot overwrite current results')
    assert.equal(errors, 1)
    t.mock.timers.reset()
  } finally { await server.close() }
})
