import { createContext, useContext, type ReactNode } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

const MapInstanceContext = createContext<MapLibreMap | null>(null)

export function MapInstanceProvider({
  value,
  children,
}: {
  value: MapLibreMap | null
  children: ReactNode
}) {
  return <MapInstanceContext.Provider value={value}>{children}</MapInstanceContext.Provider>
}

export function useMapInstance(): MapLibreMap | null {
  return useContext(MapInstanceContext)
}
