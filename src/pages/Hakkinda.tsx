import { DesktopNav, MobileNav } from '@/components/navigation'
import { Card } from '@/components/ui/card'
import { useSEO } from '@/hooks/use-seo'
import { TransitProvider } from '@/lib/transit-context'
import { Gift, Heart, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HakkindaPage() {
  useSEO({
    title: 'Hakkında',
    description:
      'Denizli Akıllı Ulaşım Portalı projesi, arkasındaki teknoloji ve açık kaynaklı yapısı hakkında bilgi edinin.',
  })

  return (
    <TransitProvider>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1 pb-20 md:pb-4">
          <div className="max-w-2xl mx-auto p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Hakkında</h1>

            <Card className="p-6 mb-4">
              <div className="flex items-center gap-2 text-transit-primary mb-4">
                <Heart className="w-5 h-5 fill-current" />
                <h2 className="font-semibold">Denizli Ulaşım</h2>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Bu uygulama, Denizli halkının toplu taşıma deneyimini kolaylaştırmak amacıyla bir
                lise öğrencisi tarafından sevgi ile geliştirilmiştir.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Otobüs durakları, hatlar, anlık varış bilgileri, rota planlama ve Denizli Kart
                bakiye sorgulama gibi özellikler sunulmaktadır.
              </p>
              <p className="text-sm text-gray-500">
                Bu uygulama Denizli Büyükşehir Belediyesi ile resmi bir bağlantısı olmayan bağımsız
                bir projedir.
              </p>
            </Card>

            <Card className="p-6 mb-4">
              <div className="flex items-center gap-2 text-transit-primary mb-4">
                <Gift className="w-5 h-5" />
                <h2 className="font-semibold">Destek Ol</h2>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Uygulama günlük hayatınızda işinize yarıyorsa, geliştirmeye devam edebilmem için
                küçük bir destek bile çok değerli.
              </p>
              <Link
                to="/destek-ol"
                className="inline-flex items-center gap-2 text-transit-primary font-medium hover:underline"
              >
                Destek Ol
              </Link>
            </Card>

            <Card className="p-6 mb-4">
              <h2 className="font-semibold text-gray-900 mb-4">Kullanılan Teknolojiler</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  'React',
                  'TypeScript',
                  'Tailwind CSS',
                  'Leaflet',
                  'Vite',
                  'McRAPTOR',
                  'PostGIS',
                  'Docker',
                ].map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold text-gray-900 mb-4">İletişim</h2>
              <div className="space-y-3">
                {/* <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-gray-600 hover:text-transit-primary transition-colors"
                >
                  <Github className="w-5 h-5" />
                  <span>GitHub</span>
                </a> */}
                <a
                  href="mailto:ismailsrky@disroot.org"
                  className="flex items-center gap-3 text-gray-600 hover:text-transit-primary transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  <span>ismailsrky@disroot.org</span>
                </a>
              </div>
            </Card>
          </div>
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
