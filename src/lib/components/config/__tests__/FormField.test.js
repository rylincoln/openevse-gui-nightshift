// src/lib/components/config/__tests__/FormField.test.js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import FormField from '../FormField.svelte'

const control = createRawSnippet(() => ({ render: () => `<input data-testid="ctl" />` }))

describe('FormField', () => {
  it('renders the label, description and slotted control', () => {
    const { getByText, getByTestId } = render(FormField, {
      label: 'Hostname',
      description: 'The device name on the network',
      children: control,
    })
    expect(getByText('Hostname')).toBeInTheDocument()
    expect(getByText('The device name on the network')).toBeInTheDocument()
    expect(getByTestId('ctl')).toBeInTheDocument()
  })
  it('shows a saving spinner when status is saving', () => {
    const { container } = render(FormField, { label: 'X', status: 'saving', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:loading"]')).toBeTruthy()
  })
  it('shows a check when status is saved', () => {
    const { container } = render(FormField, { label: 'X', status: 'saved', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:check"]')).toBeTruthy()
  })
  it('shows an error icon when status is error', () => {
    const { container } = render(FormField, { label: 'X', status: 'error', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:alert-circle-outline"]')).toBeTruthy()
  })
  it('shows no status icon when idle', () => {
    const { container } = render(FormField, { label: 'X', status: 'idle', children: control })
    expect(container.querySelector('iconify-icon')).toBeFalsy()
  })

  // The control arrives as a snippet, so FormField links it to the label
  // rather than relying on every caller to wire up for/id.
  describe('accessible name', () => {
    const snippet = (html) => createRawSnippet(() => ({ render: () => `<div>${html}</div>` }))

    it('names its control after the label', () => {
      const { getByRole } = render(FormField, { label: 'Hostname', children: snippet('<input />') })
      expect(getByRole('textbox', { name: 'Hostname' })).toBeInTheDocument()
    })

    it('describes its control with the description', () => {
      const { getByRole } = render(FormField, {
        label: 'Hostname',
        description: 'The device name on the network',
        children: snippet('<input />'),
      })
      expect(getByRole('textbox')).toHaveAccessibleDescription('The device name on the network')
    })

    it('names a switch, even one with an empty aria-label', () => {
      const { getByRole } = render(FormField, {
        label: 'Enable MQTT',
        children: snippet('<button role="switch" aria-checked="false" aria-label=""></button>'),
      })
      expect(getByRole('switch', { name: 'Enable MQTT' })).toBeInTheDocument()
    })

    it('names only the first control, not the buttons beside it', () => {
      const { getByRole } = render(FormField, {
        label: 'Server',
        children: snippet('<input /><button>Test</button>'),
      })
      expect(getByRole('textbox', { name: 'Server' })).toBeInTheDocument()
      expect(getByRole('button', { name: 'Test' })).toBeInTheDocument()
    })

    it('leaves a control that already has a name alone', () => {
      const { getByRole } = render(FormField, {
        label: 'Server',
        children: snippet('<input aria-label="MQTT server" />'),
      })
      expect(getByRole('textbox', { name: 'MQTT server' })).toBeInTheDocument()
    })

    it('names a control that appears after the field first renders', async () => {
      const { getByTestId, findByRole } = render(FormField, {
        label: 'Password',
        children: createRawSnippet(() => ({ render: () => `<div data-testid="slot"></div>` })),
      })
      getByTestId('slot').appendChild(document.createElement('select'))
      expect(await findByRole('combobox', { name: 'Password' })).toBeInTheDocument()
    })
  })
})
