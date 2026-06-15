import { trackAnalyticsEvent } from '@ulasim20/util-analytics'
import { triggerHaptic } from '@ulasim20/data-access-capacitor'
import { useCallback, useEffect, useMemo, useState } from 'react'

export interface FavoriteLine {
  lineCode: string
  lineName: string
  addedAt: string
  clickCount?: number
}

const STORAGE_KEY = 'tr20_favorite_lines'

/**
 * Favori hatları yöneten hook
 * LocalStorage kullanarak favori hatları saklar
 */
export function useFavoriteLines() {
  const [favorites, setFavorites] = useState<FavoriteLine[]>([])

  // LocalStorage'dan favori hatları yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          // Eski favorilere clickCount ekle (geriye dönük uyumluluk)
          const withClickCount = parsed.map((fav) => ({
            ...fav,
            clickCount: fav.clickCount ?? 0,
          }))
          setFavorites(withClickCount)
        }
      }
    } catch (error) {
      console.error('Favori hatlar yüklenirken hata:', error)
    }
  }, [])

  // LocalStorage'a favori hatları kaydet
  const saveFavorites = useCallback((newFavorites: FavoriteLine[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites))
      setFavorites(newFavorites)
    } catch (error) {
      console.error('Favori hatlar kaydedilirken hata:', error)
    }
  }, [])

  // Bir hattın favori olup olmadığını kontrol et
  const isFavorite = useCallback(
    (lineCode: string): boolean => {
      return favorites.some((f) => f.lineCode === lineCode)
    },
    [favorites],
  )

  // Favori hatta ekle
  const addFavorite = useCallback(
    (lineCode: string, lineName: string) => {
      if (isFavorite(lineCode)) return

      const newFavorite: FavoriteLine = {
        lineCode,
        lineName,
        addedAt: new Date().toISOString(),
        clickCount: 0,
      }

      const newFavorites = [...favorites, newFavorite]
      saveFavorites(newFavorites)
      trackAnalyticsEvent('favorite_line_toggle', {
        action: 'add',
        line_code: lineCode,
      })
    },
    [favorites, isFavorite, saveFavorites],
  )

  // Tıklama sayısını artır
  const incrementClickCount = useCallback(
    (lineCode: string) => {
      const newFavorites = favorites.map((fav) =>
        fav.lineCode === lineCode ? { ...fav, clickCount: (fav.clickCount ?? 0) + 1 } : fav,
      )
      saveFavorites(newFavorites)
    },
    [favorites, saveFavorites],
  )

  // Favorileri tıklama sayısına göre sırala
  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      const countA = a.clickCount ?? 0
      const countB = b.clickCount ?? 0
      return countB - countA // Yüksekten düşüğe
    })
  }, [favorites])

  // Favorilerden çıkar
  const removeFavorite = useCallback(
    (lineCode: string) => {
      const newFavorites = favorites.filter((f) => f.lineCode !== lineCode)
      saveFavorites(newFavorites)
      trackAnalyticsEvent('favorite_line_toggle', {
        action: 'remove',
        line_code: lineCode,
      })
    },
    [favorites, saveFavorites],
  )

  // Favori durumunu toggle et
  const toggleFavorite = useCallback(
    (lineCode: string, lineName: string) => {
      triggerHaptic()
      if (isFavorite(lineCode)) {
        removeFavorite(lineCode)
      } else {
        addFavorite(lineCode, lineName)
      }
    },
    [isFavorite, removeFavorite, addFavorite],
  )

  // Tüm favorileri temizle
  const clearFavorites = useCallback(() => {
    saveFavorites([])
  }, [saveFavorites])

  return {
    favorites: sortedFavorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    incrementClickCount,
  }
}
