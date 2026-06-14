import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'akilli.ulasim.portal',
  appName: 'akilli-ulasim-portal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // Allow HTTP for local dev or certain APIs if needed
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      releaseType: 'bundle',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      // Resize the WebView so inputs stay above the keyboard.
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0E7490',
      sound: 'beep.wav',
    },
    Browser: {
      androidCustomTabsColor: '#0E7490',
    },
    StatusBar: {
      backgroundColor: '#FFFFFF',
      style: 'LIGHT',
      overlaysWebView: false,
    },
  },
}

export default config
