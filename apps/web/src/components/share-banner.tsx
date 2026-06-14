'use client'

import { useState, useEffect } from 'react'
import { Card } from '@ulasim20/ui-primitives'
import { Button } from '@ulasim20/ui-primitives'
import { Share2, X } from 'lucide-react'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { shareContent } from '@/lib/capacitor'

export function ShareBanner() {
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    const minimized = localStorage.getItem('share-banner-minimized')
    if (minimized === 'true') setIsMinimized(true)
  }, [])

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.origin : ''
    const result = await shareContent({
      title: 'Denizli Ulaşım',
      text: 'Denizli toplu taşıma uygulaması - Otobüs durakları, hatlar, canlı takip ve daha fazlası!',
      url,
      dialogTitle: 'Uygulamayı paylaş',
    })

    trackAnalyticsEvent('share_app', {
      method: result.method,
      success: result.shared,
    })

    if (result.shared && result.method === 'clipboard') {
      alert('Link panoya kopyalandı!')
    } else if (!result.shared && result.method === 'unavailable') {
      alert('Paylaşım yapılamadı.')
    }
  }

  const toggleMinimize = () => {
    const newState = !isMinimized
    setIsMinimized(newState)
    localStorage.setItem('share-banner-minimized', String(newState))
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-[1000] md:bottom-0 px-2 pb-2 pointer-events-none">
      {isMinimized ? (
        // Minimized state - small button hugging navbar
        <div className="flex justify-end pointer-events-auto">
          <Button
            onClick={toggleMinimize}
            size="sm"
            className="bg-transit-primary hover:bg-transit-primary/90 shadow-lg rounded-full px-4"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Paylaş
          </Button>
        </div>
      ) : (
        // Expanded state
        <Card className="mx-auto max-w-2xl p-3 bg-white border-transit-primary/20 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">Uygulamayı Paylaş</p>
              <p className="text-xs text-gray-500">
                Arkadaşlarınla paylaş, daha çok kişiye ulaşalım!
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                onClick={handleShare}
                size="sm"
                className="bg-transit-primary hover:bg-transit-primary/90"
              >
                <Share2 className="w-4 h-4 mr-1" />
                Paylaş
              </Button>
              <Button
                onClick={toggleMinimize}
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-400 hover:text-gray-600"
                title="Küçült"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
