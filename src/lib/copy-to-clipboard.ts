export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Browsers may reject Clipboard API calls outside a secure context.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable')
  }

  const previousFocus = document.activeElement as HTMLElement | null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('Clipboard copy command was rejected')
    }
  } finally {
    document.body.removeChild(textarea)
    previousFocus?.focus()
  }
}
