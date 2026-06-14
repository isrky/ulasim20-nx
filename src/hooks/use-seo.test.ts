import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSEO } from './use-seo'

describe('useSEO', () => {
  beforeEach(() => {
    document.title = 'Denizli Ulaşım'
    for (const el of document.querySelectorAll('meta[name="description"]')) {
      el.remove()
    }
    for (const el of document.querySelectorAll('meta[property^="og:"]')) {
      el.remove()
    }
    for (const el of document.querySelectorAll('link[rel="canonical"]')) {
      el.remove()
    }
  })

  it('updates document title, description and open graph tags', () => {
    const { unmount } = renderHook(() =>
      useSEO({
        title: 'Test Sayfa',
        description: 'Test Detaylari',
        ogType: 'website',
      }),
    )

    expect(document.title).toBe('Test Sayfa | Denizli Ulaşım')

    const descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement
    expect(descMeta).not.toBeNull()
    expect(descMeta.content).toBe('Test Detaylari')

    const ogTitleMeta = document.querySelector('meta[property="og:title"]') as HTMLMetaElement
    expect(ogTitleMeta).not.toBeNull()
    expect(ogTitleMeta.content).toBe('Test Sayfa | Denizli Ulaşım')

    // Clean up check
    unmount()
    expect(document.title).toBe('Denizli Ulaşım')
  })
})
