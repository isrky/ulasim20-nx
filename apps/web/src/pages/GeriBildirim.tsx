import { DesktopNav, MobileNav } from '@/components/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSEO } from '@/hooks/use-seo'
import { trackAnalyticsEvent } from '@/lib/analytics'
import {
  PB_ID_REGEX,
  STORAGE_KEY,
  THROTTLE_KEY,
  feedbackSchema,
  readStoredIds,
  throttleRemainingMs,
} from '@/lib/feedback-validation'
import { type FeedbackRecord, pb } from '@/lib/pocketbase'
import { TransitProvider } from '@/lib/transit-context'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  History,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react'
import { useEffect, useState } from 'react'

type FeedbackType = 'oneri' | 'hata' | 'sikayet' | 'diger'

export default function FeedbackPage() {
  useSEO({
    title: 'Geri Bildirim',
    description:
      'Akıllı Ulaşım Portalı ile ilgili her türlü soru, öneri, hata bildirimi veya görüşünüzü bize iletin.',
  })

  const [type, setType] = useState<FeedbackType>('oneri')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    fetchFeedbackHistory()
  }, [])

  const fetchFeedbackHistory = async () => {
    const storedIds = readStoredIds(localStorage)
    if (storedIds.length === 0) {
      setLoadingHistory(false)
      return
    }

    try {
      // Fetch records individually to respect the 'View' rule (which allows getOne by ID)
      // but might restrict listing all.
      const records = await Promise.all(
        storedIds.map((id) =>
          pb
            .collection('feedbacks')
            .getOne(id)
            .catch(() => null),
        ),
      )

      const validRecords = records.filter((r): r is FeedbackRecord => r !== null)
      setMyFeedbacks(
        validRecords.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()),
      )
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error fetching feedback history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side throttle to deter rapid spam (defense-in-depth; real limit on server)
    const lastSubmit = Number(localStorage.getItem(THROTTLE_KEY) || 0)
    const remaining = throttleRemainingMs(lastSubmit, Date.now())
    if (remaining > 0) {
      const wait = Math.ceil(remaining / 1000)
      setError(`Çok sık gönderim. Lütfen ${wait} saniye sonra tekrar deneyin.`)
      return
    }

    const parsed = feedbackSchema.safeParse({ type, name, email, message })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Geçersiz form verisi.')
      return
    }

    setSubmitting(true)
    try {
      // `status` must be "bekliyor" (enforced by PocketBase Create rule).
      // Never send `admin_replies` — the Create rule rejects it if set.
      const record = await pb.collection('feedbacks').create({
        ...parsed.data,
        status: 'bekliyor',
      })

      localStorage.setItem(THROTTLE_KEY, String(Date.now()))

      const storedIds = readStoredIds(localStorage)
      if (PB_ID_REGEX.test(record.id)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...storedIds, record.id]))
      }

      setSubmitted(true)
      fetchFeedbackHistory()
      trackAnalyticsEvent('feedback_submit', {
        type: parsed.data.type,
        success: true,
      })
    } catch (err) {
      setError('Geri bildirim gönderilemedi. Lütfen tekrar deneyin.')
      if (import.meta.env.DEV) console.error('PocketBase error:', err)
      trackAnalyticsEvent('feedback_submit', {
        type,
        success: false,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusInfo = (status: FeedbackRecord['status']) => {
    switch (status) {
      case 'bekliyor':
        return { label: 'Bekliyor', color: 'bg-gray-100 text-gray-600 border-gray-200' }
      case 'inceleniyor':
        return { label: 'İnceleniyor', color: 'bg-blue-50 text-blue-600 border-blue-200' }
      case 'cozuldu':
        return { label: 'Çözüldü', color: 'bg-green-50 text-green-600 border-green-200' }
      case 'iptal':
        return { label: 'İptal Edildi', color: 'bg-red-50 text-red-600 border-red-200' }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' }
    }
  }

  const feedbackTypes = [
    { id: 'oneri', label: 'Öneri' },
    { id: 'hata', label: 'Hata Bildirimi' },
    { id: 'sikayet', label: 'Şikayet' },
    { id: 'diger', label: 'Diğer' },
  ]

  return (
    <TransitProvider>
      <div className="min-h-[calc(100dvh-28px)] flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1 pb-20 md:pb-6">
          <div className="max-w-2xl mx-auto p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Geri Bildirim</h1>

            <Card className="p-4 mb-6 bg-amber-50 border-amber-200">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Önemli Bilgilendirme</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Bu uygulama Denizli Büyükşehir Belediyesi ile resmi bir bağlantısı olmayan,
                    bağımsız bir projedir. Burada ilettiğiniz geri bildirimler yalnızca uygulama
                    geliştiricisine ulaşacaktır. Belediye hizmetleriyle ilgili resmi şikayet ve
                    önerileriniz için lütfen
                    <a
                      href="https://www.denizli.bel.tr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium ml-1"
                    >
                      denizli.bel.tr
                    </a>{' '}
                    adresini ziyaret edin.
                  </p>
                </div>
              </div>
            </Card>

            {submitted ? (
              <Card className="p-8 text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-transit-primary/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-transit-primary" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Teşekkürler!</h2>
                <p className="text-gray-600 mb-6">
                  Geri bildiriminiz başarıyla alındı. Aşağıdaki listeden durumunu takip
                  edebilirsiniz.
                </p>
                <Button
                  onClick={() => {
                    setSubmitted(false)
                    setName('')
                    setEmail('')
                    setMessage('')
                    setType('oneri')
                  }}
                  variant="outline"
                >
                  Yeni Geri Bildirim Gönder
                </Button>
              </Card>
            ) : (
              <Card className="p-4 mb-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Geri Bildirim Türü
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {feedbackTypes.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setType(item.id as FeedbackType)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            type === item.id
                              ? 'bg-transit-primary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      İsim (Opsiyonel)
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Adınız"
                      maxLength={100}
                      className="h-11"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      E-posta (Opsiyonel)
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@email.com"
                      maxLength={254}
                      className="h-11"
                    />
                    <p className="text-xs text-gray-500 mt-1">Size geri dönüş yapabilmemiz için</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Mesajınız
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Geri bildiriminizi buraya yazın (en az 10 karakter)..."
                      required
                      rows={5}
                      minLength={10}
                      maxLength={2000}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-transit-primary/20 focus:border-transit-primary"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {message.trim().length} / 2000
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={message.trim().length < 10 || submitting}
                    className="w-full h-11 bg-transit-primary hover:bg-transit-primary/90"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {submitting ? 'Gönderiliyor...' : 'Gönder'}
                  </Button>
                </form>
              </Card>
            )}

            {/* Ticket History Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Geçmiş Başvurularım</h2>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : myFeedbacks.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <p className="text-gray-500 text-sm">Henüz bir başvurunuz bulunmuyor.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {myFeedbacks.map((fb) => {
                    const statusInfo = getStatusInfo(fb.status)
                    return (
                      <Card key={fb.id} className="overflow-hidden">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {feedbackTypes.find((t) => t.id === fb.type)?.label || fb.type}
                              </span>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                {format(new Date(fb.created), 'd MMMM yyyy HH:mm', { locale: tr })}
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`${statusInfo.color} font-medium border`}
                            >
                              {statusInfo.label}
                            </Badge>
                          </div>

                          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">
                            {fb.message}
                          </p>

                          {fb.admin_replies && fb.admin_replies.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                              <div className="flex items-center gap-2 text-xs font-semibold text-transit-primary">
                                <MessageSquare className="w-3.5 h-3.5" />
                                Admin Yanıtları
                              </div>
                              {fb.admin_replies.map((reply, idx) => (
                                <div
                                  key={idx}
                                  className="bg-transit-primary/5 rounded-lg p-3 text-sm text-transit-primary border border-transit-primary/10"
                                >
                                  {reply}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
