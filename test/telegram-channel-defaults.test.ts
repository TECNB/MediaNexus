import assert from 'node:assert/strict'
import test from 'node:test'

import { telegramResourceModeDefaults } from '../src/lib/telegram-channel-defaults.ts'

test('uses lower engagement defaults for hashtag resources', () => {
  assert.deepEqual(telegramResourceModeDefaults('hashtag_resource'), {
    resource_mode: 'hashtag_resource',
    min_views: 500,
    min_forwards: 1,
  })
})

test('keeps ordinary groups on the standard engagement defaults', () => {
  assert.deepEqual(telegramResourceModeDefaults('group'), {
    resource_mode: 'group',
    min_views: 5000,
    min_forwards: 10,
  })
})
