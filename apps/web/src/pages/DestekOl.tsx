import { DesktopNav, MobileNav } from '@/components/navigation'
import { Card } from '@/components/ui/card'
import { useSEO } from '@/hooks/use-seo'
import { TransitProvider } from '@/lib/transit-context'
import { ExternalLink, Heart, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

const KREOSUS_SCRIPT_ID = 'kreosus-iframe-api'
const KREOSUS_SCRIPT_SRC = 'https://kreosus.com/public/kreosus/iframe/js/iframe-api.js'
const KREOSUS_FALLBACK_URL = 'https://kreosus.com/isrky'

export default function DestekOlPage() {
  useSEO({
    title: 'Destek Ol',
    description:
      'Denizli Akıllı Ulaşım Portalı projesine katkıda bulunarak veya bağış yaparak açık kaynaklı yazılım topluluğunu destekleyin.',
  })

  const [scriptFailed, setScriptFailed] = useState(false)

  useEffect(() => {
    if (document.getElementById(KREOSUS_SCRIPT_ID)) {
      return
    }

    const script = document.createElement('script')
    script.id = KREOSUS_SCRIPT_ID
    script.src = KREOSUS_SCRIPT_SRC
    script.async = true
    script.onerror = () => setScriptFailed(true)
    document.body.appendChild(script)
  }, [])

  return (
    <TransitProvider>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1 pb-20 md:pb-4">
          <div className="max-w-2xl mx-auto p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Destek Ol</h1>

            <Card className="p-6 mb-4">
              <div className="flex items-center gap-2 text-transit-primary mb-4">
                <Heart className="w-5 h-5 fill-current" />
                <h2 className="font-semibold">Bu projeye destek olun</h2>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Denizli Ulaşım, Denizli’de toplu taşımayı daha kolay takip edebilmek için sevgiyle
                geliştirilen bağımsız bir projedir.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Eğer uygulama günlük hayatınızda işinize yarıyorsa, küçük bir destek bile
                geliştirmeye devam etmem için çok değerli.
              </p>
            </Card>

            <Card className="p-6 mb-4">
              <h2 className="font-semibold text-gray-900 mb-2">Bağış Yap</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Aşağıdaki alan üzerinden Kreosus ile güvenli şekilde destek olabilirsiniz.
              </p>
              <div
                id="kreosus"
                data-id="5647"
                data-start-page="0"
                data-bg-color="ffffff"
                data-iframe-api="true"
              />
              <p className="text-sm text-gray-500 mt-4">
                {scriptFailed ? 'Bağış alanı yüklenemedi. ' : 'Bağış alanı yüklenemediyse '}
                Kreosus sayfasını doğrudan açabilirsiniz:{' '}
                <a
                  href={KREOSUS_FALLBACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-transit-primary hover:underline"
                >
                  kreosus.com/isrky
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 text-transit-primary mb-4">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-semibold text-gray-900">Güvenlik ve gizlilik</h2>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">
                Bağış işlemleri Kreosus üzerinden gerçekleşir. Denizli Ulaşım uygulaması kart
                bilgilerinizi, ödeme bilgilerinizi veya bağış işleminize ait ödeme verilerini
                toplamaz, işlemez ya da saklamaz.
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Ödeme adımlarında Kreosus’un kendi güvenlik ve gizlilik koşulları geçerlidir.
              </p>
            </Card>
          </div>
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
