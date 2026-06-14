import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import DestekOlPage from './DestekOl'

function renderPage() {
  return render(
    <MemoryRouter>
      <DestekOlPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('<DestekOlPage />', () => {
  it('shows warm support copy and the Kreosus donation container', async () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Destek Ol', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/bu projeye destek olun/i)).toBeInTheDocument()
    expect(screen.getByText(/denizli’de toplu taşımayı daha kolay takip/i)).toBeInTheDocument()
    expect(screen.getByText(/küçük bir destek bile/i)).toBeInTheDocument()

    const kreosus = document.getElementById('kreosus')
    expect(kreosus).toBeInTheDocument()
    expect(kreosus).toHaveAttribute('data-id', '5647')
    expect(kreosus).toHaveAttribute('data-start-page', '0')
    expect(kreosus).toHaveAttribute('data-bg-color', 'ffffff')
    expect(kreosus).toHaveAttribute('data-iframe-api', 'true')

    await waitFor(() => {
      expect(document.getElementById('kreosus-iframe-api')).toBeInTheDocument()
    })
  })

  it('explains that payments are handled by Kreosus outside the app', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: /güvenlik ve gizlilik/i })).toBeInTheDocument()
    expect(screen.getByText(/bağış işlemleri kreosus üzerinden gerçekleşir/i)).toBeInTheDocument()
    expect(screen.getByText(/kart bilgilerinizi, ödeme bilgilerinizi/i)).toBeInTheDocument()
    expect(screen.getByText(/toplamaz, işlemez ya da saklamaz/i)).toBeInTheDocument()
  })

  it('shows a direct Kreosus fallback link', () => {
    renderPage()

    expect(screen.getByText(/bağış alanı yüklenemediyse/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /kreosus.com\/isrky/i })).toHaveAttribute(
      'href',
      'https://kreosus.com/isrky',
    )
  })

  it('does not inject the Kreosus script more than once', async () => {
    const { unmount } = renderPage()

    await waitFor(() => {
      expect(document.querySelectorAll('#kreosus-iframe-api')).toHaveLength(1)
    })

    unmount()
    renderPage()

    expect(document.querySelectorAll('#kreosus-iframe-api')).toHaveLength(1)
  })
})
