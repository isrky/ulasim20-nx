export type Coordinates = { lat: number; lon: number }

export type Route = {
  id: string
  shortName: string
  longName: string
  type: 'bus' | 'tram' | 'minibus'
  color?: string
}

export type Stop = {
  id: string
  name: string
  code?: string
  location: Coordinates
  routes: string[]
}

export type Vehicle = {
  id: string
  routeId: string
  position: Coordinates
  bearing?: number
  updatedAt: string
}

export type Trip = {
  id: string
  routeId: string
  headsign: string
  stops: string[]
  startTime: string
  endTime: string
}
