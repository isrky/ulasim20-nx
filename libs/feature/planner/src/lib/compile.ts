export function compileDataset(input: unknown): { compiledAt: string; size: number } {
  const size = JSON.stringify(input).length
  return { compiledAt: new Date().toISOString(), size }
}
