/**
 * Pharmacy Scraper Service
 * Scrapes nöbetçi eczane data from denizli.bel.tr
 *
 * Source: https://denizli.bel.tr/Default.aspx?k=NobetciEczaneler
 * The page is a classic ASP.NET WebForms page with no JSON API;
 * pharmacy data is embedded directly in the HTML.
 */

import type { PharmacyData, PharmacyResponse } from '../types'

const PHARMACY_URL = 'https://denizli.bel.tr/Default.aspx?k=NobetciEczaneler'

export async function scrapePharmacies(): Promise<PharmacyResponse> {
  const res = await fetch(PHARMACY_URL, {
    headers: {
      'User-Agent': 'DenizliUlasim/1.0',
      Accept: 'text/html',
    },
  })

  if (!res.ok) {
    throw new Error(`Pharmacy page fetch failed: ${res.status}`)
  }

  const html = await res.text()
  return parsePharmacyHtml(html)
}

/**
 * Regex-based parser. Preferred over HTMLRewriter here because the data sits
 * inside a single `<div id="ctl14_rightcontent">` block with a very
 * predictable pattern, and regex keeps things simple + deterministic without
 * streaming state machines.
 */
export function parsePharmacyHtml(html: string): PharmacyResponse {
  const pharmacies: PharmacyData[] = []

  // Extract date from: <span class="text"> 16 Mart 2026, Pazartesi</span>
  const dateMatch = html.match(
    /<div\s+id="liste"[^>]*>.*?<span\s+class="text">\s*(.+?)\s*<\/span>/s,
  )
  const date = dateMatch?.[1]?.trim() ?? ''

  const content = html

  // Track current district via <h2 class="eczaneilce">
  let currentDistrict = ''

  // Split content by h2 headers to process district by district
  const sections = content.split(/<h2\s+class="eczaneilce">/)

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i]
    // First part before </h2> is the district name
    const districtMatch = section.match(/^([^<]+)<\/h2>/)
    if (districtMatch) {
      currentDistrict = districtMatch[1].trim()
    }

    // Find all pharmacy entries in <div class="line">
    const matches = section.matchAll(/<div\s+class="line">([\s\S]*?)<\/div>/g)
    for (const match of matches) {
      const lineHtml = match[1]
      const pharmacy = parsePharmacyLine(lineHtml, currentDistrict)
      if (pharmacy) {
        pharmacies.push(pharmacy)
      }
    }
  }

  return { date, pharmacies }
}

/**
 * Parse a single `<div class="line">` block.
 *
 * Content pattern:
 *   <img ...> <b>ECZANE ADI</b><br>ADRES<br>İLÇE<br>TELEFON
 *
 * Some pharmacies may have an empty address.
 */
function parsePharmacyLine(lineHtml: string, fallbackDistrict: string): PharmacyData | null {
  // Extract name from <b>...</b>
  const nameMatch = lineHtml.match(/<b>\s*(.+?)\s*<\/b>/)
  if (!nameMatch) return null
  const name = nameMatch[1].trim()

  // Get everything after </b>, strip tags except <br> first
  let afterName = lineHtml.slice(lineHtml.indexOf('</b>') + 4)

  // Replace <br>, <br/>, <br /> with a delimiter
  afterName = afterName.replace(/<br\s*\/?>/gi, '|||')

  // Strip remaining HTML tags
  afterName = afterName.replace(/<[^>]*>/g, '')

  // Split by delimiter and clean
  const parts = afterName
    .split('|||')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Expected: [address, district, phone] or [district, phone] (when address is empty)
  let address = ''
  let district = fallbackDistrict
  let phone = ''

  if (parts.length >= 3) {
    address = parts[0]
    district = parts[1] || fallbackDistrict
    phone = parts[2]
  } else if (parts.length === 2) {
    // No address line
    district = parts[0] || fallbackDistrict
    phone = parts[1]
  } else if (parts.length === 1) {
    phone = parts[0]
  }

  // Format phone: remove non-digit chars for normalization, keep original for display
  const phoneClean = phone.replace(/\s+/g, ' ').trim()

  return {
    name: titleCase(name),
    address,
    district: titleCase(district),
    phone: phoneClean,
  }
}

/** Convert "MERKEZEFENDİ" -> "Merkezefendi" */
function titleCase(str: string): string {
  if (!str) return str
  return str.toLocaleLowerCase('tr-TR').replace(/(^|\s)\S/g, (c) => c.toLocaleUpperCase('tr-TR'))
}
