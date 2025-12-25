import { useState, useEffect } from 'react';

/**
 * Hook to detect if the current device is a mobile device
 * Returns true only for mobile devices (not tablets or desktops)
 */
export function useMobileDetection(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check user agent for mobile devices
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      // Check screen width - mobile should be less than 768px
      const isMobileWidth = window.innerWidth < 768;
      
      // Check for tablet (iPad detection)
      const isTablet = /iPad|Android/i.test(userAgent) && window.innerWidth >= 768;
      
      // Check for desktop (pointer fine means mouse/trackpad)
      const isDesktop = window.innerWidth >= 1024 || window.matchMedia('(pointer: fine)').matches;
      
      // Only return true if it's mobile UA, mobile width, and not tablet/desktop
      setIsMobile(isMobileUA && isMobileWidth && !isTablet && !isDesktop);
    };

    // Initial check
    checkMobile();

    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return isMobile;
}

