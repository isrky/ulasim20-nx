import { type PharmacyData, type PharmacyResponse, getPharmacies } from '@/api/denizli'
import { DesktopNav, MobileNav } from '@/components/navigation'
import { Card } from '@ulasim20/ui-primitives'
import { useSEO } from '@/hooks/use-seo'
import { openExternalUrl } from '@ulasim20/data-access-capacitor'
import { TransitProvider } from '@/lib/transit-context'
import { AlertCircle, MapPin, Phone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function PharmacySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-4 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
        </Card>
      ))}
    </div>
  )
}

function PharmacyCard({ pharmacy }: { pharmacy: PharmacyData }) {
  const mapsQuery = [pharmacy.name, pharmacy.address, 'Denizli'].filter(Boolean).join(' ')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`

  return (
    <Card
      className="p-4 cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-transit-primary focus-visible:ring-offset-2 focus:outline-none"
      role="button"
      tabIndex={0}
      onClick={() => openExternalUrl(mapsUrl)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openExternalUrl(mapsUrl)
        }
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{pharmacy.name}</h3>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium shrink-0 ml-2">
          Nöbetçi
        </span>
      </div>

      {pharmacy.address && (
        <p className="text-sm text-gray-500 mb-2 flex items-start gap-1.5">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          {pharmacy.address}
        </p>
      )}

      <a
        href={`tel:${pharmacy.phone.replace(/\s/g, '')}`}
        className="inline-flex items-center gap-1.5 text-sm text-transit-primary font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        <Phone className="w-4 h-4" />
        {pharmacy.phone}
      </a>
    </Card>
  )
}

function PharmaciesContent() {
  const [data, setData] = useState<PharmacyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await getPharmacies()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Eczane verileri yüklenemedi')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    if (!data?.pharmacies.length) return new Map<string, PharmacyData[]>()
    const map = new Map<string, PharmacyData[]>()
    for (const p of data.pharmacies) {
      const list = map.get(p.district) ?? []
      list.push(p)
      map.set(p.district, list)
    }
    return map
  }, [data])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Nöbetçi Eczaneler</h1>
        <p className="text-sm text-gray-400 mb-6">Yükleniyor...</p>
        <PharmacySkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Nöbetçi Eczaneler</h1>
        <Card className="p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-transit-primary font-medium hover:underline"
          >
            Tekrar Dene
          </button>
        </Card>
      </div>
    )
  }

  if (!data || data.pharmacies.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Nöbetçi Eczaneler</h1>
        <Card className="p-6 text-center">
          <p className="text-gray-500">Nöbetçi eczane bilgisi bulunamadı.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20 md:pb-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Nöbetçi Eczaneler</h1>
      <p className="text-sm text-gray-500 mb-6">{data.date}</p>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium text-gray-600">
          {data.pharmacies.length} eczane nöbetçi
        </span>
      </div>

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([district, pharmacyList]) => (
          <section key={district}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-200 pb-2">
              {district}
            </h2>
            <div className="space-y-3">
              {pharmacyList.map((pharmacy, i) => (
                <PharmacyCard key={`${district}-${i}`} pharmacy={pharmacy} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default function PharmaciesPage() {
  useSEO({
    title: 'Nöbetçi Eczaneler',
    description:
      'Denizli genelinde bugün ve bu gece nöbetçi olan eczanelerin güncel listesi, adres ve telefon bilgileri.',
  })

  return (
    <TransitProvider>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1">
          <PharmaciesContent />
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
