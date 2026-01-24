import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // A new version is available - the PWA will auto-update
    console.log('🔄 New content available, will update automatically');
  },
  onOfflineReady() {
    console.log('✅ App is ready for offline use');
  },
  onRegistered(registration) {
    console.log('📱 Service Worker registered:', registration);
    
    // Check for updates periodically (every hour)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('❌ Service Worker registration failed:', error);
  },
  immediate: true
});

// Handle app visibility change to check for updates
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateSW();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
