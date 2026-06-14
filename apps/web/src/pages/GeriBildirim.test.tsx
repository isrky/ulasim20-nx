import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The page is heavy with DOM-tied concerns (Radix DesktopNav, PocketBase,
// localStorage). Mock everything at the module boundary so we can focus on
// the form logic.

const getOne = vi.fn()
const create = vi.fn()

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: () => ({ getOne, create }),
  },
}))

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
}))

vi.mock('@/components/navigation', () => ({
  DesktopNav: () => null,
  MobileNav: () => null,
}))

import FeedbackPage from './GeriBildirim'

function renderPage() {
  return render(
    <MemoryRouter>
      <FeedbackPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  getOne.mockReset()
  create.mockReset()
})

describe('<FeedbackPage /> — initial render', () => {
  it('shows the feedback form heading and action buttons', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: /geri bildirim/i, level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /öneri/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hata bildirimi/i })).toBeInTheDocument()
  })

  it('disables the submit button until the message is long enough', async () => {
    const user = userEvent.setup()
    renderPage()

    const submit = screen.getByRole('button', { name: /gönder/i })
    expect(submit).toBeDisabled()

    const textarea = screen.getByPlaceholderText(/en az 10 karakter/i)
    await user.type(textarea, 'yeterince uzun mesaj')
    expect(submit).toBeEnabled()
  })
})

describe('<FeedbackPage /> — submit flow', () => {
  it('renders the thank-you view and persists the returned id', async () => {
    create.mockResolvedValueOnce({ id: 'abcdefghij01234', created: new Date().toISOString() })

    const user = userEvent.setup()
    renderPage()

    const textarea = screen.getByPlaceholderText(/en az 10 karakter/i)
    await user.type(textarea, 'Bu bir uzun test mesajıdır, yeterince uzun.')

    await user.click(screen.getByRole('button', { name: /^gönder$/i }))

    expect(await screen.findByRole('heading', { name: /teşekkürler/i })).toBeInTheDocument()

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'oneri',
        status: 'bekliyor',
      }),
    )

    expect(localStorage.getItem('ulasim_feedback_ids')).toBe('["abcdefghij01234"]')
  })

  it('shows an error when PocketBase rejects the create', async () => {
    create.mockRejectedValueOnce(new Error('boom'))

    const user = userEvent.setup()
    renderPage()

    const textarea = screen.getByPlaceholderText(/en az 10 karakter/i)
    await user.type(textarea, 'başka bir test mesajı, uzun ve yeterli.')

    await user.click(screen.getByRole('button', { name: /^gönder$/i }))

    expect(await screen.findByText(/gönderilemedi/i)).toBeInTheDocument()
  })
})
