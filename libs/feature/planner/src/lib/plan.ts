import type { Route, Stop } from '@ulasim20/types-transport'

export type PlanInput = { from: Stop; to: Stop; routes: Route[] }

export function planRoute({ from, to, routes: _routes }: PlanInput): Stop[] {
  return [from, to]
}
