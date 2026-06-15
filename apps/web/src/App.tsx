import { Route, Routes } from 'react-router-dom'
import { AnalyticsRouteTracker } from './components/analytics-route-tracker'
import { TopBanner } from '@ulasim20/ui-page-shell'
import { ShareBanner } from './components/share-banner'
import { useBalanceAutoCheck } from '@ulasim20/feature-card'
import Bulunamadi from './pages/Bulunamadi'
import DestekOl from './pages/DestekOl'
import DolumNoktalari from './pages/DolumNoktalari'
import Eczaneler from './pages/Eczaneler'
import Favoriler from './pages/Favoriler'
import GeriBildirim from './pages/GeriBildirim'
import Hakkinda from './pages/Hakkinda'
import Harita from './pages/Harita'
import Home from './pages/Home'
import Istatistikler from './pages/Istatistikler'
import Kart from './pages/Kart'
import { DurakDetayPage, DuraklarPage, HatDetayPage, HatlarPage, NasilGiderimPage } from '@ulasim20/feature-routes'

function App() {
  useBalanceAutoCheck()

  return (
    <>
      <AnalyticsRouteTracker />
      <TopBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/harita" element={<Harita />} />
        <Route path="/duraklar" element={<DuraklarPage />} />
        <Route path="/duraklar/:id" element={<DurakDetayPage />} />
        <Route path="/hatlar" element={<HatlarPage />} />
        <Route path="/hatlar/:id" element={<HatDetayPage />} />
        <Route path="/nasil-giderim" element={<NasilGiderimPage />} />
        <Route path="/kart" element={<Kart />} />
        <Route path="/favoriler" element={<Favoriler />} />
        <Route path="/eczaneler" element={<Eczaneler />} />
        <Route path="/dolum-noktalari" element={<DolumNoktalari />} />
        <Route path="/geri-bildirim" element={<GeriBildirim />} />
        <Route path="/istatistikler" element={<Istatistikler />} />
        <Route path="/hakkinda" element={<Hakkinda />} />
        <Route path="/destek-ol" element={<DestekOl />} />
        <Route path="*" element={<Bulunamadi />} />
      </Routes>
      <ShareBanner />
    </>
  )
}

export default App
