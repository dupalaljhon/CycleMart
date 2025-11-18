# CycleMart PWA Setup

Your Angular application has been successfully converted to a Progressive Web App (PWA)!

## What's Been Added

### 1. Service Worker
- Automatic caching of assets for offline support
- Background sync capabilities
- Push notification support (can be configured)

### 2. Web App Manifest
- App name: "CycleMart - Buy & Sell Bike Parts"
- Theme color: Black (#000000)
- Multiple icon sizes for different devices
- Standalone display mode (looks like a native app)

### 3. PWA Features
- **Install Prompt**: Users will see an install prompt after 5 seconds
- **Offline Support**: App works offline with cached content
- **Auto-Updates**: App checks for updates and prompts users to reload
- **App-like Experience**: Runs in standalone mode without browser UI

## How to Build and Test

### Development Mode
```bash
npm start
```
**Note**: Service worker is disabled in development mode for easier debugging.

### Production Build
```bash
npm run build
```

The PWA will be built to `dist/cycle-mart/` directory.

### Testing the PWA Locally

1. **Build for production**:
   ```bash
   npm run build
   ```

2. **Serve the production build**:
   You need to serve the `dist/cycle-mart` folder with a web server that supports HTTPS (required for service workers).

   Option A - Using http-server:
   ```bash
   npm install -g http-server
   cd dist/cycle-mart
   http-server -p 8080 -c-1
   ```

   Option B - Using Angular CLI:
   ```bash
   npm install -g http-server
   http-server dist/cycle-mart/browser -p 8080 --gzip
   ```

3. **Test PWA features**:
   - Open Chrome DevTools (F12)
   - Go to "Application" tab
   - Check "Service Workers" section
   - Check "Manifest" section
   - Use Lighthouse to audit PWA score

### Install the PWA

#### On Desktop (Chrome/Edge):
1. Visit your app URL
2. Click the install icon in the address bar (➕ or ⚡)
3. Or wait for the install prompt to appear
4. Click "Install"

#### On Mobile (Chrome/Safari):
1. Visit your app URL
2. Tap the menu (⋮ on Android, share icon on iOS)
3. Tap "Add to Home Screen" or "Install App"
4. The app icon will appear on your home screen

## PWA Configuration Files

### `ngsw-config.json`
Service worker configuration for caching strategies:
- **App Shell**: Prefetches core files
- **Assets**: Lazy loads images and fonts
- **API Calls**: Caches API responses with freshness strategy

### `manifest.webmanifest`
PWA manifest with:
- App name and short name
- Icons (72x72 to 512x512)
- Theme colors
- Display mode
- Start URL

### `src/app/services/pwa.service.ts`
Service for:
- Handling install prompts
- Checking for app updates
- Managing service worker lifecycle

### `src/app/shared/pwa-prompt/pwa-prompt.component.ts`
Custom install prompt component that appears after 5 seconds.

## Customization

### Change App Icons
Replace the default icons in `public/icons/` with your custom icons:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

### Change Theme Colors
Edit `public/manifest.webmanifest`:
```json
{
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

### Adjust Install Prompt Timing
Edit `src/app/shared/pwa-prompt/pwa-prompt.component.ts`:
```typescript
setTimeout(() => {
  if (this.pwaService.canInstall && !this.isDismissed()) {
    this.showInstallPrompt = true;
  }
}, 5000); // Change delay here (in milliseconds)
```

### Modify Caching Strategy
Edit `ngsw-config.json` to adjust what gets cached and how.

## Testing PWA Score

Use Google Lighthouse to test your PWA:
1. Open Chrome DevTools
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"

Aim for a score of 90+ for production apps.

## Deployment

When deploying to production:
1. Ensure your server supports HTTPS (required for PWAs)
2. Configure proper cache headers
3. Set up SSL certificate
4. Test on both desktop and mobile devices

## Troubleshooting

### Service Worker Not Registering
- Check that you're using HTTPS or localhost
- Clear browser cache and reload
- Check browser console for errors

### Install Prompt Not Showing
- Ensure you're on HTTPS
- Check that manifest.webmanifest is accessible
- Verify all required manifest fields are present
- Some browsers require user engagement before showing prompt

### App Not Working Offline
- Check ngsw-config.json is properly configured
- Verify service worker is registered
- Check Application > Cache Storage in DevTools

## Features to Consider Adding

1. **Push Notifications**: Notify users about new messages or listings
2. **Background Sync**: Sync data when connection is restored
3. **Share Target API**: Allow sharing listings to the app
4. **Shortcuts**: Add quick actions to app icon menu

## Resources

- [Angular PWA Guide](https://angular.dev/ecosystem/service-workers)
- [Web App Manifest Docs](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
