import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const usersPageSource = readFileSync(
  new URL('../src/pages/users/index.tsx', import.meta.url),
  'utf8',
)

test('keeps user management columns on one line and scrolls the wide table', () => {
  assert.match(
    usersPageSource,
    /<table className="[^"]*min-w-\[1640px\][^"]*"/,
  )

  const noWrapClassCount = usersPageSource.match(/whitespace-nowrap/g)?.length ?? 0
  assert.ok(
    noWrapClassCount >= 12,
    `expected at least 12 no-wrap layout constraints, got ${noWrapClassCount}`,
  )
  assert.match(usersPageSource, />邀请人<\/th>/)
  assert.match(usersPageSource, /user\.invited_by_username/)
})
