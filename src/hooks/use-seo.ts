import { useEffect } from 'react'

interface SEOProps {
  title: string
  description?: string
  ogImage?: string
  ogType?: 'website' | 'article'
}

export function useSEO({ title, description, ogImage, ogType = 'website' }: SEOProps) {
  useEffect(() => {
    // 1. Update document title
    const prevTitle = document.title
    document.title = `${title} | Denizli Ulaşım`

    // 2. Helper to set or create meta tag
    const updateMetaTag = (name: string, value: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let el = document.querySelector(selector) as HTMLMetaElement
      if (!el) {
        el = document.createElement('meta')
        if (isProperty) el.setAttribute('property', name)
        else el.setAttribute('name', name)
        document.head.appendChild(el)
      }
      el.content = value
    }

    // 3. Update Standard & Social tags
    const desc =
      description ||
      "Denizli'nin akıllı ulaşım portalı. Otobüs saatleri, güzergahlar, duraklar ve bakiye sorgulama."
    updateMetaTag('description', desc)
    updateMetaTag('og:title', `${title} | Denizli Ulaşım`, true)
    updateMetaTag('og:description', desc, true)
    updateMetaTag('og:url', window.location.href, true)
    updateMetaTag('og:type', ogType, true)

    // OG Image (fallback to a default logo)
    const image = ogImage || `${window.location.origin}/logo.svg`
    updateMetaTag('og:image', image, true)

    // 4. Update Canonical Link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = window.location.href

    // Cleanup: restore title on unmount
    return () => {
      document.title = prevTitle
    }
  }, [title, description, ogImage, ogType])
}
export type { SEOProps }
