import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Map, Navigation, Square, Bus, CreditCard, Star, Heart, MoreHorizontal, X, Pill, MapPinned, MessageSquare, Home } from 'lucide-react'
import { cn } from './cn'

export function TopBanner() {
  return (
    <Link
      to="/hakkinda"
      className="block bg-transit-primary text-white text-center py-1.5 text-xs font-medium hover:bg-transit-primary/90 transition-colors"
    >
      <span className="flex items-center justify-center gap-1">
        Bir lise öğrencisi tarafından Denizli için <Heart className="w-3 h-3 fill-current" /> ile geliştirildi
      </span>
    </Link>
  )
}

const mainNavItems = [
  { href: '/', label: 'Ana Sayfa', icon: Home },
  { href: '/harita', label: 'Harita', icon: Map },
  { href: '/duraklar', label: 'Duraklar', icon: Square },
  { href: '/hatlar', label: 'Hatlar', icon: Bus },
  { href: '/favoriler', label: 'Favoriler', icon: Star },
]

const moreNavItems = [
  { href: '/nasil-giderim', label: 'Nasıl Giderim', icon: Navigation },
  { href: '/kart', label: 'Denizli Kart', icon: CreditCard },
  { href: '/eczaneler', label: 'Nöbetçi Eczaneler', icon: Pill },
  { href: '/dolum-noktalari', label: 'Dolum Noktaları', icon: MapPinned },
  { href: '/geri-bildirim', label: 'Geri Bildirim', icon: MessageSquare },
  { href: '/destek-ol', label: 'Destek Ol', icon: Heart },
  // Menüde gizli; tekrar göstermek için üstteki lucide import'a BarChart3 ekleyin:
  // { href: '/istatistikler', label: 'İstatistikler', icon: BarChart3 },
]

export function DesktopNav() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreActive = moreNavItems.some(item => pathname === item.href || pathname.startsWith(item.href))

  return (
    <nav className="hidden md:flex items-center justify-center gap-1 bg-white border-b border-gray-200 px-6 h-16 sticky top-0 z-50">
      <div className="flex items-center gap-1">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-transit-primary/10 text-transit-primary'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
        <div className="relative">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isMoreActive || moreOpen
                ? 'bg-transit-primary/10 text-transit-primary'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
            Daha Fazla
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-50">
                {moreNavItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-transit-primary/10 text-transit-primary'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

const mobileMainItems = [
  { href: '/', label: 'Ana Sayfa', icon: Home },
  { href: '/duraklar', label: 'Duraklar', icon: Square },
  { href: '/hatlar', label: 'Hatlar', icon: Bus },
  { href: '/favoriler', label: 'Favoriler', icon: Star },
]

const mobileMoreItems = [
  { href: '/harita', label: 'Harita', icon: Map },
  ...moreNavItems,
]

export function MobileNav() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreActive = mobileMoreItems.some(item => pathname === item.href || pathname.startsWith(item.href))

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-[1002]" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-20 left-4 right-4 bg-white rounded-xl shadow-xl overflow-hidden z-[1003]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-medium text-gray-900">Daha Fazla</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {mobileMoreItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    isActive
                      ? 'bg-transit-primary/10 text-transit-primary'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-1 pb-safe z-[1001]">
        <div className="flex items-center justify-around h-16">
          {mobileMainItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg transition-colors min-w-[48px]',
                  isActive
                    ? 'text-transit-primary'
                    : 'text-gray-500'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[9px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg transition-colors min-w-[48px]',
              isMoreActive || moreOpen
                ? 'text-transit-primary'
                : 'text-gray-500'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-medium leading-none">Daha Fazla</span>
          </button>
        </div>
      </nav>
    </>
  )
}

export function BackHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 bg-white border-b border-gray-200 px-4 h-14 sticky top-0 z-40 md:hidden">
      <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
        <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
      <h1 className="font-semibold text-gray-900">{title}</h1>
    </header>
  )
}
