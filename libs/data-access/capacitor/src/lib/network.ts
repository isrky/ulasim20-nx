import { type ConnectionStatus, Network } from '@capacitor/network'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

/**
 * React hook returning the current network status.
 * Native: @capacitor/network. Web: navigator.onLine + online/offline events.
 */
export function useNetworkStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => ({
    connected: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    connectionType: 'unknown',
  }))

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (Capacitor.isNativePlatform()) {
      let mounted = true
      Network.getStatus().then((s) => {
        if (mounted) setStatus(s)
      })
      const handle = Network.addListener('networkStatusChange', (s) => setStatus(s))
      cleanup = () => {
        mounted = false
        handle.then((l) => l.remove())
      }
    } else if (typeof window !== 'undefined') {
      const update = () => {
        setStatus({
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
        })
      }
      window.addEventListener('online', update)
      window.addEventListener('offline', update)
      update()
      cleanup = () => {
        window.removeEventListener('online', update)
        window.removeEventListener('offline', update)
      }
    }

    return cleanup
  }, [])

  return status
}
