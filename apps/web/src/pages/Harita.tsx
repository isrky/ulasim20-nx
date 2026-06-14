import { DesktopNav, MobileNav } from '@/components/navigation'
import { useSEO } from '@/hooks/use-seo'
import { Suspense, lazy } from 'react'

const TransitMap = lazy(() => import('@/components/transit-map'))

export default function MapPage() {
  useSEO({
    title: 'Canlı Harita',
    description: 'Denizli otobüs hatlarının canlı güzergah ve konum haritası.',
  })

  return (
    <div className="h-[calc(100dvh-28px)] flex flex-col bg-background">
      <DesktopNav />
      <main className="flex-1 relative pb-16 md:pb-0 overflow-hidden">
        <Suspense
          fallback={
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="text-gray-500">Harita yükleniyor...</div>
            </div>
          }
        >
          <TransitMap />
        </Suspense>
      </main>
      <MobileNav />
    </div>
  )
}
