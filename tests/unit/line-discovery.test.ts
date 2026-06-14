import { describe, expect, it } from 'vitest'

/**
 * This test reproduces the discovery process used to find the "150G" line.
 * Step 1: Query the Denizli Ulaşım API for all available bus routes.
 * Step 2: Search for the "150G" pattern within the line codes and names.
 *
 * Original discovery command:
 * curl -s "https://ulasim.denizli.bel.tr/UlasimBackend/api/Calc/GetAllRoutes" | grep "150G"
 */
describe('Line Discovery Process', () => {
  it('identifies the exact lineCode for "150G" by querying the live Denizli Ulaşım API', async () => {
    const url = 'https://ulasim.denizli.bel.tr/UlasimBackend/api/Calc/GetAllRoutes'

    // 1. Fetch all routes from the source of truth
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch routes: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // 2. Verify API response structure matches expectations
    expect(data, 'API response should indicate success').toHaveProperty('isSuccess', true)
    expect(Array.isArray(data.value), 'API should return a list of routes in .value').toBe(true)

    // 3. Search for "150G" in the results
    // This mimics the 'grep "150G"' step
    const match = data.value.find(
      (route: any) => route.lineCode.includes('150G') || route.lineName.includes('150G'),
    )

    // 4. Assert that the line was found and matches the identified snippet
    expect(match, 'Line "150G" should exist in the API response').toBeDefined()
    expect(match.lineCode).toBe('150G-D')
    expect(match.lineNo).toBe(106)
    expect(match.lineName).toContain('OTOGAR-ÜNİVERSİTE')

    // Print the discovered snippet for visibility during test execution
    console.log('--- Discovered Snippet for 150G ---')
    console.log(JSON.stringify(match, null, 2))
    console.log('-----------------------------------')
  })
})
