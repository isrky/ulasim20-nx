// Türkçe metinlerde arama/karşılaştırma için güvenli normalizasyon yardımcıları
// Amaç: Küçük/büyük harf farkını, aksan/diakritik işaretlerini ve noktalı/noktasızi farklılığını tolere etmek

/**
 * Verilen metni arama için normalize eder:
 * - Unicode lower-case (locale bağımsız)
 * - NFD ile ayır ve diakritik işaretlerini kaldır (ç->c, ğ->g, ş->s, ö->o, ü->u, â->a vb.)
 * - Türkçe özel: noktasızi (ı) -> i dönüşümü
 * - Trim ve ardışık boşlukları tek boşluğa indirger
 */
export function foldTR(input: string): string {
  if (!input) return ''
  // Lowercase (locale bağımsız) ve Unicode normalizasyonu
  let s = input.toLowerCase()
  // NFD: karakteri temel harf + işaretlere ayır
  s = s.normalize('NFD')
  // Diakritikleri kaldır (U+0300–U+036F aralığı)
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: standard diacritics removal range
  s = s.replace(/[\u0300-\u036f]/g, '')
  // Türkçe özel: noktasız i'yi i'ye katla
  s = s.replace(/ı/g, 'i')
  // Artık gereksiz boşlukları sadeleştir
  s = s.trim().replace(/\s+/g, ' ')
  return s
}

/**
 * Normalizes a line code by removing direction suffixes like D or -D.
 */
export function cleanLineCode(code: string): string {
  return code.replace(/D$/i, '').replace(/-$/, '').trim()
}

/**
 * Normalizes a line name by removing route prefixes.
 */
export function cleanLineName(name: string, lineCode: string): string {
  let cleaned = name
  if (name.includes('/')) {
    cleaned = name.substring(name.indexOf('/') + 1).trim()
  } else {
    const cleanCode = cleanLineCode(lineCode)
    const codePattern = new RegExp(
      `^${cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}D?\\s*[-:]?\\s*`,
      'i',
    )
    cleaned = name.replace(codePattern, '')
  }
  cleaned = cleaned
    .replace(/-?\s*D\s*\/\s*/gi, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/-{2,}/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (cleaned.startsWith('- ')) cleaned = cleaned.slice(2)
  return cleaned
}
