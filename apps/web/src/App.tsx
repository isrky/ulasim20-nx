import { Route, Routes } from 'react-router-dom'
import { AnalyticsRouteTracker } from './components/analytics-route-tracker'
import { TopBanner } from './components/navigation'
import { ShareBanner } from './components/share-banner'
import Bulunamadi from './pages/Bulunamadi'
import DestekOl from './pages/DestekOl'
import DolumNoktalari from './pages/DolumNoktalari'
import DurakDetay from './pages/DurakDetay'
import Duraklar from './pages/Duraklar'
import Eczaneler from './pages/Eczaneler'
import Favoriler from './pages/Favoriler'
import GeriBildirim from './pages/GeriBildirim'
import Hakkinda from './pages/Hakkinda'
import Harita from './pages/Harita'
import HatDetay from './pages/HatDetay'
import Hatlar from './pages/Hatlar'
import Home from './pages/Home'
import Istatistikler from './pages/Istatistikler'
import Kart from './pages/Kart'
import NasilGiderim from './pages/NasilGiderim'

import { useBalanceAutoCheck } from './hooks/use-balance-auto-check'

function App() {
  useBalanceAutoCheck()

  return (
    <>
      <AnalyticsRouteTracker />
      <TopBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/harita" element={<Harita />} />
        <Route path="/duraklar" element={<Duraklar />} />
        <Route path="/duraklar/:id" element={<DurakDetay />} />
        <Route path="/hatlar" element={<Hatlar />} />
        <Route path="/hatlar/:id" element={<HatDetay />} />
        <Route path="/nasil-giderim" element={<NasilGiderim />} />
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
