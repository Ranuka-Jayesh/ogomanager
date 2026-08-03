import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { X, CalendarDays } from 'lucide-react';
import { Project } from '../types';
import { MonthYearNavigator } from './MonthYearNavigator';
import { useLastRefresh } from '../contexts/LastRefreshContext';

interface CalendarProps {
  projects: Project[];
  onRefresh?: () => void;
}

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getGridStart = (date: Date) => {
  const first = startOfMonth(date);
  const day = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - day);
  gridStart.setHours(0, 0, 0, 0);
  return gridStart;
};

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

type DayEvents = {
  running: Project[];
  pending: Project[];
  overdueRunning: Project[];
  overduePending: Project[];
  other: Project[];
};

const emptyEvents = (): DayEvents => ({
  running: [],
  pending: [],
  overdueRunning: [],
  overduePending: [],
  other: [],
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const statusChip = (status: string) => {
  switch (status) {
    case 'Running':
      return 'bg-blue-500/15 text-blue-300';
    case 'Delivered':
      return 'bg-green-500/15 text-green-300';
    case 'Pending':
      return 'bg-yellow-500/15 text-yellow-300';
    case 'Pending Payment':
      return 'bg-purple-500/15 text-purple-300';
    case 'Correction':
      return 'bg-orange-500/15 text-orange-300';
    case 'Rejected':
      return 'bg-red-500/15 text-red-300';
    default:
      return 'bg-[#F6E9E9]/10 text-[#F6E9E9]/50';
  }
};

type DayBadge = { key: string; label: string; shortLabel: string; className: string };

const buildDayBadges = (events?: DayEvents): DayBadge[] => {
  if (!events) return [];
  const badges: DayBadge[] = [];

  if (events.overdueRunning.length) {
    badges.push({
      key: 'or',
      label: `${events.overdueRunning.length} overdue`,
      shortLabel: `${events.overdueRunning.length} ovd`,
      className: 'bg-red-500/20 text-red-300',
    });
  }
  if (events.overduePending.length) {
    badges.push({
      key: 'op',
      label: `${events.overduePending.length} overdue`,
      shortLabel: `${events.overduePending.length} ovd`,
      className: 'bg-blue-500/20 text-blue-300',
    });
  }
  if (events.pending.length) {
    badges.push({
      key: 'p',
      label: `${events.pending.length} pending`,
      shortLabel: `${events.pending.length} pend`,
      className: 'bg-yellow-500/20 text-yellow-300',
    });
  }
  if (events.running.length) {
    badges.push({
      key: 'r',
      label: `${events.running.length} running`,
      shortLabel: `${events.running.length} run`,
      className: 'bg-[#E16428]/20 text-[#E16428]',
    });
  }
  if (events.other.length) {
    const pendingPay = events.other.filter(p => p.status === 'Pending Payment').length;
    const delivered = events.other.length - pendingPay;
    if (pendingPay > 0 && delivered > 0) {
      badges.push({
        key: 'mix',
        label: `${events.other.length} done`,
        shortLabel: `${events.other.length} done`,
        className: 'bg-purple-500/20 text-purple-300',
      });
    } else if (pendingPay > 0) {
      badges.push({
        key: 'pp',
        label: `${pendingPay} payment`,
        shortLabel: `${pendingPay} pay`,
        className: 'bg-purple-500/20 text-purple-300',
      });
    } else {
      badges.push({
        key: 'd',
        label: `${delivered} delivered`,
        shortLabel: `${delivered} del`,
        className: 'bg-green-500/20 text-green-300',
      });
    }
  }

  return badges;
};

export const Calendar: React.FC<CalendarProps> = ({ projects, onRefresh }) => {
  const { setLastRefresh } = useLastRefresh();
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfMonth(new Date()));
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayKey = formatDateKey(new Date());
  const gridDays = useMemo(() => buildCalendarGrid(anchorDate), [anchorDate]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    years.add(anchorDate.getFullYear());
    projects.forEach(p => {
      if (!p.deadlineDate) return;
      const y = new Date(p.deadlineDate).getFullYear();
      if (Number.isFinite(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projects, anchorDate]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, DayEvents> = {};
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

      if (!map[key]) map[key] = emptyEvents();
      if (isDelivered) map[key].other.push(p);
      else if (isOverdue && p.status === 'Pending') map[key].overduePending.push(p);
      else if (isOverdue && p.status === 'Running') map[key].overdueRunning.push(p);
      else if (isOverdue) map[key].overdueRunning.push(p);
      else if (isRunning) map[key].running.push(p);
      else if (isPending) map[key].pending.push(p);
      else map[key].other.push(p);
    }
    return map;
  }, [projects]);

  const activeProjects = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return projects
      .filter(p => {
        if (!p.deadlineDate || p.status !== 'Running') return false;
        const deadline = new Date(p.deadlineDate);
        if (isNaN(deadline.getTime())) return false;
        return deadline <= t;
      })
      .sort((a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime());
  }, [projects]);

  const selectedEvents = useMemo(() => {
    if (!activeDateKey) return emptyEvents();
    return eventsByDate[activeDateKey] || emptyEvents();
  }, [activeDateKey, eventsByDate]);

  const selectedTotal = useMemo(() => {
    const e = selectedEvents;
    return (
      e.overdueRunning.length +
      e.overduePending.length +
      e.pending.length +
      e.running.length +
      e.other.length
    );
  }, [selectedEvents]);

  const busyDate = useMemo(() => {
    let maxProjects = 0;
    let busiestDate = '';
    const currentMonth = anchorDate.getMonth();
    const currentYear = anchorDate.getFullYear();

    Object.entries(eventsByDate).forEach(([dateKey, events]) => {
      const [year, month] = dateKey.split('-').map(Number);
      if (month - 1 !== currentMonth || year !== currentYear) return;
      const totalCount =
        events.running.length +
        events.pending.length +
        events.overdueRunning.length +
        events.overduePending.length +
        events.other.length;
      if (totalCount > maxProjects) {
        maxProjects = totalCount;
        busiestDate = dateKey;
      }
    });

    return { date: busiestDate, count: maxProjects };
  }, [eventsByDate, anchorDate]);

  const monthStats = useMemo(() => {
    let deadlines = 0;
    let overdue = 0;
    const currentMonth = anchorDate.getMonth();
    const currentYear = anchorDate.getFullYear();

    Object.entries(eventsByDate).forEach(([dateKey, events]) => {
      const [year, month] = dateKey.split('-').map(Number);
      if (month - 1 !== currentMonth || year !== currentYear) return;
      deadlines +=
        events.running.length +
        events.pending.length +
        events.overdueRunning.length +
        events.overduePending.length +
        events.other.length;
      overdue += events.overdueRunning.length + events.overduePending.length;
    });

    return { deadlines, overdue, dueNow: activeProjects.length };
  }, [eventsByDate, anchorDate, activeProjects]);

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
  }, [onRefresh, isRefreshing, setLastRefresh]);

  useEffect(() => {
    handleRefresh();
  }, []);

  useEffect(() => {
    const handleFocus = () => handleRefresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleRefresh]);

  useEffect(() => {
    const interval = setInterval(() => handleRefresh(), 30000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDateKey) setActiveDateKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDateKey]);

  const goToday = () => {
    setAnchorDate(startOfMonth(new Date()));
    setActiveDateKey(todayKey);
  };

  const isCurrentMonth = (d: Date) => d.getMonth() === anchorDate.getMonth();

  const dayCount = (events?: DayEvents) => {
    if (!events) return 0;
    return (
      events.overdueRunning.length +
      events.overduePending.length +
      events.pending.length +
      events.running.length +
      events.other.length
    );
  };

  const renderProjectRow = (p: Project, accent?: string) => {
    const overdue =
      p.status === 'Running' &&
      new Date(p.deadlineDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
    return (
      <div
        key={p.id}
        className={`px-3 py-2.5 rounded-lg transition-colors ${
          accent ||
          (overdue
            ? 'bg-red-500/10'
            : 'bg-[#272121]/50 hover:bg-[#272121]/80')
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#F6E9E9] font-['Inter'] truncate">
            {p.projectId}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-['Inter'] ${statusChip(p.status)}`}>
            {p.status}
          </span>
        </div>
        <p className="text-[11px] text-[#F6E9E9]/50 truncate mt-0.5 font-['Inter']">{p.clientName}</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 h-[calc(100dvh-4.75rem)] sm:h-[calc(100dvh-5.75rem)] min-h-0 w-full overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display'] truncate">
            Calendar
          </h1>
          <p className="mt-0.5 text-[11px] sm:text-sm text-[#F6E9E9]/45 font-['Inter'] truncate">
            {monthStats.deadlines} deadlines · {monthStats.overdue} overdue · {monthStats.dueNow} due now
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={goToday}
            className="h-9 px-3 rounded-lg text-xs font-['Poppins'] text-[#E16428] bg-[#E16428]/10 hover:bg-[#E16428]/15 transition-colors"
          >
            Today
          </button>
          <MonthYearNavigator
            selectedMonth={anchorDate.getMonth()}
            selectedYear={anchorDate.getFullYear()}
            availableYears={availableYears}
            allowAll={false}
            onChange={(month, year) => {
              if (month === 'all' || year === 'all') return;
              setAnchorDate(startOfMonth(new Date(year, month, 1)));
            }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] gap-2 sm:gap-3 overflow-hidden">
        {/* Calendar grid */}
        <div className="min-h-0 min-w-0 flex flex-col rounded-2xl bg-[#232021]/50 p-1.5 sm:p-3 overflow-hidden">
          <div className="grid grid-cols-7 shrink-0 mb-1">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className="py-1 sm:py-1.5 text-center text-[10px] sm:text-xs uppercase tracking-wide text-[#F6E9E9]/35 font-['Inter']"
              >
                <span className="sm:hidden">{WEEKDAYS_SHORT[i]}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-7 grid-rows-6 gap-0.5 sm:gap-1">
            {gridDays.map(d => {
              const key = formatDateKey(d);
              const events = eventsByDate[key];
              const inMonth = isCurrentMonth(d);
              const isToday = key === todayKey;
              const isSelected = activeDateKey === key;
              const count = dayCount(events);
              const badges = buildDayBadges(events);
              const visibleBadges = badges.slice(0, 2);
              const extra = badges.length - visibleBadges.length;
              const hasOverdue =
                (events?.overdueRunning.length || 0) + (events?.overduePending.length || 0) > 0;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveDateKey(key)}
                  className={`relative min-h-0 h-full min-w-0 rounded-lg sm:rounded-xl p-1 sm:p-1.5 flex flex-col items-stretch overflow-hidden transition-colors duration-150 text-left ${
                    isSelected
                      ? 'bg-[#E16428]/20 ring-1 ring-[#E16428]/50'
                      : isToday
                      ? 'bg-[#E16428]/12 ring-1 ring-[#E16428]/30'
                      : inMonth
                      ? 'bg-[#272121]/55 hover:bg-[#272121]/85'
                      : 'bg-transparent opacity-35'
                  } ${hasOverdue && inMonth && !isSelected ? 'ring-1 ring-red-500/25' : ''}`}
                >
                  <div className="flex items-center justify-between gap-0.5 shrink-0">
                    <span
                      className={`text-[10px] sm:text-xs font-['Inter'] leading-none ${
                        isToday
                          ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#E16428] text-white flex items-center justify-center font-semibold'
                          : inMonth
                          ? 'text-[#F6E9E9]/85'
                          : 'text-[#F6E9E9]/35'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {count > 0 && (
                      <span className="text-[8px] text-[#F6E9E9]/35 font-['Inter'] md:hidden">
                        {count}
                      </span>
                    )}
                  </div>

                  {count > 0 && (
                    <div className="mt-0.5 sm:mt-1 flex-1 min-h-0 flex flex-col gap-0.5 overflow-hidden">
                      {visibleBadges.map(badge => (
                        <span
                          key={badge.key}
                          className={`block w-full truncate text-[7px] sm:text-[9px] md:text-[10px] leading-tight px-0.5 sm:px-1 py-0.5 rounded font-['Inter'] ${badge.className}`}
                        >
                          <span className="sm:hidden">{badge.shortLabel}</span>
                          <span className="hidden sm:inline">{badge.label}</span>
                        </span>
                      ))}
                      {extra > 0 && (
                        <span className="hidden md:block text-[9px] text-[#F6E9E9]/40 px-0.5 font-['Inter']">
                          +{extra} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-[#E16428]/10 hidden sm:flex flex-wrap items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-['Inter'] shrink-0">
            {[
              { label: 'Overdue', className: 'bg-red-500/20 text-red-300' },
              { label: 'Pending', className: 'bg-yellow-500/20 text-yellow-300' },
              { label: 'Running', className: 'bg-[#E16428]/20 text-[#E16428]' },
              { label: 'Delivered', className: 'bg-green-500/20 text-green-300' },
              { label: 'Payment', className: 'bg-purple-500/20 text-purple-300' },
            ].map(item => (
              <span key={item.label} className={`px-1.5 py-0.5 rounded ${item.className}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Side panel — compact strip on mobile so the grid keeps most of the viewport */}
        <div className="min-h-0 min-w-0 grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3 shrink-0 lg:shrink lg:overflow-y-auto content-start">
          <div className="rounded-2xl bg-[#232021]/50 p-3 sm:p-4 min-w-0">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <CalendarDays className="w-4 h-4 text-[#E16428] shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-[#F6E9E9] font-['Poppins'] truncate">
                Busiest day
              </h3>
            </div>
            {busyDate.count > 0 ? (
              <button
                type="button"
                onClick={() => setActiveDateKey(busyDate.date)}
                className="w-full text-left rounded-xl bg-[#E16428]/10 px-3 py-2.5 sm:py-3 hover:bg-[#E16428]/15 transition-colors"
              >
                <p className="text-xl sm:text-2xl font-bold text-[#E16428] font-['Poppins'] leading-none">
                  {busyDate.count}
                </p>
                <p className="text-[11px] sm:text-xs text-[#F6E9E9]/55 mt-1.5 font-['Inter'] truncate">
                  {new Date(busyDate.date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </button>
            ) : (
              <p className="text-xs text-[#F6E9E9]/40 font-['Inter']">No deadlines this month.</p>
            )}
          </div>

          <div className="rounded-2xl bg-[#232021]/50 p-3 sm:p-4 flex flex-col min-h-0 min-w-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3 shrink-0">
              <h3 className="text-xs sm:text-sm font-semibold text-[#F6E9E9] font-['Poppins']">Due now</h3>
              <span className="text-[10px] text-[#F6E9E9]/40 font-['Inter']">
                {activeProjects.length}
              </span>
            </div>
            {activeProjects.length === 0 ? (
              <p className="text-[11px] sm:text-xs text-[#F6E9E9]/40 font-['Inter'] py-4 sm:py-6 text-center">
                Nothing overdue or due today
              </p>
            ) : (
              <div className="space-y-2 flex-1 min-h-0 overflow-y-auto max-h-28 lg:max-h-none">
                {activeProjects.map(p => renderProjectRow(p))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      {activeDateKey && (
        <div
          className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
          onClick={() => setActiveDateKey(null)}
        >
          <div
            className="bg-[#272121] border border-[#E16428]/20 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E16428]/15 bg-[#272121]/95 backdrop-blur-sm">
              <div>
                <h3 className="text-base font-semibold text-[#F6E9E9] font-['Poppins']">
                  {new Date(activeDateKey + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
                <p className="text-[11px] text-[#F6E9E9]/45 font-['Inter']">
                  {selectedTotal} project{selectedTotal === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDateKey(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#F6E9E9]/50 hover:text-[#F6E9E9] hover:bg-[#E16428]/15 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-64px)]">
              {selectedTotal === 0 ? (
                <p className="py-10 text-center text-sm text-[#F6E9E9]/40 font-['Inter']">
                  No deadlines on this day
                </p>
              ) : (
                <>
                  {selectedEvents.overdueRunning.length > 0 && (
                    <section>
                      <p className="text-[10px] uppercase tracking-wide text-red-300/80 mb-2 font-['Inter']">
                        Overdue · {selectedEvents.overdueRunning.length}
                      </p>
                      <div className="space-y-2">
                        {selectedEvents.overdueRunning.map(p =>
                          renderProjectRow(p, 'bg-red-500/10')
                        )}
                      </div>
                    </section>
                  )}
                  {selectedEvents.overduePending.length > 0 && (
                    <section>
                      <p className="text-[10px] uppercase tracking-wide text-blue-300/80 mb-2 font-['Inter']">
                        Overdue pending · {selectedEvents.overduePending.length}
                      </p>
                      <div className="space-y-2">
                        {selectedEvents.overduePending.map(p =>
                          renderProjectRow(p, 'bg-blue-500/10')
                        )}
                      </div>
                    </section>
                  )}
                  {selectedEvents.running.length > 0 && (
                    <section>
                      <p className="text-[10px] uppercase tracking-wide text-[#E16428]/80 mb-2 font-['Inter']">
                        Running · {selectedEvents.running.length}
                      </p>
                      <div className="space-y-2">
                        {selectedEvents.running.map(p => renderProjectRow(p))}
                      </div>
                    </section>
                  )}
                  {selectedEvents.pending.length > 0 && (
                    <section>
                      <p className="text-[10px] uppercase tracking-wide text-yellow-300/80 mb-2 font-['Inter']">
                        Pending · {selectedEvents.pending.length}
                      </p>
                      <div className="space-y-2">
                        {selectedEvents.pending.map(p =>
                          renderProjectRow(p, 'bg-yellow-500/10')
                        )}
                      </div>
                    </section>
                  )}
                  {selectedEvents.other.length > 0 && (
                    <section>
                      <p className="text-[10px] uppercase tracking-wide text-green-300/80 mb-2 font-['Inter']">
                        Done · {selectedEvents.other.length}
                      </p>
                      <div className="space-y-2">
                        {selectedEvents.other.map(p => renderProjectRow(p))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
