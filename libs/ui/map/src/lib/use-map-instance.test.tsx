import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEffect } from 'react'
import { MapInstanceProvider, useMapInstance } from './use-map-instance'

function Probe({ onValue }: { onValue: (m: unknown) => void }) {
  const map = useMapInstance()
  useEffect(() => { onValue(map) }, [map, onValue])
  return <div data-testid="probe">{map ? 'ready' : 'pending'}</div>
}

describe('useMapInstance', () => {
  it('returns null before a map is provided and the provided map after', () => {
    const fakeMap = { id: 'fake' }
    const seen: Array<unknown> = []
    render(
      <MapInstanceProvider value={fakeMap}>
        <Probe onValue={(m) => seen.push(m)} />
      </MapInstanceProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('ready')
    expect(seen.at(-1)).toBe(fakeMap)
  })

  it('returns null when no provider is present', () => {
    render(<Probe onValue={() => {}} />)
    expect(screen.getByTestId('probe')).toHaveTextContent('pending')
  })
})
