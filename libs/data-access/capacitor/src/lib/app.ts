import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export function configureAppBackButton(): void {
  if (!Capacitor.isNativePlatform()) return
  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      App.exitApp()
    } else {
      window.history.back()
    }
  })
}
