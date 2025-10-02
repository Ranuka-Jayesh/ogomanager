import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Project } from '../types';

interface CalendarProps {
  projects: Project[];
  onRefresh?: () => void;
}

// Utility to format a Date as YYYY-MM-DD
const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Clamp to first day of month at midnight
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Get start of calendar grid (Sunday of the first week shown)
const getGridStart = (date: Date) => {
  const first = startOfMonth(date);
  const day = first.getDay(); // 0=Sun
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - day);
  gridStart.setHours(0, 0, 0, 0);
  return gridStart;
};

// Build a 6-week grid (42 days)
const buildCalendarGrid = (anchor: Date) => {
  const start = getGridStart(anchor);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

export const Calendar: React.FC<CalendarProps> = ({ projects, onRefresh }) => {
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfMonth(new Date()));
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Running':
        return 'text-blue-300';
      case 'Delivered':
        return 'text-green-300';
      case 'Pending':
        return 'text-yellow-300';
      case 'Pending Payment':
        return 'text-purple-300';
      case 'Correction':
        return 'text-orange-300';
      case 'Rejected':
        return 'text-red-300';
      default:
        return 'text-[#F6E9E9]/40';
    }
  };

  // Function to get status background and border colors
  const getStatusCardColors = (status: string) => {
    switch (status) {
      case 'Running':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'Delivered':
        return 'bg-green-500/10 border-green-500/30';
      case 'Pending':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'Pending Payment':
        return 'bg-purple-500/10 border-purple-500/30';
      case 'Correction':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'Rejected':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  // Function to get status date color
  const getStatusDateColor = (status: string) => {
    switch (status) {
      case 'Running':
        return 'text-blue-300';
      case 'Delivered':
        return 'text-green-300';
      case 'Pending':
        return 'text-yellow-300';
      case 'Pending Payment':
        return 'text-purple-300';
      case 'Correction':
        return 'text-orange-300';
      case 'Rejected':
        return 'text-red-300';
      default:
        return 'text-[#F6E9E9]/40';
    }
  };

  // Function to get delivered badge colors based on project statuses
  const getDeliveredBadgeColors = (projects: Project[]) => {
    const hasPendingPayment = projects.some(p => p.status === 'Pending Payment');
    const hasDelivered = projects.some(p => p.status === 'Delivered');
    
    if (hasPendingPayment && hasDelivered) {
      // Mixed statuses - use purple for "Pending Payment"
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    } else if (hasPendingPayment) {
      // Only "Pending Payment" - use purple
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    } else {
      // Only "Delivered" - use green
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    }
  };

  const todayKey = formatDateKey(new Date());

  const monthName = anchorDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const gridDays = useMemo(() => buildCalendarGrid(anchorDate), [anchorDate]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, { running: Project[]; pending: Project[]; overdueRunning: Project[]; overduePending: Project[]; other: Project[] }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const p of projects) {
      if (!p.deadlineDate) continue;
      const deadline = new Date(p.deadlineDate);
      if (isNaN(deadline.getTime())) continue;
      deadline.setHours(0, 0, 0, 0);
      const key = formatDateKey(deadline);

      const isDelivered = p.status === 'Delivered' || p.status === 'Pending Payment';
      const isOverdue = !isDelivered && deadline < today;
      const isRunning = p.status === 'Running' && deadline >= today;
      const isPending = p.status === 'Pending' && deadline >= today;

      if (!map[key]) map[key] = { running: [], pending: [], overdueRunning: [], overduePending: [], other: [] };
      if (isDelivered) map[key].other.push(p);
      else if (isOverdue && p.status === 'Pending') map[key].overduePending.push(p);
      else if (isOverdue && p.status === 'Running') map[key].overdueRunning.push(p);
      else if (isOverdue) map[key].overdueRunning.push(p); // Other overdue statuses
      else if (isRunning) map[key].running.push(p);
      else if (isPending) map[key].pending.push(p);
      else map[key].other.push(p);
    }
    return map;
  }, [projects]);

  // Show only Running projects that are due today or overdue
  const activeProjects = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return projects
      .filter(p => {
        if (!p.deadlineDate || p.status !== 'Running') return false;
        const deadline = new Date(p.deadlineDate);
        if (isNaN(deadline.getTime())) return false;
        
        // Only include Running projects that are due today or overdue
        return deadline <= t;
      })
      .sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime());
  }, [projects]);

  const selectedEvents = useMemo(() => {
    if (!activeDateKey) return { running: [], pending: [], overdueRunning: [], overduePending: [], other: [] };
    return eventsByDate[activeDateKey] || { running: [], pending: [], overdueRunning: [], overduePending: [], other: [] };
  }, [activeDateKey, eventsByDate]);

  // Calculate the busiest date (most projects) for the current month
  const busyDate = useMemo(() => {
    let maxProjects = 0;
    let busiestDate = '';
    
    // Get the current month and year from anchorDate
    const currentMonth = anchorDate.getMonth();
    const currentYear = anchorDate.getFullYear();
    
    Object.entries(eventsByDate).forEach(([dateKey, events]) => {
      // Parse the dateKey to check if it's in the current month
      const [year, month, day] = dateKey.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      
      // Only consider dates in the current month
      if (eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear) {
        const totalCount = events.running.length + events.pending.length + events.overdueRunning.length + events.overduePending.length + events.other.length;
        if (totalCount > maxProjects) {
          maxProjects = totalCount;
          busiestDate = dateKey;
        }
      }
    });
    
    return { date: busiestDate, count: maxProjects };
  }, [eventsByDate, anchorDate]);

  // Auto-refresh functionality
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Error refreshing calendar data:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing]);

  // Auto-refresh when component mounts or when navigating to calendar
  useEffect(() => {
    handleRefresh();
  }, []); // Only run on mount

  // Refresh when window gains focus (user returns to the tab)
  useEffect(() => {
    const handleFocus = () => {
      handleRefresh();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleRefresh]);

  // Periodic refresh every 30 seconds when calendar is active
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [handleRefresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDateKey) setActiveDateKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDateKey]);

  const goPrevMonth = () => {
    const d = new Date(anchorDate);
    d.setMonth(anchorDate.getMonth() - 1);
    setAnchorDate(startOfMonth(d));
  };

  const goNextMonth = () => {
    const d = new Date(anchorDate);
    d.setMonth(anchorDate.getMonth() + 1);
    setAnchorDate(startOfMonth(d));
  };



  const isCurrentMonth = (d: Date) => d.getMonth() === anchorDate.getMonth();


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F6E9E9] font-['Playfair_Display']">Calendar</h2>
          <p className="text-xs text-[#F6E9E9]/60">Deadlines for running and overdue projects</p>
          {lastRefresh && (
            <p className="text-[10px] text-[#F6E9E9]/40 mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
              {isRefreshing && <span className="ml-2 text-[#E16428] animate-pulse">Refreshing...</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={goPrevMonth} className="px-2.5 py-1.5 rounded-lg bg-[#1a1818]/70 border border-[#E16428]/30 text-[#F6E9E9] hover:bg-[#E16428]/10 transition text-sm">Prev</button>
          <div className="px-3 py-1.5 rounded-lg bg-[#272121]/70 text-[#F6E9E9] border border-[#E16428]/20 min-w-[140px] text-center text-sm">{monthName}</div>
          <button onClick={goNextMonth} className="px-2.5 py-1.5 rounded-lg bg-[#1a1818]/70 border border-[#E16428]/30 text-[#F6E9E9] hover:bg-[#E16428]/10 transition text-sm">Next</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <div className="grid grid-cols-7 text-[10px] sm:text-xs mb-1.5 text-[#F6E9E9]/60">
            <div className="p-1.5 text-center">Sun</div>
            <div className="p-1.5 text-center">Mon</div>
            <div className="p-1.5 text-center">Tue</div>
            <div className="p-1.5 text-center">Wed</div>
            <div className="p-1.5 text-center">Thu</div>
            <div className="p-1.5 text-center">Fri</div>
            <div className="p-1.5 text-center">Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {gridDays.map((d) => {
              const key = formatDateKey(d);
              const events = eventsByDate[key];
              const inMonth = isCurrentMonth(d);
              const isToday = key === todayKey;
              const hasOverdueRunning = events?.overdueRunning?.length > 0;
              const hasOverduePending = events?.overduePending?.length > 0;
              const hasPending = events?.pending?.length > 0;
              const hasRunning = events?.running?.length > 0;
              const total = (events?.overdueRunning?.length || 0) + (events?.overduePending?.length || 0) + (events?.pending?.length || 0) + (events?.running?.length || 0) + (events?.other?.length || 0);

              return (
                <div
                  key={key}
                  className={`relative h-16 sm:h-20 rounded-lg border transition-all duration-200 p-1.5 flex flex-col cursor-pointer hover:scale-[1.01] hover:border-[#E16428]/40 ${
                    inMonth ? 'bg-[#272121]/60 border-[#E16428]/20' : 'bg-[#1a1818]/40 border-[#E16428]/10 opacity-70'
                  } ${hasOverdueRunning ? 'ring-1 ring-red-500/40' : ''} ${hasOverduePending ? 'ring-1 ring-blue-500/40' : ''} ${isToday ? 'shadow-lg shadow-[#E16428]/20 animate-pulse' : ''}`}
                  onClick={() => setActiveDateKey(key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveDateKey(key);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] sm:text-xs ${inMonth ? 'text-[#F6E9E9]' : 'text-[#F6E9E9]/50'}`}>{d.getDate()}</span>
                    {isToday && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E16428]/20 text-[#E16428] animate-pulse">Today</span>}
                  </div>

                  <div className="mt-0.5 flex-1 overflow-hidden">
                    {events && total > 0 && (
                      <div className="space-y-0.5">
                        {hasOverdueRunning && (
                          <div className="text-[9px] sm:text-[10px] truncate px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                            {events.overdueRunning.length} overdue
                          </div>
                        )}
                        {hasOverduePending && (
                          <div className="text-[9px] sm:text-[10px] truncate px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {events.overduePending.length} overdue pending
                          </div>
                        )}
                        {hasPending && (
                          <div className="text-[9px] sm:text-[10px] truncate px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {events.pending.length} pending
                          </div>
                        )}
                        {hasRunning && (
                          <div className="text-[9px] sm:text-[10px] truncate px-1.5 py-0.5 rounded bg-[#E16428]/15 text-[#E16428] border border-[#E16428]/30">
                            {events.running.length} running
                          </div>
                        )}
                        {events.other.length > 0 && (
                          <div className={`text-[9px] sm:text-[10px] truncate px-1.5 py-0.5 rounded ${getDeliveredBadgeColors(events.other)}`}>
                            {events.other.length} delivered
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3 text-[11px] sm:text-xs text-[#F6E9E9]/70">
            <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/70"></span> Overdue Running</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/70"></span> Overdue Pending</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400/70"></span> Pending</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#E16428]"></span> Running</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400"></span> Delivered</div>
            <div className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400"></span> Pending Payment</div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-3">
          {/* Most Busy Day Statistics */}
          <div className="bg-[#272121]/60 border border-[#E16428]/20 rounded-2xl p-3">
            <h3 className="text-base font-semibold text-[#F6E9E9] mb-2">Most Busy Day</h3>
            {busyDate.count > 0 ? (
              <div className="space-y-2">
                <div className="p-2 rounded-lg bg-[#E16428]/10 border border-[#E16428]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#F6E9E9] font-medium">Most Projects</span>
                    <span className="text-[10px] text-[#E16428] font-bold">{busyDate.count}</span>
                  </div>
                  <div className="text-[11px] text-[#F6E9E9]/60 mt-1">
                    {new Date(busyDate.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[#F6E9E9]/50 text-xs">No projects found.</p>
            )}
            <div className="mt-3 text-[10px] text-[#F6E9E9]/50">Date with most projects.</div>
          </div>

          {/* Running & Due Projects */}
          <div className="bg-[#272121]/60 border border-[#E16428]/20 rounded-2xl p-3">
            <h3 className="text-base font-semibold text-[#F6E9E9] mb-2">Running & Due</h3>
            {activeProjects.length === 0 ? (
              <p className="text-[#F6E9E9]/50 text-xs">No running projects due today or overdue.</p>
            ) : (
              <div className="space-y-1.5 h-[21rem] overflow-auto pr-1">
                {activeProjects.map(p => {
                  const isOverdue = new Date(p.deadlineDate) < new Date();
                  
                  return (
                    <div key={p.id} className={`p-2 rounded-lg border ${
                      isOverdue 
                        ? 'bg-red-500/10 border-red-500/20' 
                        : 'bg-[#E16428]/10 border-[#E16428]/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#F6E9E9] font-medium truncate">{p.projectId || p.clientName}</span>
                        <span className={`text-[10px] ${
                          isOverdue ? 'text-red-300' : 'text-[#E16428]'
                        }`}>{new Date(p.deadlineDate).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[11px] text-[#F6E9E9]/60 truncate">{p.clientName}</div>
                      <div className={`text-[10px] ${getStatusColor(p.status)}`}>Status: {p.status}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 text-[10px] text-[#F6E9E9]/50">Showing Running projects due today or overdue.</div>
          </div>
        </div>
      </div>

      {/* Date Details Modal */}
      {activeDateKey && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setActiveDateKey(null)}>
          <div className="bg-[#272121]/95 border border-[#E16428]/20 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-4 sm:p-5 animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#F6E9E9] font-['Playfair_Display']">{new Date(activeDateKey).toLocaleDateString()}</h3>
                <p className="text-xs text-[#F6E9E9]/60">{(selectedEvents.overdueRunning.length + selectedEvents.overduePending.length + selectedEvents.pending.length + selectedEvents.running.length + selectedEvents.other.length) || 0} tasks</p>
              </div>
              <button className="px-2 py-1.5 text-xs rounded-lg bg-[#1a1818]/70 border border-[#E16428]/30 text-[#F6E9E9] hover:bg-[#E16428]/10 transition" onClick={() => setActiveDateKey(null)}>Close</button>
            </div>

            <div className="space-y-3 max-h-96 overflow-auto pr-1">
              {/* Overdue Running */}
              {selectedEvents.overdueRunning.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-red-300"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/80"></span> Overdue Running ({selectedEvents.overdueRunning.length})</div>
                  <div className="space-y-1.5">
                    {selectedEvents.overdueRunning.map(p => (
                      <div key={p.id} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-[#F6E9E9] font-medium truncate">{p.projectId || p.clientName}</span>
                          <span className="text-[10px] text-red-300">{new Date(p.deadlineDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-[#F6E9E9]/60 truncate">{p.clientName}</div>
                        <div className={`text-[10px] ${getStatusColor(p.status)}`}>Status: {p.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overdue Pending */}
              {selectedEvents.overduePending.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-blue-300"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/80"></span> Overdue Pending ({selectedEvents.overduePending.length})</div>
                  <div className="space-y-1.5">
                    {selectedEvents.overduePending.map(p => (
                      <div key={p.id} className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-[#F6E9E9] font-medium truncate">{p.projectId || p.clientName}</span>
                          <span className="text-[10px] text-blue-300">{new Date(p.deadlineDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-[#F6E9E9]/60 truncate">{p.clientName}</div>
                        <div className={`text-[10px] ${getStatusColor(p.status)}`}>Status: {p.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending */}
              {selectedEvents.pending.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-blue-300"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400/80"></span> Pending ({selectedEvents.pending.length})</div>
                  <div className="space-y-1.5">
                    {selectedEvents.pending.map(p => (
                      <div key={p.id} className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-[#F6E9E9] font-medium truncate">{p.projectId || p.clientName}</span>
                          <span className="text-[10px] text-blue-300">{new Date(p.deadlineDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-[#F6E9E9]/60 truncate">{p.clientName}</div>
                        <div className={`text-[10px] ${getStatusColor(p.status)}`}>Status: {p.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Running */}
              {selectedEvents.running.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-[#E16428]"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#E16428]"></span> Running ({selectedEvents.running.length})</div>
                  <div className="space-y-1.5">
                    {selectedEvents.running.map(p => (
                      <div key={p.id} className="p-2 rounded-lg bg-[#E16428]/10 border border-[#E16428]/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-[#F6E9E9] font-medium truncate">{p.projectId || p.clientName}</span>
                          <span className="text-[10px] text-[#E16428]">{new Date(p.deadlineDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-[#F6E9E9]/60 truncate">{p.clientName}</div>
                        <div className={`text-[10px] ${getStatusColor(p.status)}`}>Status: {p.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivered */}
              {selectedEvents.other.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-green-300"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400"></span> Delivered ({selectedEvents.other.length})</div>
                  <div className="space-y-1.5">
                    {selectedEvents.other.map(p => (
                      <div key={p.id} className={`p-2 rounded-lg ${getStatusCardColors(p.status)}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-[#F6E9E9] font-medium truncate">{p.projectId || p.clientName}</span>
                          <span className={`text-[10px] ${getStatusDateColor(p.status)}`}>{new Date(p.deadlineDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] text-[#F6E9E9]/60 truncate">{p.clientName}</div>
                        <div className={`text-[10px] ${getStatusColor(p.status)}`}>Status: {p.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedEvents.overdueRunning.length + selectedEvents.overduePending.length + selectedEvents.running.length + selectedEvents.other.length) === 0 && (
                <div className="text-center py-6 text-[#F6E9E9]/60 text-sm">No tasks on this day.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
