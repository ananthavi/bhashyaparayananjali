import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wrapper for Bhashya Parayana.
 *
 * The built Vite output (`dist/`) is bundled directly into the APK's
 * assets, so the app runs fully offline immediately after install without
 * needing a hosted PWA URL or Digital Asset Links. All service-worker
 * caching still works because the webview respects the PWA manifest.
 *
 * The http(s) scheme is left as default so IndexedDB and other secure-
 * context-only APIs work correctly inside the WebView.
 */
const config: CapacitorConfig = {
  appId: 'net.sringeri.advaita.bhashyaparayana',
  appName: 'Pārāyaṇāñjali',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#FBF5EC',
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#6B3410',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Render the WebView BELOW the system status bar instead of
      // letting it draw underneath. This prevents the time/battery icons
      // from overlapping the app's sticky toolbar on devices where the
      // status bar is translucent by default.
      overlaysWebView: false,
      backgroundColor: '#6B3410',
      style: 'DARK',
    },
  },
};

export default config;
