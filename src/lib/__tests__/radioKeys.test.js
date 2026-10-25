import { describe, it, expect, vi, afterEach } from 'vitest'
import { radioKeys } from '../radioKeys'

// A hand-built radio group, as the dashboard's are: buttons with role="radio".
function group(disabled = []) {
  const root = document.createElement('div')
  root.setAttribute('role', 'radiogroup')
  const picked = vi.fn()
  for (const id of ['a', 'b', 'c', 'd']) {
    const b = document.createElement('button')
    b.setAttribute('role', 'radio')
    b.textContent = id
    b.disabled = disabled.includes(id)
    b.addEventListener('click', () => picked(id))
    root.append(b)
  }
  document.body.append(root)
  const stop = radioKeys(root)
  const radios = [...root.children]
  const press = (i, key) => radios[i].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  return { root, radios, picked, press, stop }
}

afterEach(() => { document.body.innerHTML = '' })

describe('radioKeys', () => {
  it('moves to and picks the next radio with the right or down arrow, wrapping', () => {
    const g = group()
    g.press(1, 'ArrowRight')
    expect(g.picked).toHaveBeenLastCalledWith('c')
    expect(document.activeElement).toBe(g.radios[2])
    g.press(3, 'ArrowDown')
    expect(g.picked).toHaveBeenLastCalledWith('a')
  })

  it('moves back with the left or up arrow, wrapping', () => {
    const g = group()
    g.press(0, 'ArrowLeft')
    expect(g.picked).toHaveBeenLastCalledWith('d')
    g.press(2, 'ArrowUp')
    expect(g.picked).toHaveBeenLastCalledWith('b')
  })

  it('jumps to the first and last with Home and End', () => {
    const g = group()
    g.press(2, 'Home')
    expect(g.picked).toHaveBeenLastCalledWith('a')
    g.press(0, 'End')
    expect(g.picked).toHaveBeenLastCalledWith('d')
  })

  it('skips disabled radios', () => {
    const g = group(['c'])
    g.press(1, 'ArrowRight')
    expect(g.picked).toHaveBeenLastCalledWith('d')
  })

  it('leaves other keys alone, and stops listening when detached', () => {
    const g = group()
    g.press(1, 'Enter')
    expect(g.picked).not.toHaveBeenCalled()
    g.stop()
    g.press(1, 'ArrowRight')
    expect(g.picked).not.toHaveBeenCalled()
  })
})
