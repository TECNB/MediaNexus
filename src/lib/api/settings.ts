import type { AxiosRequestConfig } from 'axios'

import { getJavaErrorMessage, isJavaRequestCanceledError, javaApiClient } from '@/lib/java-api'
import type { SettingsDirectory, SettingsGroup, SettingsProbe, SettingsUpdate, WeComAccounts, WeComDirectory, WeComScope } from '@/types/settings'

const base = '/api/v1/admin/settings'
const groupPath = (id: string) => `${base}/groups/${encodeURIComponent(id)}`

export class SettingsApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'SettingsApiError'
  }
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await javaApiClient.request<{ code: number; message: string; data: T | null }>(config)
    if (response.data.code !== 200 || response.data.data == null) {
      throw new SettingsApiError(response.data.message || '设置请求失败，请重试。', response.data.code)
    }
    return response.data.data
  } catch (error) {
    if (isJavaRequestCanceledError(error) || error instanceof SettingsApiError) throw error
    const status = (error as { response?: { status?: number } })?.response?.status ?? 0
    throw new SettingsApiError(getJavaErrorMessage(error) ?? '设置请求失败，请检查连接后重试。', status)
  }
}

export function getSettingsDirectory(signal?: AbortSignal) {
  return request<SettingsDirectory>({ url: base, method: 'GET', signal })
}
export function getSettingsGroup(id: string, signal?: AbortSignal) {
  return request<SettingsGroup>({ url: groupPath(id), method: 'GET', signal })
}
export function updateSettingsGroup(id: string, update: SettingsUpdate, signal?: AbortSignal) {
  return request<SettingsGroup>({ url: groupPath(id), method: 'PUT', data: update, signal })
}
export function restoreSettingsGroup(id: string, version: number, signal?: AbortSignal) {
  return request<SettingsGroup>({ url: `${groupPath(id)}/restore`, method: 'POST', data: { version }, signal })
}
export function checkSettingsGroup(id: string, update?: SettingsUpdate, signal?: AbortSignal) {
  return request<SettingsProbe>({ url: `${groupPath(id)}/check`, method: 'POST', data: update, signal })
}
export function getSettingsResources(id: string, signal?: AbortSignal) {
  return request<SettingsProbe>({ url: `${groupPath(id)}/resources`, method: 'GET', signal })
}

import type { AdoptionPlan, DownloadAccountDetail, DownloadAccountList, DownloadCategory, OnboardingExecution, OnboardingExecutionList, OnboardingPlan, OnboardingPlanRequest } from '@/types/settings'

const accountsBase = '/api/v1/admin/download-accounts'
const accountPath = (id: string) => `${accountsBase}/${encodeURIComponent(id)}`
export function getDownloadAccounts(signal?: AbortSignal) {
  return request<DownloadAccountList>({ url: accountsBase, method: 'GET', signal })
}
export function getDownloadAccount(id: string, signal?: AbortSignal) {
  return request<DownloadAccountDetail>({ url: accountPath(id), method: 'GET', signal })
}
export function checkDownloadAccount(id: string, signal?: AbortSignal) {
  return request<DownloadAccountDetail>({ url: `${accountPath(id)}/check`, method: 'POST', signal })
}
export function previewAccountAdoption(expectedRegistryVersion: number, displayName?: string, signal?: AbortSignal) {
  return request<AdoptionPlan>({ url: `${accountsBase}/adoption-plans`, method: 'POST', data: { expectedRegistryVersion, ...(displayName ? { displayName } : {}) }, signal })
}
export function confirmAccountAdoption(plan: AdoptionPlan, signal?: AbortSignal) {
  return request<DownloadAccountDetail>({ url: `${accountsBase}/adoption-plans/${encodeURIComponent(plan.id)}/confirm`, method: 'POST', data: { expectedRegistryVersion: plan.registryVersion, expectedPlanVersion: plan.planVersion }, signal })
}
export function updateAccountDefaults(expectedRegistryVersion: number, defaults: { category: DownloadCategory; targetId: string }[], signal?: AbortSignal) {
  return request<DownloadAccountList>({ url: `${accountsBase}/category-defaults`, method: 'PUT', data: { expectedRegistryVersion, defaults }, signal })
}
export function updateAccountAccepting(id: string, expectedRegistryVersion: number, acceptingNewTasks: boolean, signal?: AbortSignal) {
  return request<DownloadAccountDetail>({ url: `${accountPath(id)}/accepting-new-tasks`, method: 'PUT', data: { expectedRegistryVersion, acceptingNewTasks }, signal })
}
export function createOnboardingPlan(data: OnboardingPlanRequest, signal?: AbortSignal) {
  return request<OnboardingPlan>({ url: `${accountsBase}/onboarding-plans`, method: 'POST', data, signal })
}
export function getOnboardingPlan(id: string, signal?: AbortSignal) {
  return request<OnboardingPlan>({ url: `${accountsBase}/onboarding-plans/${encodeURIComponent(id)}`, method: 'GET', signal })
}
export function authorizeNativeDav(plan: OnboardingPlan, credentials: { endpoint: string; username: string; password: string }, signal?: AbortSignal) {
  return request<OnboardingPlan>({ url: `${accountsBase}/onboarding-plans/${encodeURIComponent(plan.id)}/native-webdav`, method: 'PUT', data: { expectedPlanVersion: plan.planVersion, ...credentials }, signal })
}
export function executeOnboardingPlan(plan: OnboardingPlan, signal?: AbortSignal) {
  return request<OnboardingExecution>({ url: `${accountsBase}/onboarding-plans/${encodeURIComponent(plan.id)}/execute`, method: 'POST', data: { expectedPlanVersion: plan.planVersion, expectedRegistryVersion: plan.registryVersion }, signal })
}
export function getOnboardingExecutions(signal?: AbortSignal) {
  return request<OnboardingExecutionList>({ url: `${accountsBase}/onboarding-executions`, method: 'GET', signal })
}
export function getOnboardingExecution(id: string, signal?: AbortSignal) {
  return request<OnboardingExecution>({ url: `${accountsBase}/onboarding-executions/${encodeURIComponent(id)}`, method: 'GET', signal })
}
export function continueOnboardingExecution(execution: OnboardingExecution, signal?: AbortSignal) {
  return request<OnboardingExecution>({ url: `${accountsBase}/onboarding-executions/${encodeURIComponent(execution.id)}/continue`, method: 'POST', data: { expectedExecutionVersion: execution.executionVersion }, signal })
}

const wecomBase = `${base}/wecom`
export function getWeComAccounts(signal?: AbortSignal) {
  return request<WeComAccounts>({ url: `${wecomBase}/bindings`, method: 'GET', signal })
}
export function getWeComMembers(signal?: AbortSignal) {
  return request<WeComDirectory>({ url: `${wecomBase}/members`, method: 'GET', signal, timeout: 60_000 })
}
export function bindWeComMember(userId: number, scope: WeComScope, memberId: string) {
  return request<boolean>({ url: `${wecomBase}/bindings/${userId}`, method: 'PUT', data: { scope, memberId } })
}
export function unbindWeComMember(userId: number, scope: WeComScope) {
  return request<boolean>({ url: `${wecomBase}/bindings/${userId}`, method: 'DELETE', params: scope })
}
