'use client'

import { type ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { type BusLine, type BusStop, busLines, busStops } from '@ulasim20/data-access-mock-data'

interface TransitContextType {
  favoriteStops: string[]
  favoriteLines: string[]
  addFavoriteStop: (stopId: string) => void
  removeFavoriteStop: (stopId: string) => void
  addFavoriteLine: (lineId: string) => void
  removeFavoriteLine: (lineId: string) => void
  isFavoriteStop: (stopId: string) => boolean
  isFavoriteLine: (lineId: string) => boolean
  getFavoriteStops: () => BusStop[]
  getFavoriteLines: () => BusLine[]
  savedCards: string[]
  addSavedCard: (cardNumber: string) => void
  removeSavedCard: (cardNumber: string) => void
}

const TransitContext = createContext<TransitContextType | undefined>(undefined)

export function TransitProvider({ children }: { children: ReactNode }) {
  const [favoriteStops, setFavoriteStops] = useState<string[]>(['s1', 's3', 's5'])
  const [favoriteLines, setFavoriteLines] = useState<string[]>(['l1', 'l3'])
  const [savedCards, setSavedCards] = useState<string[]>([])

  const addFavoriteStop = useCallback((stopId: string) => {
    setFavoriteStops((prev) => [...prev, stopId])
  }, [])

  const removeFavoriteStop = useCallback((stopId: string) => {
    setFavoriteStops((prev) => prev.filter((id) => id !== stopId))
  }, [])

  const addFavoriteLine = useCallback((lineId: string) => {
    setFavoriteLines((prev) => [...prev, lineId])
  }, [])

  const removeFavoriteLine = useCallback((lineId: string) => {
    setFavoriteLines((prev) => prev.filter((id) => id !== lineId))
  }, [])

  const isFavoriteStop = useCallback(
    (stopId: string) => {
      return favoriteStops.includes(stopId)
    },
    [favoriteStops],
  )

  const isFavoriteLine = useCallback(
    (lineId: string) => {
      return favoriteLines.includes(lineId)
    },
    [favoriteLines],
  )

  const getFavoriteStops = useCallback(() => {
    return busStops.filter((stop) => favoriteStops.includes(stop.id))
  }, [favoriteStops])

  const getFavoriteLines = useCallback(() => {
    return busLines.filter((line) => favoriteLines.includes(line.id))
  }, [favoriteLines])

  const addSavedCard = useCallback((cardNumber: string) => {
    setSavedCards((prev) => [...prev, cardNumber])
  }, [])

  const removeSavedCard = useCallback((cardNumber: string) => {
    setSavedCards((prev) => prev.filter((c) => c !== cardNumber))
  }, [])

  return (
    <TransitContext.Provider
      value={{
        favoriteStops,
        favoriteLines,
        addFavoriteStop,
        removeFavoriteStop,
        addFavoriteLine,
        removeFavoriteLine,
        isFavoriteStop,
        isFavoriteLine,
        getFavoriteStops,
        getFavoriteLines,
        savedCards,
        addSavedCard,
        removeSavedCard,
      }}
    >
      {children}
    </TransitContext.Provider>
  )
}

export function useTransit() {
  const context = useContext(TransitContext)
  if (context === undefined) {
    throw new Error('useTransit must be used within a TransitProvider')
  }
  return context
}
