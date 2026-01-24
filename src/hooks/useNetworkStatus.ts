/**
 * Network Status Hook
 * Monitors online/offline status and connection quality
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  effectiveType: string | null;
}

// Connection API types (not available in all browsers)
interface NetworkInformation {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
    lastOnlineAt: typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null,
    lastOfflineAt: typeof navigator !== 'undefined' && !navigator.onLine ? new Date() : null,
    effectiveType: null,
  }));

  // Keep track of callbacks to avoid stale closures
  const statusRef = useRef(status);
  statusRef.current = status;

  const getConnection = useCallback((): NetworkInformation | null => {
    if (typeof navigator === 'undefined') return null;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }, []);

  const updateNetworkInfo = useCallback(() => {
    const connection = getConnection();
    const isOnline = navigator.onLine;

    setStatus((prev) => ({
      ...prev,
      isOnline,
      connectionType: connection?.effectiveType || null,
      effectiveType: connection?.effectiveType || null,
      isSlowConnection:
        connection?.effectiveType === '2g' ||
        connection?.effectiveType === 'slow-2g' ||
        (connection?.rtt !== undefined && connection.rtt > 500),
    }));
  }, [getConnection]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Back online');
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        lastOnlineAt: new Date(),
      }));
      updateNetworkInfo();
    };

    const handleOffline = () => {
      console.log('📴 Network: Gone offline');
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        lastOfflineAt: new Date(),
      }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes (if supported)
    const connection = getConnection();
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    // Initial update
    updateNetworkInfo();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      const conn = getConnection();
      if (conn) {
        conn.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, [updateNetworkInfo, getConnection]);

  return status;
}

/**
 * Utility hook to react to online status changes
 */
export function useOnlineEffect(
  onOnline: () => void,
  onOffline?: () => void,
  deps: React.DependencyList = []
) {
  const { isOnline } = useNetworkStatus();
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    // Detect transition from offline to online
    if (isOnline && !wasOnlineRef.current) {
      console.log('🔄 Transition: offline → online');
      onOnline();
    }
    
    // Detect transition from online to offline
    if (!isOnline && wasOnlineRef.current && onOffline) {
      console.log('🔄 Transition: online → offline');
      onOffline();
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline, onOnline, onOffline, ...deps]);
}
