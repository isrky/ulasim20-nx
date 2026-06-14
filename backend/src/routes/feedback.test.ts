import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

async function post(body: unknown): Promise<Response> {
  return SELF.fetch('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/feedback', () => {
  it('accepts a valid payload and returns a generated id', async () => {
    const res = await post({
      type: 'oneri',
      message: 'Bu bir uzun yeterince mesajdır.',
      name: 'Ada',
      email: 'ada@example.com',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; id: string }
    expect(body.success).toBe(true)
    expect(body.id).toMatch(/^\d+-[a-z0-9]{1,10}$/)
  })

  it('coerces an unknown type to "diger"', async () => {
    const res = await post({
      type: 'admin',
      message: 'Yeterli uzunlukta bir mesaj.',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean }
    expect(body.success).toBe(true)
  })

  it('rejects missing or empty messages', async () => {
    const res = await post({ type: 'oneri', message: '   ' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/Mesaj/)
  })

  it('rejects messages longer than the hard cap', async () => {
    const res = await post({ type: 'oneri', message: 'a'.repeat(5001) })
    expect(res.status).toBe(400)
  })

  it('rejects names longer than 200 chars', async () => {
    const res = await post({
      type: 'oneri',
      message: 'Yeterince uzun bir mesaj.',
      name: 'a'.repeat(201),
    })
    expect(res.status).toBe(400)
  })
})
