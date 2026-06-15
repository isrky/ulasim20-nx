export function trSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatNumberTr(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n)
}

export function cleanLineCode(code: string): string {
  return code.replace(/D$/i, '').replace(/-$/, '').trim()
}

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
