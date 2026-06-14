# Akıllı Ulaşım Portalı - Copilot Instructions

Bu proje şehrin mevcut akıllı ulaşım sistemi için alternatif bir web arayüzü geliştirmektedir.

## Proje Teknolojileri

- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Router (routing)
- ESLint + Prettier (code quality)

## Kod Standartları

- TypeScript strict mode kullan
- Functional components ve hooks tercih et
- TailwindCSS utility classes kullan
- Türkçe UI metinleri
- Responsive tasarım (mobile-first)

## Dosya Yapısı

- `src/components/` - Yeniden kullanılabilir bileşenler
- `src/pages/` - Sayfa bileşenleri
- `src/styles/` - Global stiller
- `api/` - Mock API endpoint'leri (geliştirilecek)

## Gelecek Özellikler

- Mock API ile gerçek zamanlı veri simülasyonu
- Harita entegrasyonu (Leaflet/Mapbox)
- WebSocket veya SSE ile canlı güncelleme
- Favori duraklar
- Push bildirimleri

## Geliştirme Notları

- Kod yazarken Türkçe yorum ve mesajlar kullan
- Component props için TypeScript interface tanımla
- Accessibility (a11y) standartlarına dikkat et
- Performans için React.memo ve useMemo kullan
