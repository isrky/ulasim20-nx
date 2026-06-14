// Favori durak veri yapısı
export interface FavoriteStation {
  stationId: number
  stationName: string
  addedAt: string // ISO date string
  clickCount?: number // Tıklama sayısı (opsiyonel - geriye dönük uyumluluk için)
}

// Favori hat veri yapısı
export interface FavoriteLine {
  lineCode: string
  lineName: string
  addedAt: string // ISO date string
  clickCount?: number // Tıklama sayısı (opsiyonel)
}
