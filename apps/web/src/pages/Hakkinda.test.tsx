import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@ulasim20/ui-page-shell', () => ({
  DesktopNav: () => null,
  MobileNav: () => null,
}))

import HakkindaPage from './Hakkinda'

function renderPage() {
  return render(
    <MemoryRouter>
      <HakkindaPage />
    </MemoryRouter>,
  )
}

describe('<HakkindaPage />', () => {
  it('links to the support page', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /destek ol/i })).toHaveAttribute('href', '/destek-ol')
  })
})
