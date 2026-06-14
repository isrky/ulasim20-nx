import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import BulunamadiPage from './Bulunamadi'

function renderPage() {
  return render(
    <MemoryRouter>
      <BulunamadiPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('<BulunamadiPage />', () => {
  it('renders the 404 heading, custom message, and redirect link', () => {
    renderPage()

    // Heading verification
    expect(
      screen.getByRole('heading', { name: '404 - Sayfa Bulunamadı', level: 1 }),
    ).toBeInTheDocument()

    // Description text verification
    expect(
      screen.getByText(/aradığınız otobüs hattı, durak veya sayfa mevcut değil/i),
    ).toBeInTheDocument()

    // Redirection CTA link verification
    const link = screen.getByRole('link', { name: 'Ana Sayfaya Dön' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })
})
