/**
 * Arrow keys for a hand-built radio group (role="radiogroup" holding
 * role="radio" buttons), as the ARIA radio pattern describes. Use as
 * `{@attach radioKeys}` on the group.
 *
 * The arrows move to the next or previous enabled radio, wrapping, and Home
 * and End to the first and last; moving there checks it, by clicking it so the
 * button's own handler runs. The group's markup gives the checked radio
 * tabindex 0 and the rest -1, so the whole group is one tab stop.
 */
export function radioKeys(group: HTMLElement): () => void {
  function onkeydown(e: KeyboardEvent): void {
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')].filter(
      (r) => !r.disabled,
    )
    const i = radios.indexOf(e.target as HTMLButtonElement)
    if (i < 0) return
    const last = radios.length - 1
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next === null) return
    e.preventDefault()
    radios[next].focus()
    radios[next].click()
  }
  group.addEventListener('keydown', onkeydown)
  return () => group.removeEventListener('keydown', onkeydown)
}
