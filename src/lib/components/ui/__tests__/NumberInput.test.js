import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import NumberInput from '../NumberInput.svelte'

describe('NumberInput', () => {
  it('shows its unit beside the number and reads it out with the field', () => {
    const { getByRole, getByText } = render(NumberInput, { props: { value: 9000, unit: 'W' } })
    expect(getByText('W')).toBeInTheDocument()
    expect(getByRole('spinbutton')).toHaveAccessibleDescription('W')
  })

  it('has no unit unless given one', () => {
    const { getByRole } = render(NumberInput, { props: { value: 5 } })
    expect(getByRole('spinbutton')).not.toHaveAttribute('aria-describedby')
  })
})
