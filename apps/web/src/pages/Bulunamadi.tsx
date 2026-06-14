import { DesktopNav, MobileNav } from '@/components/navigation'
import { Card } from '@ulasim20/ui-primitives'
import { useSEO } from '@/hooks/use-seo'
import { TransitProvider } from '@/lib/transit-context'
import { Link } from 'react-router-dom'

export default function BulunamadiPage() {
  useSEO({
    title: 'Sayfa Bulunamadı',
    description: 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.',
  })

  return (
    <TransitProvider>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1 flex items-center justify-center p-4 pb-20 md:pb-4">
          <Card className="max-w-md w-full p-8 text-center bg-white shadow-sm border border-gray-100 rounded-2xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">404 - Sayfa Bulunamadı</h1>

            <p className="text-gray-600 mb-8 leading-relaxed">
              Aradığınız otobüs hattı, durak veya sayfa mevcut değil ya da taşınmış olabilir.
            </p>

            <Link
              to="/"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-transit-primary text-white font-medium rounded-lg hover:bg-transit-primary/90 transition-colors"
            >
              Ana Sayfaya Dön
            </Link>
          </Card>
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
