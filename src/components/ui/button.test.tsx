import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('<Button />', () => {
  it('renders children as accessible text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('invokes onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: /go/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Blocked
      </Button>,
    )
    const btn = screen.getByRole('button', { name: /blocked/i })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies the destructive variant class', () => {
    render(<Button variant="destructive">Delete</Button>)
    const btn = screen.getByRole('button', { name: /delete/i })
    expect(btn.className).toMatch(/bg-destructive/)
  })

  it('renders as a Slot child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/foo">Go to foo</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: /go to foo/i })
    expect(link).toHaveAttribute('href', '/foo')
    expect(link).toHaveAttribute('data-slot', 'button')
  })
})
