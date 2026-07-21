import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboardSource = readFileSync(
  new URL('../src/pages/dashboard/index.tsx', import.meta.url),
  'utf8',
)
const apiSource = readFileSync(
  new URL('../src/lib/api/admin-registration-code.ts', import.meta.url),
  'utf8',
)

test('binds the selected inviter when generating a registration code', () => {
  assert.match(dashboardSource, /新注册码邀请人/)
  assert.match(dashboardSource, /inviter_user_id: selectedInviterUserId/)
  assert.match(dashboardSource, /无邀请人（管理员直接邀请）/)
  assert.match(apiSource, /generateAdminRegistrationCode\([\s\S]*payload/)
  assert.match(apiSource, /registration-code\/generate', payload/)
})
