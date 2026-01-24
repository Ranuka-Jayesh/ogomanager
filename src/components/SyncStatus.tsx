/**
 * Sync Status Component
 * Displays online/offline status and pending sync operations
 */

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncStatusProps {
  isOnline: boolean;
  pendingChanges: number;
  onSync: () => Promise<boolean>;
  isSyncing?: boolean;
  lastSyncTime?: number | null;
  showDetails?: boolean;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  isOnline,
  pendingChanges,
  onSync,
  isSyncing = false,
  lastSyncTime,
  showDetails = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [recentlySynced, setRecentlySynced] = useState(false);

  // Show "synced" animation briefly after successful sync
  useEffect(() => {
    if (lastSyncTime && pendingChanges === 0) {
      setRecentlySynced(true);
      const timeout = setTimeout(() => setRecentlySynced(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [lastSyncTime, pendingChanges]);

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        bg: 'bg-red-500/15',
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: CloudOff,
        label: 'Offline',
        description: 'Changes will sync when online',
      };
    }

    if (isSyncing) {
      return {
        bg: 'bg-blue-500/15',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        icon: RefreshCw,
        label: 'Syncing...',
        description: 'Synchronizing with server',
      };
    }

    if (pendingChanges > 0) {
      return {
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: AlertCircle,
        label: `${pendingChanges} pending`,
        description: 'Click to sync now',
      };
    }

    if (recentlySynced) {
      return {
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: Check,
        label: 'Synced!',
        description: 'All changes saved',
      };
    }

    return {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      icon: Cloud,
      label: 'Online',
      description: 'All changes synced',
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const handleClick = async () => {
    if (isOnline && pendingChanges > 0 && !isSyncing) {
      await onSync();
    }
  };

  const formatLastSync = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative">
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isSyncing || !isOnline || pendingChanges === 0}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200 border
          ${config.bg} ${config.border} ${config.text}
          ${isOnline && pendingChanges > 0 && !isSyncing ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
        `}
      >
        <motion.div
          animate={isSyncing ? { rotate: 360 } : {}}
          transition={isSyncing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Icon className="w-4 h-4" />
        </motion.div>

        <span>{config.label}</span>

        {/* Sync button for pending changes */}
        <AnimatePresence>
          {isOnline && pendingChanges > 0 && !isSyncing && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="ml-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full mt-2 right-0 z-50 min-w-[200px]"
          >
            <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm font-medium text-white">
                  {isOnline ? 'Connected' : 'Offline'}
                </span>
              </div>

              <p className="text-xs text-gray-400 mb-2">{config.description}</p>

              {lastSyncTime && (
                <p className="text-xs text-gray-500">
                  Last sync: {formatLastSync(lastSyncTime)}
                </p>
              )}

              {pendingChanges > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} waiting to sync
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact sync indicator for tight spaces
 */
export const SyncIndicator: React.FC<{
  isOnline: boolean;
  pendingChanges: number;
  isSyncing?: boolean;
}> = ({ isOnline, pendingChanges, isSyncing }) => {
  return (
    <div className="flex items-center gap-1">
      <motion.div
        className={`w-2 h-2 rounded-full ${
          !isOnline
            ? 'bg-red-500'
            : isSyncing
            ? 'bg-blue-500'
            : pendingChanges > 0
            ? 'bg-amber-500'
            : 'bg-emerald-500'
        }`}
        animate={isSyncing ? { scale: [1, 1.2, 1] } : {}}
        transition={isSyncing ? { duration: 0.5, repeat: Infinity } : {}}
      />
      {pendingChanges > 0 && (
        <span className="text-xs text-amber-400">{pendingChanges}</span>
      )}
    </div>
  );
};

/**
 * Offline banner for full-width notification
 */
export const OfflineBanner: React.FC<{
  isOnline: boolean;
  pendingChanges: number;
  onSync?: () => void;
}> = ({ isOnline, pendingChanges, onSync }) => {
  if (isOnline && pendingChanges === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`
          w-full px-4 py-2 flex items-center justify-center gap-2 text-sm
          ${!isOnline ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}
        `}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span>You're offline. Changes will sync when you reconnect.</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>{pendingChanges} pending change{pendingChanges !== 1 ? 's' : ''}</span>
            {onSync && (
              <button
                onClick={onSync}
                className="ml-2 px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 transition-colors"
              >
                Sync now
              </button>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
