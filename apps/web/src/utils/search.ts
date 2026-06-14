import { foldTR } from './text'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchMatch {
  score: number
  matchType: 'exact' | 'starts' | 'word-boundary' | 'contains' | 'fuzzy' | 'none'
  matchIndex: number
}

export interface IndexEntry {
  normalized: string
  words: string[]
}

export interface StationSearchResult<T> {
  item: T
  score: number
  matchType: SearchMatch['matchType']
}

export interface BusRouteSearchResult<T> {
  item: T
  score: number
  matchType: SearchMatch['matchType']
}

// ---------------------------------------------------------------------------
// Index builders  (called once when data loads, via useMemo)
// ---------------------------------------------------------------------------

export function buildIndex(values: string[]): IndexEntry[] {
  return values.map((v) => {
    const normalized = foldTR(v)
    return { normalized, words: normalized.split(/\s+/).filter(Boolean) }
  })
}

export function buildStationIndex<T extends { stationName: string }>(stations: T[]): IndexEntry[] {
  return buildIndex(stations.map((s) => s.stationName))
}

export function buildRouteIndexes<T extends { lineCode: string; lineName: string }>(
  routes: T[],
): { codeIndex: IndexEntry[]; nameIndex: IndexEntry[] } {
  return {
    codeIndex: buildIndex(routes.map((r) => r.lineCode.replace(/D$/i, '').replace(/-$/, ''))),
    nameIndex: buildIndex(routes.map((r) => r.lineName)),
  }
}

// ---------------------------------------------------------------------------
// Levenshtein  (single-row, O(min(n,m)) space)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let strA = a
  let strB = b

  if (strA.length > strB.length) {
    const t = strA
    strA = strB
    strB = t
  }

  const aLen = strA.length
  const bLen = strB.length
  let prev = new Array<number>(aLen + 1)
  for (let i = 0; i <= aLen; i++) prev[i] = i

  for (let j = 1; j <= bLen; j++) {
    const curr = new Array<number>(aLen + 1)
    curr[0] = j
    for (let i = 1; i <= aLen; i++) {
      curr[i] =
        strA[i - 1] === strB[j - 1] ? prev[i - 1] : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1])
    }
    prev = curr
  }
  return prev[aLen]
}

// ---------------------------------------------------------------------------
// Core scoring  (operates on pre-indexed entries — no foldTR at query time)
// ---------------------------------------------------------------------------

const SCORE_EXACT = 1000
const SCORE_STARTS = 900
const SCORE_WORD_BOUNDARY = 800
const SCORE_CONTAINS = 600
const SCORE_FUZZY = 400
const POSITION_BONUS_MAX = 50
const CONSECUTIVE_ORDER_BONUS = 150
const MULTI_WORD_BONUS_PER_WORD = 100

const NO_MATCH: SearchMatch = { score: 0, matchType: 'none', matchIndex: -1 }

function scoreSingleWord(entry: IndexEntry, q: string): SearchMatch {
  const { normalized, words } = entry

  if (normalized === q) {
    return { score: SCORE_EXACT, matchType: 'exact', matchIndex: 0 }
  }

  if (normalized.startsWith(q)) {
    return { score: SCORE_STARTS, matchType: 'starts', matchIndex: 0 }
  }

  // Word-boundary: any word starts with query
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q)) {
      let pos = 0
      for (let j = 0; j < i; j++) pos += words[j].length + 1
      const bonus = Math.max(0, POSITION_BONUS_MAX - pos)
      return { score: SCORE_WORD_BOUNDARY + bonus, matchType: 'word-boundary', matchIndex: pos }
    }
  }

  // Substring contains
  const idx = normalized.indexOf(q)
  if (idx >= 0) {
    const bonus = Math.max(0, POSITION_BONUS_MAX - idx)
    return { score: SCORE_CONTAINS + bonus, matchType: 'contains', matchIndex: idx }
  }

  // Fuzzy per-word (Levenshtein)
  if (q.length >= 3) {
    const maxDist = q.length <= 4 ? 1 : 2
    for (let i = 0; i < words.length; i++) {
      if (Math.abs(words[i].length - q.length) > maxDist) continue
      const dist = levenshtein(words[i], q)
      if (dist <= maxDist) {
        return { score: SCORE_FUZZY - dist * 50, matchType: 'fuzzy', matchIndex: i }
      }
    }
  }

  return NO_MATCH
}

function checkConsecutiveOrder(fieldWords: string[], queryWords: string[]): boolean {
  let fi = 0
  for (const qw of queryWords) {
    let found = false
    while (fi < fieldWords.length) {
      if (fieldWords[fi].startsWith(qw) || fieldWords[fi].includes(qw)) {
        found = true
        fi++
        break
      }
      fi++
    }
    if (!found) return false
  }
  return true
}

const MATCH_TYPE_ORDER: SearchMatch['matchType'][] = [
  'exact',
  'starts',
  'word-boundary',
  'contains',
  'fuzzy',
  'none',
]

function scoreEntry(entry: IndexEntry, q: string, qWords: string[]): SearchMatch {
  if (qWords.length <= 1) {
    return scoreSingleWord(entry, q)
  }

  // Multi-word: all query words must match (AND logic)
  let totalScore = 0
  let worstType: SearchMatch['matchType'] = 'exact'
  let firstIdx = -1

  for (const qw of qWords) {
    const m = scoreSingleWord(entry, qw)
    if (m.matchType === 'none') return NO_MATCH
    totalScore += m.score
    if (MATCH_TYPE_ORDER.indexOf(m.matchType) > MATCH_TYPE_ORDER.indexOf(worstType)) {
      worstType = m.matchType
    }
    if (firstIdx === -1 || m.matchIndex < firstIdx) firstIdx = m.matchIndex
  }

  const avg = totalScore / qWords.length
  const wordBonus = qWords.length * MULTI_WORD_BONUS_PER_WORD
  const orderBonus = checkConsecutiveOrder(entry.words, qWords) ? CONSECUTIVE_ORDER_BONUS : 0

  return {
    score: avg + wordBonus + orderBonus,
    matchType: worstType,
    matchIndex: firstIdx,
  }
}

// ---------------------------------------------------------------------------
// Station search
// ---------------------------------------------------------------------------

const SCORE_ID_EXACT = 10000
const SCORE_ID_PREFIX = 5000

export function searchStations<T extends { stationId: number; stationName: string }>(
  stations: T[],
  query: string,
  index: IndexEntry[],
): StationSearchResult<T>[] {
  const q = foldTR(query.trim())
  if (!q) return []

  const isNumeric = /^\d+$/.test(q)

  // Numeric path: match station IDs only
  if (isNumeric) {
    const results: StationSearchResult<T>[] = []
    for (const station of stations) {
      const idStr = String(station.stationId)
      if (idStr === q) {
        results.push({ item: station, score: SCORE_ID_EXACT, matchType: 'exact' })
      } else if (idStr.startsWith(q)) {
        results.push({ item: station, score: SCORE_ID_PREFIX, matchType: 'starts' })
      }
    }
    results.sort((a, b) => b.score - a.score)
    return results
  }

  // Text path: score against pre-indexed station names
  const qWords = q.split(/\s+/).filter(Boolean)
  const results: StationSearchResult<T>[] = []

  for (let i = 0; i < stations.length; i++) {
    const m = scoreEntry(index[i], q, qWords)
    if (m.score > 0) {
      results.push({ item: stations[i], score: m.score, matchType: m.matchType })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

// ---------------------------------------------------------------------------
// Bus route search
// ---------------------------------------------------------------------------

export function searchBusRoutes<T extends { lineCode: string; lineName: string }>(
  routes: T[],
  query: string,
  codeIndex: IndexEntry[],
  nameIndex: IndexEntry[],
): BusRouteSearchResult<T>[] {
  const q = foldTR(query.trim())
  if (!q) return []

  const isNumeric = /^\d+$/.test(q)

  // Numeric path: strict prefix on line code only
  if (isNumeric) {
    const results: BusRouteSearchResult<T>[] = []
    for (let i = 0; i < routes.length; i++) {
      const code = codeIndex[i].normalized
      if (code === q) {
        results.push({ item: routes[i], score: SCORE_EXACT * 2, matchType: 'exact' })
      } else if (code.startsWith(q)) {
        results.push({ item: routes[i], score: SCORE_STARTS * 2, matchType: 'starts' })
      }
    }
    results.sort((a, b) => b.score - a.score)
    return results
  }

  // Text path: score on code (2x weight) and name (1x), take best
  const qWords = q.split(/\s+/).filter(Boolean)
  const results: BusRouteSearchResult<T>[] = []

  for (let i = 0; i < routes.length; i++) {
    const codeMatch = scoreEntry(codeIndex[i], q, qWords)
    const nameMatch = scoreEntry(nameIndex[i], q, qWords)

    const codeScore = codeMatch.score * 2
    const nameScore = nameMatch.score

    const best =
      codeScore >= nameScore
        ? { score: codeScore, matchType: codeMatch.matchType }
        : { score: nameScore, matchType: nameMatch.matchType }

    if (best.score > 0) {
      results.push({ item: routes[i], score: best.score, matchType: best.matchType })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
