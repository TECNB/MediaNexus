import assert from 'node:assert/strict'
import test from 'node:test'

import { copyTextToClipboard } from '../src/lib/copy-to-clipboard.ts'

test('falls back when the Clipboard API rejects the copy request', async () => {
  let fallbackCopyAttempted = false

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error('clipboard permission denied')
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      activeElement: null,
      body: {
        appendChild: () => undefined,
        removeChild: () => undefined,
      },
      createElement: () => ({
        focus: () => undefined,
        select: () => undefined,
        setAttribute: () => undefined,
        style: {},
        value: '',
      }),
      execCommand: (command: string) => {
        fallbackCopyAttempted = command === 'copy'
        return fallbackCopyAttempted
      },
      getSelection: () => null,
    },
  })

  await copyTextToClipboard('registration-code')

  assert.equal(fallbackCopyAttempted, true)
})
