// Mock data for Denizli Transit App

export interface BusStop {
  id: string
  name: string
  lat: number
  lng: number
  lines: string[]
}

export interface BusLine {
  id: string
  code: string
  name: string
  color: string
  stops: string[]
  direction: 'forward' | 'backward'
}

export interface LiveBus {
  id: string
  lineId: string
  lat: number
  lng: number
  nextStop: string
  arrivalMinutes: number
}

export interface TransitCard {
  id: string
  cardNumber: string
  ownerName: string
  balance: number
  status: 'active' | 'inactive' | 'expired'
  subscription?: {
    type: string
    expiryDate: string
  }
  lastUsed: string
}

export interface Arrival {
  lineCode: string
  lineName: string
  arrivalMinutes: number
  destination: string
}

// Denizli city center coordinates
export const DENIZLI_CENTER = {
  lat: 37.7765,
  lng: 29.0864,
}

// Mock bus stops in Denizli
export const busStops: BusStop[] = [
  { id: 's1', name: 'Bayramyeri', lat: 37.7842, lng: 29.0931, lines: ['1', '2', '5', '8'] },
  { id: 's2', name: 'Delikliçınar', lat: 37.7789, lng: 29.0876, lines: ['1', '3', '7'] },
  { id: 's3', name: 'Forum AVM', lat: 37.7698, lng: 29.0712, lines: ['2', '4', '6'] },
  { id: 's4', name: 'Otogar', lat: 37.7612, lng: 29.1023, lines: ['1', '2', '3', '4', '5'] },
  { id: 's5', name: 'Pamukkale Üniversitesi', lat: 37.7534, lng: 29.1156, lines: ['5', '6', '8'] },
  { id: 's6', name: 'Çamlık', lat: 37.7901, lng: 29.0823, lines: ['1', '7', '8'] },
  { id: 's7', name: 'İncilipınar', lat: 37.7756, lng: 29.0945, lines: ['2', '3', '6'] },
  { id: 's8', name: 'Kayıhan', lat: 37.7823, lng: 29.0789, lines: ['4', '5', '7'] },
  { id: 's9', name: 'Sevindik', lat: 37.7678, lng: 29.0834, lines: ['1', '6', '8'] },
  { id: 's10', name: 'Akkonak', lat: 37.7712, lng: 29.1012, lines: ['2', '4', '7'] },
  { id: 's11', name: 'Karşıyaka', lat: 37.7867, lng: 29.0756, lines: ['3', '5', '8'] },
  { id: 's12', name: 'Gökpınar', lat: 37.7589, lng: 29.0867, lines: ['1', '4', '6'] },
  { id: 's13', name: 'Bağbaşı', lat: 37.7945, lng: 29.0912, lines: ['2', '7', '8'] },
  { id: 's14', name: 'Zeytinköy', lat: 37.7623, lng: 29.0723, lines: ['3', '5', '6'] },
  { id: 's15', name: 'Anafartalar', lat: 37.7778, lng: 29.0801, lines: ['1', '4', '7'] },
]

// Transit theme color (Denizli bus green)
const TRANSIT_COLOR = '#22c55e'

// Mock bus lines
export const busLines: BusLine[] = [
  {
    id: 'l1',
    code: '1',
    name: 'Bayramyeri - Otogar',
    color: TRANSIT_COLOR,
    stops: ['s1', 's2', 's6', 's9', 's12', 's15', 's4'],
    direction: 'forward',
  },
  {
    id: 'l2',
    code: '2',
    name: 'Bayramyeri - Forum AVM',
    color: TRANSIT_COLOR,
    stops: ['s1', 's7', 's10', 's13', 's3'],
    direction: 'forward',
  },
  {
    id: 'l3',
    code: '3',
    name: 'Delikliçınar - Zeytinköy',
    color: TRANSIT_COLOR,
    stops: ['s2', 's7', 's11', 's14'],
    direction: 'forward',
  },
  {
    id: 'l4',
    code: '4',
    name: 'Forum AVM - Akkonak',
    color: TRANSIT_COLOR,
    stops: ['s3', 's8', 's10', 's12', 's15', 's4'],
    direction: 'forward',
  },
  {
    id: 'l5',
    code: '5',
    name: 'Bayramyeri - Üniversite',
    color: TRANSIT_COLOR,
    stops: ['s1', 's4', 's8', 's11', 's14', 's5'],
    direction: 'forward',
  },
  {
    id: 'l6',
    code: '6',
    name: 'Forum AVM - Üniversite',
    color: TRANSIT_COLOR,
    stops: ['s3', 's7', 's9', 's12', 's14', 's5'],
    direction: 'forward',
  },
  {
    id: 'l7',
    code: '7',
    name: 'Delikliçınar - Bağbaşı',
    color: TRANSIT_COLOR,
    stops: ['s2', 's8', 's10', 's15', 's13', 's6'],
    direction: 'forward',
  },
  {
    id: 'l8',
    code: '8',
    name: 'Bayramyeri - Çamlık',
    color: TRANSIT_COLOR,
    stops: ['s1', 's5', 's9', 's11', 's13', 's6'],
    direction: 'forward',
  },
]

// Mock live buses
export const liveBuses: LiveBus[] = [
  { id: 'b1', lineId: 'l1', lat: 37.7812, lng: 29.0891, nextStop: 's2', arrivalMinutes: 3 },
  { id: 'b2', lineId: 'l1', lat: 37.7701, lng: 29.0912, nextStop: 's12', arrivalMinutes: 8 },
  { id: 'b3', lineId: 'l2', lat: 37.7745, lng: 29.0823, nextStop: 's10', arrivalMinutes: 5 },
  { id: 'b4', lineId: 'l3', lat: 37.7778, lng: 29.0856, nextStop: 's7', arrivalMinutes: 2 },
  { id: 'b5', lineId: 'l5', lat: 37.7623, lng: 29.1078, nextStop: 's5', arrivalMinutes: 12 },
  { id: 'b6', lineId: 'l6', lat: 37.7678, lng: 29.0789, nextStop: 's9', arrivalMinutes: 6 },
  { id: 'b7', lineId: 'l7', lat: 37.7856, lng: 29.0812, nextStop: 's13', arrivalMinutes: 4 },
  { id: 'b8', lineId: 'l8', lat: 37.7889, lng: 29.0878, nextStop: 's6', arrivalMinutes: 7 },
]

// Mock transit cards
export const transitCards: TransitCard[] = [
  {
    id: 'c1',
    cardNumber: '2345 6789 0123 4567',
    ownerName: 'Ahmet Yılmaz',
    balance: 125.5,
    status: 'active',
    subscription: {
      type: 'Aylık Tam',
      expiryDate: '2026-04-15',
    },
    lastUsed: '2026-03-09 08:45',
  },
]

// Helper function to get arrivals for a stop
export function getArrivalsForStop(stopId: string): Arrival[] {
  const stop = busStops.find((s) => s.id === stopId)
  if (!stop) return []

  return stop.lines
    .map((lineCode) => {
      const line = busLines.find((l) => l.code === lineCode)
      return {
        lineCode,
        lineName: line?.name || '',
        arrivalMinutes: Math.floor(Math.random() * 15) + 1,
        destination: line?.name.split(' - ')[1] || '',
      }
    })
    .sort((a, b) => a.arrivalMinutes - b.arrivalMinutes)
}

// Helper function to calculate distance between two points
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Get nearby stops sorted by distance
export function getNearbyStops(
  lat: number,
  lng: number,
  limit = 5,
): (BusStop & { distance: number })[] {
  return busStops
    .map((stop) => ({
      ...stop,
      distance: calculateDistance(lat, lng, stop.lat, stop.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
}
