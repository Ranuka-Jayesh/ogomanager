import { useCallback, useMemo, useState } from 'react';

interface UseLoginAlertsOptions {
  userId: string | null;
  enabled?: boolean;
}

interface LoginEvent {
  created_at?: string;
}

/**
 * Safe fallback hook for login alerts.
 * Returns stable values so UI can render even if realtime alert logic is unavailable.
 */
export function useLoginAlerts({ enabled = false }: UseLoginAlertsOptions) {
  const [latestLoginEvent] = useState<LoginEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const hasNewLogin = useMemo(
    () => Boolean(enabled && latestLoginEvent && !dismissed),
    [enabled, latestLoginEvent, dismissed]
  );

  const dismissAlert = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    hasNewLogin,
    latestLoginEvent,
    dismissAlert,
  };
}
