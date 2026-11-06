import assert from 'node:assert/strict'
import test from 'node:test'

import { getSettingsGroup } from '@/lib/api/settings'
import { javaApiClient } from '@/lib/java-api'

test('settings public API reads a group using the existing Java client and AbortSignal', async () => {
  const adapter = javaApiClient.defaults.adapter
  const controller = new AbortController()
  javaApiClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/admin/settings/groups/tmdb')
    assert.equal(config.signal, controller.signal)
    return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, message: 'OK', data: { id: 'tmdb', version: 7 } } }
  }
  try { assert.equal((await getSettingsGroup('tmdb', controller.signal)).version, 7) }
  finally { javaApiClient.defaults.adapter = adapter }
})

import { checkSettingsGroup, getSettingsResources, restoreSettingsGroup, SettingsApiError, updateSettingsGroup } from '@/lib/api/settings'

test('candidate preflight, save, and restore preserve version and explicit secret actions', async () => {
  const adapter = javaApiClient.defaults.adapter
  const sent: { method?: string; url?: string; body: unknown }[] = []
  javaApiClient.defaults.adapter = async config => {
    sent.push({ method: config.method, url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
    return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, message: 'OK', data: { id: 'tmdb', version: 8 } } }
  }
  const patch = { version: 7, values: { defaultLanguage: 'en-US' }, secrets: { apiToken: { action: 'KEEP' as const } } }
  try {
    await checkSettingsGroup('tmdb', patch)
    await updateSettingsGroup('tmdb', patch)
    await restoreSettingsGroup('tmdb', 8)
    await getSettingsResources('tmdb')
    assert.deepEqual(sent, [
      { method: 'post', url: '/api/v1/admin/settings/groups/tmdb/check', body: patch },
      { method: 'put', url: '/api/v1/admin/settings/groups/tmdb', body: patch },
      { method: 'post', url: '/api/v1/admin/settings/groups/tmdb/restore', body: { version: 8 } },
      { method: 'get', url: '/api/v1/admin/settings/groups/tmdb/resources', body: undefined },
    ])
  } finally { javaApiClient.defaults.adapter = adapter }
})

test('stale versions remain typed conflicts and never retry the administrator write', async () => {
  const adapter = javaApiClient.defaults.adapter
  let writes = 0
  javaApiClient.defaults.adapter = async config => {
    writes++
    return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 409, message: '配置版本已变化', data: null } }
  }
  try {
    await assert.rejects(updateSettingsGroup('tmdb', { version: 7, values: { defaultLanguage: 'en-US' }, secrets: {} }), error => error instanceof SettingsApiError && error.status === 409)
    assert.equal(writes, 1)
  } finally { javaApiClient.defaults.adapter = adapter }
})

import { getDownloadAccounts } from '@/lib/api/settings'

test('download accounts read real managed state and category defaults', async () => {
  const adapter = javaApiClient.defaults.adapter
  javaApiClient.defaults.adapter = async config => {
    assert.equal(config.url, '/api/v1/admin/download-accounts')
    return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, message: 'OK', data: { registryVersion: 0, managed: false, accounts: [], categoryDefaults: [{ category: 'MOVIE', targetId: null }] } } }
  }
  try { assert.equal((await getDownloadAccounts()).managed, false) }
  finally { javaApiClient.defaults.adapter = adapter }
})

import { continueOnboardingExecution, executeOnboardingPlan, previewAccountAdoption, updateAccountDefaults } from '@/lib/api/settings'
import type { OnboardingExecution, OnboardingPlan } from '@/types/settings'

test('account mutations use independent registry, plan and execution versions without replay', async () => {
  const adapter = javaApiClient.defaults.adapter
  const sent: { url?: string; body: unknown }[] = []
  javaApiClient.defaults.adapter = async config => {
    sent.push({ url: config.url, body: JSON.parse(config.data) })
    return { config, headers: {}, status: 200, statusText: 'OK', data: { code: 200, message: 'OK', data: {} } }
  }
  const plan = { id: 'plan/a', planVersion: 2, registryVersion: 9 } as OnboardingPlan
  const execution = { id: 'execution/a', executionVersion: 4 } as OnboardingExecution
  try {
    await previewAccountAdoption(9, '原主号')
    await updateAccountDefaults(9, [{ category: 'MOVIE', targetId: 'target-2' }])
    await executeOnboardingPlan(plan)
    await continueOnboardingExecution(execution)
    assert.deepEqual(sent, [
      { url: '/api/v1/admin/download-accounts/adoption-plans', body: { expectedRegistryVersion: 9, displayName: '原主号' } },
      { url: '/api/v1/admin/download-accounts/category-defaults', body: { expectedRegistryVersion: 9, defaults: [{ category: 'MOVIE', targetId: 'target-2' }] } },
      { url: '/api/v1/admin/download-accounts/onboarding-plans/plan%2Fa/execute', body: { expectedPlanVersion: 2, expectedRegistryVersion: 9 } },
      { url: '/api/v1/admin/download-accounts/onboarding-executions/execution%2Fa/continue', body: { expectedExecutionVersion: 4 } },
    ])
  } finally { javaApiClient.defaults.adapter = adapter }
})
