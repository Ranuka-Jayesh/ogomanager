import { useEffect, useState, useCallback } from 'react';
import { useMobileDetection } from './useMobileDetection';

type NotificationType = 'success' | 'info' | 'warning' | 'error';

interface NotificationOptions {
  title?: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Hook to handle browser notifications for mobile devices only
 * Uses the Browser Notification API to show native notifications
 */
export function useMobileNotifications() {
  const isMobile = useMobileDetection();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission (only on mobile)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isMobile || !isSupported) {
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    if (permission === 'default') {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        return result === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }

    return false;
  }, [isMobile, isSupported, permission]);

  // Show notification (only on mobile)
  const showNotification = useCallback(
    async (
      message: string,
      type: NotificationType = 'info',
      options: Partial<NotificationOptions> = {}
    ) => {
      // Only show on mobile devices
      if (!isMobile || !isSupported) {
        return;
      }

      // Request permission if not already granted
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        return;
      }

      // Get absolute URL for icon (required for Android)
      const getAbsoluteUrl = (path: string) => {
        if (path.startsWith('http')) return path;
        return `${window.location.origin}${path.startsWith('/') ? path : '/' + path}`;
      };

      // Use app.png as icon with absolute URL for Android
      const defaultIcon = options.icon ? getAbsoluteUrl(options.icon) : getAbsoluteUrl('/app.png');
      const badge = options.badge ? getAbsoluteUrl(options.badge) : getAbsoluteUrl('/app.png');

      // Create notification title - always use "Manager Pro" for consistency
      const title = options.title || 'Manager Pro';

      // Android-specific notification options
      const notificationOptions: NotificationOptions & any = {
        body: message,
        icon: defaultIcon,
        badge: badge,
        tag: options.tag || `notification-${type}-${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
        silent: false,
        // Android-specific: Don't auto-close, let user dismiss manually
        // This ensures notifications stay in the notification panel
        data: {
          timestamp: Date.now(),
          type: type,
        },
        // Add vibration pattern for Android (if supported)
        vibrate: [200, 100, 200],
      };

      // Create the notification
      const notification = new Notification(title, notificationOptions);

      // Don't auto-close on Android - let notifications stay in the panel
      // Only auto-close after 10 seconds if user hasn't interacted
      const autoCloseTimer = setTimeout(() => {
        // Only close if notification is still showing and not focused
        if (document.hidden) {
          notification.close();
        }
      }, 10000);

      // Handle click - focus the window and clear timer
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        clearTimeout(autoCloseTimer);
        notification.close();
      };

      // Handle close event
      notification.onclose = () => {
        clearTimeout(autoCloseTimer);
      };

      return notification;
    },
    [isMobile, isSupported, requestPermission]
  );

  // Helper function to get notification title based on type
  const getNotificationTitle = (type: NotificationType): string => {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
      default:
        return 'Manager Pro';
    }
  };

  return {
    showNotification,
    requestPermission,
    permission,
    isSupported: isSupported && isMobile,
    isMobile,
  };
}

