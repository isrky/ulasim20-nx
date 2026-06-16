import { apiGet } from '@ulasim20/data-access-transport-api'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useCallback, useEffect, useRef } from 'react'
import { useSavedCards } from './use-saved-cards'

const LOW_BALANCE_THRESHOLD = 20.0
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

interface CardInfoData {
  mifareId: string
  currentBalance: string
  name: string
  surname: string
}

interface CardInfoResponse {
  isSuccess: boolean
  value: CardInfoData[]
  error: string | null
}

/**
 * Uygulama açıldığında veya aktif olduğunda kayıtlı kartların bakiyesini kontrol eden hook.
 * Throttling (4 saat) uygulayarak API limitlerini ve bataryayı korur.
 */
export function useBalanceAutoCheck() {
  const { cards, updateCard } = useSavedCards()
  const isChecking = useRef(false)

  const checkBalances = useCallback(async () => {
    if (isChecking.current || cards.length === 0) return
    isChecking.current = true

    try {
      const now = Date.now()
      const cardsToCheck = cards.filter((card) => {
        if (!card.lastCheckedAt) return true
        const lastCheck = new Date(card.lastCheckedAt).getTime()
        return now - lastCheck >= CHECK_INTERVAL_MS
      })

      if (cardsToCheck.length === 0) return

      // Bildirim izinlerini kontrol et/iste
      const perms = await LocalNotifications.checkPermissions()
      if (perms.display !== 'granted') {
        await LocalNotifications.requestPermissions()
      }

      for (const card of cardsToCheck) {
        try {
          const res = await apiGet<CardInfoResponse>(
            `/UlasimBackend/api/Calc/GetCardInfo?mifareId=${encodeURIComponent(card.mifareId)}`,
          )

          if (res.isSuccess && Array.isArray(res.value) && res.value.length > 0) {
            const data = res.value[0]
            const balance = Number.parseFloat(data.currentBalance?.replace(',', '.') || '0')

            // Bildirim mantığı
            if (balance < LOW_BALANCE_THRESHOLD && !card.notifiedLowBalance) {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: 'Düşük Bakiye Uyarısı',
                    body: `"${card.label || card.mifareId}" kartınızın bakiyesi ${balance.toFixed(2)} TL'ye düştü.`,
                    id: Math.floor(Math.random() * 1000000),
                    schedule: { at: new Date(Date.now() + 1000) },
                    sound: 'default',
                  },
                ],
              })

              updateCard(card.mifareId, {
                lastBalance: balance,
                lastCheckedAt: new Date().toISOString(),
                notifiedLowBalance: true,
              })
            } else {
              // Bakiye eşiğin üstündeyse uyarılmış bayrağını sıfırla (yeniden dolum durumu)
              updateCard(card.mifareId, {
                lastBalance: balance,
                lastCheckedAt: new Date().toISOString(),
                notifiedLowBalance: balance < LOW_BALANCE_THRESHOLD,
              })
            }
          }
        } catch (error) {
          console.error(`Bakiye kontrolü hatası (${card.mifareId}):`, error)
        }
      }
    } finally {
      isChecking.current = false
    }
  }, [cards, updateCard])

  useEffect(() => {
    // İlk açılışta kontrol et
    checkBalances()

    // Uygulama her ön plana geldiğinde kontrol et
    const listener = App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        checkBalances()
      }
    })

    return () => {
      listener.then((l) => l.remove())
    }
  }, [checkBalances]) // Sadece checkBalances fonksiyonu değiştiğinde veya mount edildiğinde
}
