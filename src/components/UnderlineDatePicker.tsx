import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const fieldClass =
  "underline-field w-full px-0 py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter'] transition-[border-color]";
const labelClass =
  "block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']";

function formatDateLabel(value: string) {
  if (!value) return '';
  const date = new Date(value + 'T00:00:00');
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface UnderlineDatePickerProps {
  label: React.ReactNode;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const UnderlineDatePicker: React.FC<UnderlineDatePickerProps> = ({
  label,
  value,
  onChange,
  required = false,
  placeholder = 'Select date',
  className = '',
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [calView, setCalView] = useState(() => {
    const base = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelW = Math.min(288, Math.max(260, window.innerWidth - 24));
    const panelH = 340;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openDown = spaceBelow >= panelH || spaceBelow >= spaceAbove;

    let top = openDown ? rect.bottom + gap : Math.max(12, rect.top - panelH - gap);
    top = Math.max(12, Math.min(top, window.innerHeight - panelH - 12));
    let left = rect.left;
    left = Math.max(12, Math.min(left, window.innerWidth - panelW - 12));

    setPos({ top, left, width: panelW });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onMove = () => updatePosition();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  const openCalendar = () => {
    const base = value ? new Date(value + 'T00:00:00') : new Date();
    setCalView({ year: base.getFullYear(), month: base.getMonth() });
    updatePosition();
    setOpen(true);
    requestAnimationFrame(() => updatePosition());
  };

  const selectDay = (day: number) => {
    const y = calView.year;
    const m = String(calView.month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  };

  const getCalendarDays = () => {
    const first = new Date(calView.year, calView.month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(calView.year, calView.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const shiftMonth = (delta: number) => {
    setCalView(prev => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      <label className={labelClass}>
        {label}
        {required ? <span className="text-[#E16428]"> *</span> : null}
      </label>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className={`${fieldClass} flex items-center justify-between text-left`}
      >
        <span className={value ? 'text-[#F6E9E9]' : 'text-[#F6E9E9]/35'}>
          {value ? formatDateLabel(value) : placeholder}
        </span>
        <CalendarDays className="w-3.5 h-3.5 text-[#E16428] flex-shrink-0" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[10000] p-3 bg-[#232021] border border-[#E16428]/30 rounded-xl shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#F6E9E9]/70 hover:bg-[#E16428]/15 hover:text-[#E16428]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-[#F6E9E9] font-['Poppins']">
                {new Date(calView.year, calView.month).toLocaleString('default', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#F6E9E9]/70 hover:bg-[#E16428]/15 hover:text-[#E16428]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div
                  key={d}
                  className="text-center text-[9px] text-[#F6E9E9]/40 py-1 font-['Inter']"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {getCalendarDays().map((day, idx) => {
                if (day === null) {
                  return <div key={`e-${idx}`} className="aspect-square" />;
                }
                const y = calView.year;
                const m = String(calView.month + 1).padStart(2, '0');
                const d = String(day).padStart(2, '0');
                const iso = `${y}-${m}-${d}`;
                const selected = value === iso;
                const today = new Date();
                const isToday =
                  today.getFullYear() === y &&
                  today.getMonth() === calView.month &&
                  today.getDate() === day;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`aspect-square rounded-md text-[11px] font-['Inter'] transition-colors ${
                      selected
                        ? 'bg-[#E16428] text-white'
                        : isToday
                          ? 'border border-[#E16428]/50 text-[#E16428]'
                          : 'text-[#F6E9E9]/80 hover:bg-[#E16428]/20'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
