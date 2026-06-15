import { trackAnalyticsEvent } from '@ulasim20/util-analytics'
import { triggerHaptic } from '@ulasim20/data-access-capacitor'
import type { FavoriteStation } from '@/types/favorites'
import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'tr20_favorite_stations'

/**
 * Favori durakları yöneten hook
 * LocalStorage kullanarak favori durakları saklar
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteStation[]>([])

  // LocalStorage'dan favori durakları yükle
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
      console.error('Favori duraklar yüklenirken hata:', error)
    }
  }, [])

  // LocalStorage'a favori durakları kaydet
  const saveFavorites = useCallback((newFavorites: FavoriteStation[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites))
      setFavorites(newFavorites)
    } catch (error) {
      console.error('Favori duraklar kaydedilirken hata:', error)
    }
  }, [])

  // Bir durağın favori olup olmadığını kontrol et
  const isFavorite = useCallback(
    (stationId: number): boolean => {
      return favorites.some((f) => f.stationId === stationId)
    },
    [favorites],
  )

  // Favori durağa ekle
  const addFavorite = useCallback(
    (stationId: number, stationName: string) => {
      if (isFavorite(stationId)) return

      const newFavorite: FavoriteStation = {
        stationId,
        stationName,
        addedAt: new Date().toISOString(),
        clickCount: 0,
      }

      const newFavorites = [...favorites, newFavorite]
      saveFavorites(newFavorites)
      trackAnalyticsEvent('favorite_stop_toggle', {
        action: 'add',
        station_id: stationId,
      })
    },
    [favorites, isFavorite, saveFavorites],
  )

  // Tıklama sayısını artır
  const incrementClickCount = useCallback(
    (stationId: number) => {
      const newFavorites = favorites.map((fav) =>
        fav.stationId === stationId ? { ...fav, clickCount: (fav.clickCount ?? 0) + 1 } : fav,
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
    (stationId: number) => {
      const newFavorites = favorites.filter((f) => f.stationId !== stationId)
      saveFavorites(newFavorites)
      trackAnalyticsEvent('favorite_stop_toggle', {
        action: 'remove',
        station_id: stationId,
      })
    },
    [favorites, saveFavorites],
  )

  // Favori durumunu toggle et
  const toggleFavorite = useCallback(
    (stationId: number, stationName: string) => {
      triggerHaptic()
      if (isFavorite(stationId)) {
        removeFavorite(stationId)
      } else {
        addFavorite(stationId, stationName)
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
