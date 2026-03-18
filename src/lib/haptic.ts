export function haptic(pattern: number | number[] = 10) {
  if (typeof window === 'undefined') return

  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
    return
  }

  // iOS fallback: checkbox trick
  const input = document.createElement('input')
  input.setAttribute('type', 'checkbox')
  input.setAttribute('tabindex', '-1')
  input.setAttribute('inputmode', 'none')
  Object.assign(input.style, {
    opacity: '0',
    position: 'fixed',
    top: '0',
    left: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(input)
  input.focus()
  input.click()
  setTimeout(() => document.body.removeChild(input), 100)
}
