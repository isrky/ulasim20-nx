import { DesktopNav, MobileNav } from '@ulasim20/ui-page-shell'
import { TransitMap } from '@ulasim20/feature-routes'
import { useSEO } from '@ulasim20/util-hooks'

export default function MapPage() {
  useSEO({
    title: 'Canlı Harita',
    description: 'Denizli otobüs hatlarının canlı güzergah ve konum haritası.',
  })

  return (
    <div className="h-[calc(100dvh-28px)] flex flex-col bg-background">
      <DesktopNav />
      <main className="flex-1 relative pb-16 md:pb-0 overflow-hidden">
        <TransitMap />
      </main>
      <MobileNav />
    </div>
  )
}
