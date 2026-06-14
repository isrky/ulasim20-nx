import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { DesktopNav, MobileNav } from './navigation'

describe('navigation', () => {
  it('shows a support page link in desktop navigation more menu', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <DesktopNav />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /daha fazla/i }))

    expect(screen.getByRole('link', { name: /destek ol/i })).toHaveAttribute('href', '/destek-ol')
  })

  it('shows a support page link in mobile navigation more menu', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /daha fazla/i }))

    expect(screen.getByRole('link', { name: /destek ol/i })).toHaveAttribute('href', '/destek-ol')
  })
})
