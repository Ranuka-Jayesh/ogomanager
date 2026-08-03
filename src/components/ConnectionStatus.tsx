import React, { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  Loader,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';

export type DbConnectionStatus = 'connected' | 'disconnected' | 'connecting';

interface ConnectionStatusProps {
  /** Supabase / database ping status */
  dbStatus: DbConnectionStatus;
  isDbConnected: boolean;
  lastPing?: Date | null;
  /** Offline sync */
  isOnline?: boolean;
  pendingChanges?: number;
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  onSync?: () => Promise<boolean>;
}

function formatLastSync(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Single header control for database connection + sync status.
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  dbStatus,
  isDbConnected,
  lastPing,
  isOnline = true,
  pendingChanges = 0,
  isSyncing = false,
  lastSyncTime = null,
  onSync,
}) => {
  const [showTip, setShowTip] = useState(false);

  // Auto-hide mobile tip
  useEffect(() => {
    if (!showTip) return;
    const t = setTimeout(() => setShowTip(false), 4000);
    return () => clearTimeout(t);
  }, [showTip]);

  const canSync = Boolean(onSync) && isOnline && pendingChanges > 0 && !isSyncing;

  const dbLabel =
    dbStatus === 'connecting'
      ? 'Connecting…'
      : isDbConnected
        ? `DB connected${lastPing ? ` (${lastPing.toLocaleTimeString()})` : ''}`
        : 'DB disconnected';

  const syncLabel = !isOnline
    ? 'Offline — sync when back online'
    : isSyncing
      ? 'Syncing…'
      : pendingChanges > 0
        ? `${pendingChanges} change${pendingChanges !== 1 ? 's' : ''} pending`
        : lastSyncTime
          ? `Synced · ${formatLastSync(lastSyncTime)}`
          : 'All synced';

  const overallOk = isDbConnected && isOnline && pendingChanges === 0 && !isSyncing;
  const overallWarn = isOnline && (pendingChanges > 0 || isSyncing);
  const overallBad = !isDbConnected || !isOnline;

  const handleClick = async () => {
    if (window.innerWidth < 640) {
      setShowTip(v => !v);
    }
    if (canSync && onSync) {
      await onSync();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => {
          if (window.innerWidth >= 640) setShowTip(true);
        }}
        onMouseLeave={() => {
          if (window.innerWidth >= 640) setShowTip(false);
        }}
        className={`relative flex items-center gap-1.5 p-2 rounded-lg border transition-colors ${
          canSync ? 'cursor-pointer' : 'cursor-default sm:cursor-default'
        } ${
          overallBad
            ? 'bg-transparent border-[#E16428]/20 text-red-400'
            : overallWarn
              ? 'bg-transparent border-[#E16428]/20 text-amber-400'
              : 'bg-transparent border-[#E16428]/20 text-green-400'
        }`}
        aria-label={`${dbLabel}. ${syncLabel}`}
        title="Connection status"
      >
        {/* Database */}
        {dbStatus === 'connecting' ? (
          <Loader className="w-4 h-4 animate-spin text-[#F6E9E9]/70" />
        ) : isDbConnected ? (
          <Wifi className="w-4 h-4 text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" />
        )}

        {/* Sync */}
        {!isOnline ? (
          <CloudOff className="w-4 h-4 text-red-400" />
        ) : isSyncing ? (
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        ) : (
          <Cloud
            className={`w-4 h-4 ${
              pendingChanges > 0 ? 'text-amber-400' : 'text-green-400'
            }`}
          />
        )}

        {/* Status dot */}
        <span
          className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#272121] ${
            dbStatus === 'connecting' || isSyncing
              ? 'bg-yellow-500 animate-pulse'
              : overallBad
                ? 'bg-red-500'
                : overallWarn
                  ? 'bg-amber-400'
                  : 'bg-green-500'
          }`}
        />
      </button>

      {showTip && (
        <div className="absolute top-full right-0 mt-2 z-50 min-w-[200px] px-3 py-2 rounded-lg bg-[#272121] border border-[#E16428]/25 shadow-xl text-[#F6E9E9] text-xs font-['Inter'] pointer-events-none">
          <div className="flex items-center gap-2 mb-1.5">
            {isDbConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-400 shrink-0" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
            )}
            <span className="whitespace-nowrap">{dbLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <CloudOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
            ) : (
              <Cloud
                className={`w-3.5 h-3.5 shrink-0 ${
                  pendingChanges > 0 ? 'text-amber-400' : 'text-green-400'
                }`}
              />
            )}
            <span className="whitespace-nowrap">{syncLabel}</span>
          </div>
          {canSync && (
            <p className="mt-1.5 text-[10px] text-[#E16428]">Tap to sync now</p>
          )}
          {overallOk && (
            <p className="mt-1.5 text-[10px] text-[#F6E9E9]/45">All systems connected</p>
          )}
        </div>
      )}
    </div>
  );
};
