import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'akilli.ulasim.portal',
  appName: 'akilli-ulasim-portal',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    buildOptions: { releaseType: 'AAB' }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP'
    },
    Keyboard: { resize: 'body', style: 'DARK', resizeOnFullScreen: true },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0E7490',
      sound: 'beep.wav'
    },
    Browser: { androidCustomTabsColor: '#0E7490' },
    StatusBar: { backgroundColor: '#FFFFFF', style: 'LIGHT', overlaysWebView: false }
  }
}

export default config
