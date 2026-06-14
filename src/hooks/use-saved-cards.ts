import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tr20_saved_cards'

export interface SavedCard {
  /** Sorgulamada kullanılan TC / mifare değeri */
  queryId: string
  /** API'den dönen gerçek mifare ID */
  mifareId: string
  /** Görüntülenecek etiket (isim + soyisim) */
  label: string
  /** Kart türü açıklaması (ÖĞRENCİ, SİVİL, vb.) */
  cardType: string
  /** Eklenme tarihi (ISO) */
  addedAt: string
  /** Son kullanım tarihi (ISO) */
  lastUsedAt?: string
  /** Son bilinen bakiye (sayı olarak) */
  lastBalance?: number
  /** Son kontrol tarihi (ISO) */
  lastCheckedAt?: string
  /** Düşük bakiye uyarısı verildi mi? */
  notifiedLowBalance?: boolean
}

/**
 * Kaydedilmiş Denizli Kartlarını yöneten hook.
 * localStorage kullanarak birden fazla kartı saklar.
 */
export function useSavedCards() {
  const [cards, setCards] = useState<SavedCard[]>([])

  // localStorage'dan yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setCards(parsed)
      }
    } catch (error) {
      console.error('Kaydedilmiş kartlar yüklenirken hata:', error)
    }
  }, [])

  const save = useCallback((next: SavedCard[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setCards(next)
    } catch (error) {
      console.error('Kartlar kaydedilirken hata:', error)
    }
  }, [])

  /** Kart zaten kayıtlı mı? (mifare ID ile kontrol) */
  const isSaved = useCallback(
    (mifareId: string): boolean => cards.some((c) => c.mifareId === mifareId),
    [cards],
  )

  /** Yeni kart ekle */
  const addCard = useCallback(
    (card: Omit<SavedCard, 'addedAt'>) => {
      if (isSaved(card.mifareId)) return
      save([...cards, { ...card, addedAt: new Date().toISOString() }])
    },
    [cards, isSaved, save],
  )

  /** Kartı kaldır (mifare ID ile) */
  const removeCard = useCallback(
    (mifareId: string) => {
      save(cards.filter((c) => c.mifareId !== mifareId))
    },
    [cards, save],
  )

  /** Kart bilgilerini güncelle (mifare ID ile) */
  const updateCard = useCallback(
    (mifareId: string, updates: Partial<SavedCard>) => {
      save(cards.map((c) => (c.mifareId === mifareId ? { ...c, ...updates } : c)))
    },
    [cards, save],
  )

  /** Kartı aktif/son kullanılan kart olarak işaretle */
  const markCardUsed = useCallback(
    (mifareId: string) => {
      updateCard(mifareId, { lastUsedAt: new Date().toISOString() })
    },
    [updateCard],
  )

  return { cards, isSaved, addCard, removeCard, updateCard, markCardUsed }
}
