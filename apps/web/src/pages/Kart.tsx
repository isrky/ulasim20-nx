import { apiGet } from '@ulasim20/data-access-transport-api'
import { DesktopNav, MobileNav } from '@ulasim20/ui-page-shell'
import { Button } from '@ulasim20/ui-primitives'
import { Card } from '@ulasim20/ui-primitives'
import { Input } from '@ulasim20/ui-primitives'
import { Skeleton } from '@ulasim20/ui-primitives'
import { useSavedCards } from '@ulasim20/feature-card'
import { useSEO } from '@ulasim20/util-hooks'
import { normalizeAnalyticsCardType, trackAnalyticsEvent } from '@ulasim20/util-analytics'
import { openExternalUrl, triggerHaptic } from '@ulasim20/data-access-capacitor'
import { NfcScanError, isNfcCardScanSupported, scanCardUidOnce } from '@ulasim20/data-access-capacitor'
import { ImpactStyle } from '@capacitor/haptics'
import {
  AlertTriangle,
  Check,
  Clock,
  CreditCard,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const LOW_BALANCE_THRESHOLD = 20.0

interface CardInfoData {
  mifareId: string
  cardType: string
  cardTypeDescription: string
  productionDate: string
  lastTransactionDate: string
  currentBalance: string
  name: string
  surname: string
  validityStartDate: string
  validityEndDate: string
  cardStatus: string
  citizenshipNumber: string
  remainingPass: string
  subscriptionStartDateTime: string
  subscriptionEndDateTime: string
  subscriptionPlatform: string
}

interface CardInfoResponse {
  isSuccess: boolean
  value: CardInfoData[] | null
  error: unknown
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  }
  return null
}

function getNfcFailureMessage(reason: string): string {
  if (reason === 'permission_denied') return 'NFC izni verilmedi. Elle aramayı kullanabilirsiniz.'
  if (reason === 'no_uid') return 'Kart numarası okunamadı. Elle aramayı deneyin.'
  return 'NFC ile okuma başarısız oldu. Elle aramayı deneyin.'
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.startsWith('0001')) return '-'
  const parts = dateStr.split(' ')[0]
  if (!parts) return dateStr
  const [day, month, year] = parts.split('.')
  if (!day || !month || !year) return dateStr
  return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`
}

function formatDateTime(dateStr: string): string {
  if (!dateStr || dateStr.startsWith('0001')) return '-'
  const [datePart, timePart] = dateStr.split(' ')
  if (!datePart) return dateStr
  const [day, month, year] = datePart.split('.')
  if (!day || !month || !year) return dateStr
  const formatted = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`
  if (!timePart) return formatted
  const [h, m] = timePart.split(':')
  return `${formatted} ${h}:${m}`
}

function normalizeCardQuery(value: string): string {
  return value.replace(/[\s:]/g, '')
}

/** Kart numarası gösteriminde sondaki kozmetik sıfırları kaldırır */
function displayCardId(mifareId: string): string {
  return (mifareId ?? '').replace(/0+$/, '')
}

function TransitCardVisual({ card }: { card: CardInfoData }) {
  const isStudent = card.cardTypeDescription?.toLowerCase().includes('öğrenci')
  const balance = Number.parseFloat(card.currentBalance?.replace(',', '.') || '0')
  const ownerName = `${card.name || ''} ${card.surname || ''}`.trim() || '-'
  const imageSrc = isStudent ? '/ogrenci.jpeg' : '/kontorlu.jpeg'

  return (
    <div className="relative w-full aspect-[1.58/1] max-w-sm mx-auto">
      <div className="absolute inset-0 rounded-xl shadow-xl overflow-hidden bg-gray-200">
        <img
          src={imageSrc}
          alt={isStudent ? 'Öğrenci Kartı' : 'Kontörlü Kart'}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Dynamic content overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-12 left-6 right-6">
          <p className="text-white/80 text-xs font-medium drop-shadow-md">Bakiye</p>
          <p
            className={`text-3xl font-bold drop-shadow-lg ${balance < LOW_BALANCE_THRESHOLD ? 'text-red-400' : 'text-white'}`}
          >
            {balance.toFixed(2)} TL
          </p>
        </div>

        <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end">
          <div>
            <p className="text-white/80 text-[10px] drop-shadow-md">Kart Sahibi</p>
            <p className="text-white text-sm font-medium drop-shadow-lg">{ownerName}</p>
          </div>
          <div className="text-right">
            <p className="text-white/80 text-[10px] drop-shadow-md">Kart No</p>
            <p className="text-white text-xs drop-shadow-lg font-mono">
              {displayCardId(card.mifareId)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildCardAnalyticsPayload(card: CardInfoData) {
  const balance = Number.parseFloat(card.currentBalance?.replace(',', '.') || '0')
  return {
    card_type: normalizeAnalyticsCardType(card.cardTypeDescription || card.cardType),
    has_subscription: Boolean(
      card.subscriptionStartDateTime && !card.subscriptionStartDateTime.startsWith('0001'),
    ),
    low_balance: Number.isFinite(balance) ? balance < LOW_BALANCE_THRESHOLD : undefined,
  }
}

function CardDetails({ card }: { card: CardInfoData }) {
  const hasSub =
    card.subscriptionStartDateTime && !card.subscriptionStartDateTime.startsWith('0001')

  return (
    <div className="space-y-3 mt-6">
      {hasSub && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-transit-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-transit-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Abonelik</p>
              <p className="text-sm text-gray-500">{card.cardTypeDescription || card.cardType}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Bitiş</p>
              <p className="font-medium text-gray-900">
                {formatDate(card.subscriptionEndDateTime)}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Son İşlem</p>
            <p className="text-sm text-gray-500">{formatDateTime(card.lastTransactionDate)}</p>
          </div>
        </div>
      </Card>

      <Button
        className="w-full h-12 bg-transit-primary hover:bg-transit-primary/90"
        onClick={() =>
          openExternalUrl(
            `https://denizlikart.denizli.bel.tr/Default.aspx?mifareid=${card.mifareId}`,
          )
        }
      >
        <Plus className="w-5 h-5 mr-2" />
        Bakiye Yükle
        <ExternalLink className="w-4 h-4 ml-2" />
      </Button>
    </div>
  )
}

/** mifareId → bakiye metni (yükleniyorsa null) */
function useSavedCardsBalances(
  savedCards: { mifareId: string }[],
  enabled: boolean,
): Record<string, string | null> {
  const [balances, setBalances] = useState<Record<string, string | null>>({})
  const idsKey = enabled
    ? savedCards
        .map((c) => c.mifareId)
        .sort()
        .join(',')
    : ''

  useEffect(() => {
    if (!enabled || savedCards.length === 0) {
      setBalances({})
      return
    }
    const ids = savedCards.map((c) => c.mifareId)
    setBalances((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        if (!(id in next)) next[id] = null
      }
      return next
    })
    for (const saved of savedCards) {
      const mifareId = saved.mifareId
      apiGet<CardInfoResponse>(
        `/UlasimBackend/api/Calc/GetCardInfo?mifareId=${encodeURIComponent(mifareId)}`,
      )
        .then((res) => {
          if (res.isSuccess && Array.isArray(res.value) && res.value.length > 0) {
            const b = res.value[0].currentBalance ?? '0'
            setBalances((prev) => (prev[mifareId] === null ? { ...prev, [mifareId]: b } : prev))
          } else {
            setBalances((prev) => (prev[mifareId] === null ? { ...prev, [mifareId]: '—' } : prev))
          }
        })
        .catch(() => {
          setBalances((prev) => (prev[mifareId] === null ? { ...prev, [mifareId]: '—' } : prev))
        })
    }
  }, [enabled, idsKey])

  return balances
}

function KartContent() {
  const { cards: savedCards, isSaved, addCard, removeCard, markCardUsed } = useSavedCards()
  const [query, setQuery] = useState('')
  const [cardInfo, setCardInfo] = useState<CardInfoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nfcSupported] = useState(() => isNfcCardScanSupported())
  const [nfcScanning, setNfcScanning] = useState(false)
  const [nfcMessage, setNfcMessage] = useState<string | null>(null)
  const nfcAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const showSavedList = savedCards.length > 0 && !searched
  const balances = useSavedCardsBalances(savedCards, showSavedList)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      nfcAbortRef.current?.abort()
    }
  }, [])

  const handleSearch = async (searchQuery?: string) => {
    const q = normalizeCardQuery(searchQuery || query)
    if (q.length < 8) return
    triggerHaptic(ImpactStyle.Medium)
    setLoading(true)
    setSearched(true)
    setError(null)
    setCardInfo(null)
    try {
      const res = await apiGet<CardInfoResponse>(
        `/UlasimBackend/api/Calc/GetCardInfo?mifareId=${encodeURIComponent(q)}`,
      )
      if (res.isSuccess && Array.isArray(res.value) && res.value.length > 0) {
        setCardInfo(res.value[0])
        trackAnalyticsEvent('card_lookup', {
          success: true,
          ...buildCardAnalyticsPayload(res.value[0]),
        })
      } else {
        setError(getErrorMessage(res.error))
        trackAnalyticsEvent('card_lookup', { success: false })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kart sorgulanamadı')
      trackAnalyticsEvent('card_lookup', { success: false })
    } finally {
      setLoading(false)
    }
  }

  const handleNfcScan = async () => {
    if (nfcScanning || loading) return
    const controller = new AbortController()
    nfcAbortRef.current = controller
    setNfcScanning(true)
    setNfcMessage('Kartınızı telefonun arkasına yaklaştırın.')
    try {
      const uid = await scanCardUidOnce({ signal: controller.signal })
      if (!mountedRef.current) return
      setQuery(normalizeCardQuery(uid))
      setNfcMessage(null)
      trackAnalyticsEvent('card_nfc_scan', { success: true })
      await handleSearch(uid)
    } catch (e) {
      if (!mountedRef.current) return
      const reason = e instanceof NfcScanError ? e.reason : 'unknown'
      setNfcMessage(getNfcFailureMessage(reason))
      trackAnalyticsEvent('card_nfc_scan', { success: false, reason })
    } finally {
      if (nfcAbortRef.current === controller) nfcAbortRef.current = null
      if (mountedRef.current) setNfcScanning(false)
    }
  }

  const handleSaveCard = () => {
    if (!cardInfo || isSaved(cardInfo.mifareId)) return
    triggerHaptic(ImpactStyle.Light)
    addCard({
      queryId: normalizeCardQuery(query),
      mifareId: cardInfo.mifareId,
      label: `${cardInfo.name || ''} ${cardInfo.surname || ''}`.trim() || 'Kart',
      cardType: cardInfo.cardTypeDescription || cardInfo.cardType || '',
      lastUsedAt: new Date().toISOString(),
    })
    trackAnalyticsEvent('card_save', buildCardAnalyticsPayload(cardInfo))
  }

  const handleQuickQuery = (saved: { queryId: string; mifareId: string }) => {
    markCardUsed(saved.mifareId)
    setQuery(saved.queryId)
    handleSearch(saved.queryId)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Denizli Kart</h1>

      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="TCKN veya Kart No"
            className="h-12 flex-1"
            onKeyDown={(e) =>
              e.key === 'Enter' && normalizeCardQuery(query).length >= 8 && handleSearch()
            }
          />
          <Button
            onClick={() => handleSearch()}
            disabled={normalizeCardQuery(query).length < 8 || loading}
            className="h-12 px-6 bg-transit-primary hover:bg-transit-primary/90"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </Button>
        </div>
        {nfcSupported && (
          <Button
            type="button"
            variant="outline"
            onClick={handleNfcScan}
            disabled={nfcScanning || loading}
            className="w-full mt-3"
          >
            NFC ile Tara
          </Button>
        )}
        {nfcMessage && (
          <p className="text-sm text-gray-500 mt-3" role="status">
            {nfcMessage}
          </p>
        )}
      </Card>

      {savedCards.length > 0 && !searched && (
        <div className="mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">Kayıtlı Kartlarım</h2>
          <div className="space-y-2">
            {savedCards.map((saved) => (
              <Card key={saved.mifareId} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickQuery(saved)}
                    className="flex flex-1 min-w-0 items-center gap-3 rounded-md py-1 -my-1 -mx-1 px-1 text-left hover:bg-gray-100 hover:text-transit-primary transition-colors cursor-pointer"
                  >
                    <CreditCard className="w-5 h-5 shrink-0 text-transit-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">{displayCardId(saved.mifareId)}</span>
                      {saved.label && (
                        <p className="text-xs text-gray-500 truncate">{saved.label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          balances[saved.mifareId] &&
                          Number.parseFloat(balances[saved.mifareId]!.replace(',', '.')) <
                            LOW_BALANCE_THRESHOLD
                            ? 'text-red-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {balances[saved.mifareId] === undefined || balances[saved.mifareId] === null
                          ? '…'
                          : `${balances[saved.mifareId]} TL`}
                      </span>
                      {balances[saved.mifareId] &&
                        Number.parseFloat(balances[saved.mifareId]!.replace(',', '.')) <
                          LOW_BALANCE_THRESHOLD && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        )}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      trackAnalyticsEvent('card_remove', {
                        card_type: normalizeAnalyticsCardType(saved.cardType),
                      })
                      removeCard(saved.mifareId)
                    }}
                    className="shrink-0 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {searched && loading && (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full max-w-sm mx-auto rounded-xl" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {searched &&
        !loading &&
        (cardInfo ? (
          <div>
            <TransitCardVisual card={cardInfo} />
            <CardDetails card={cardInfo} />

            {isSaved(cardInfo.mifareId) ? (
              <Button
                variant="outline"
                className="w-full mt-3 border-green-200 text-green-600 pointer-events-none"
                disabled
              >
                <Check className="w-4 h-4 mr-2" />
                Kaydedildi
              </Button>
            ) : (
              <Button variant="outline" className="w-full mt-3" onClick={handleSaveCard}>
                <Plus className="w-4 h-4 mr-2" />
                Kartı Kaydet
              </Button>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Kart bulunamadı</p>
            {error && <p className="text-sm text-gray-400 mt-1">{error}</p>}
          </Card>
        ))}
    </div>
  )
}

export default function KartPage() {
  useSEO({
    title: 'Denizli Kart Bakiye Sorgulama',
    description:
      'Denizli Kart bakiyenizi sorgulayın, kayıtlı kartlarınızı yönetin ve bakiye yükleme detaylarını öğrenin.',
  })

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DesktopNav />
      <main className="flex-1 pb-20 md:pb-8">
        <KartContent />
      </main>
      <MobileNav />
    </div>
  )
}
