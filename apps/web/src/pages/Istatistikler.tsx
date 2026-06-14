import { DesktopNav, MobileNav } from '@/components/navigation'
import { Card } from '@ulasim20/ui-primitives'
import { useSEO } from '@/hooks/use-seo'
import { TransitProvider } from '@/lib/transit-context'
import { Calendar, Clock, Map, MessageSquare, Search, Star, TrendingUp, Users } from 'lucide-react'

const stats = {
  monthlyUsers: 12847,
  dailyUsers: 428,
  totalFeedback: 156,
  monthlyFeedback: 23,
  routeSearches: 8432,
  mapViews: 45621,
  favoriteStops: 3241,
  cardQueries: 2156,
}

const monthlyGrowth = [
  { month: 'Ekim', users: 8200 },
  { month: 'Kasım', users: 9800 },
  { month: 'Aralık', users: 10500 },
  { month: 'Ocak', users: 11200 },
  { month: 'Şubat', users: 11900 },
  { month: 'Mart', users: 12847 },
]

const topFeatures = [
  { name: 'Harita', usage: 45621, icon: Map },
  { name: 'Rota Arama', usage: 8432, icon: Search },
  { name: 'Favori Duraklar', usage: 3241, icon: Star },
  { name: 'Kart Sorgulama', usage: 2156, icon: Clock },
]

function StatsContent() {
  const maxMonthlyUsers = Math.max(...monthlyGrowth.map((m) => m.users))

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-xl font-bold text-gray-900 mb-4">İstatistikler</h1>

      <p className="text-sm text-gray-500 mb-6">
        Bu veriler uygulamanın kullanım istatistiklerini göstermektedir.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-transit-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-transit-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.monthlyUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Bu ay kullanıcı</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.dailyUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Günlük kullanıcı</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.monthlyFeedback}</p>
              <p className="text-xs text-gray-500">Bu ay geri bildirim</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">+8%</p>
              <p className="text-xs text-gray-500">Aylık büyüme</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Aylık Kullanıcı Sayısı</h2>
        <div className="flex items-end gap-2 h-32">
          {monthlyGrowth.map((month) => (
            <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-transit-primary/80 rounded-t"
                style={{ height: `${(month.users / maxMonthlyUsers) * 100}%` }}
              />
              <span className="text-[10px] text-gray-500">{month.month.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">En Çok Kullanılan Özellikler</h2>
        <div className="space-y-3">
          {topFeatures.map((feature, idx) => {
            const maxUsage = topFeatures[0].usage
            const percentage = (feature.usage / maxUsage) * 100
            return (
              <div key={feature.name} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-4">{idx + 1}</span>
                <feature.icon className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{feature.name}</span>
                    <span className="text-xs text-gray-500">{feature.usage.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-transit-primary rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Diğer İstatistikler</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">Toplam geri bildirim</span>
            <span className="text-sm font-medium text-gray-900">{stats.totalFeedback}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">Rota aramaları</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.routeSearches.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">Harita görüntüleme</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.mapViews.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Kart sorgulama</span>
            <span className="text-sm font-medium text-gray-900">
              {stats.cardQueries.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function StatsPage() {
  useSEO({
    title: 'Portal İstatistikleri',
    description:
      'Denizli genelindeki otobüs, durak ve portal kullanımı ile ilgili veri ve istatistik analizi.',
  })

  return (
    <TransitProvider>
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <DesktopNav />
        <main className="flex-1">
          <StatsContent />
        </main>
        <MobileNav />
      </div>
    </TransitProvider>
  )
}
