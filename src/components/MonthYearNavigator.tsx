import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PANEL_W = 256;

export type MonthSelection = number | 'all';
export type YearSelection = number | 'all';

interface MonthYearNavigatorProps {
  selectedMonth: MonthSelection;
  selectedYear: YearSelection;
  onChange: (month: MonthSelection, year: YearSelection) => void;
  /** Years available in the year grid (newest first). Defaults to a ±5 year range. */
  availableYears?: number[];
  /** Show "All months" / "All years" options. Default true. */
  allowAll?: boolean;
  className?: string;
}

export const MonthYearNavigator: React.FC<MonthYearNavigatorProps> = ({
  selectedMonth,
  selectedYear,
  onChange,
  availableYears: availableYearsProp,
  allowAll = true,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pickerView, setPickerView] = useState<'month' | 'year'>('month');
  const [pickerYear, setPickerYear] = useState<YearSelection>(selectedYear);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  const availableYears = useMemo(() => {
    if (availableYearsProp && availableYearsProp.length > 0) {
      return [...availableYearsProp].sort((a, b) => b - a);
    }
    const y = new Date().getFullYear();
    const years: number[] = [];
    for (let i = y + 2; i >= y - 5; i--) years.push(i);
    return years;
  }, [availableYearsProp]);

  const monthYearLabel = useMemo(() => {
    if (selectedMonth === 'all' && selectedYear === 'all') return 'All time';
    if (selectedMonth === 'all' && selectedYear !== 'all') return `All months ${selectedYear}`;
    if (selectedMonth !== 'all' && selectedYear === 'all') {
      const name = new Date(2000, selectedMonth).toLocaleString('default', { month: 'long' });
      return `${name} · All years`;
    }
    return new Date(selectedYear as number, selectedMonth as number).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedMonth, selectedYear]);

  const updatePanelPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(PANEL_W, window.innerWidth - 16);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = rect.bottom + gap;
    setPanelPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    updatePanelPos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePanelPos();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const goPrevMonth = () => {
    if (selectedMonth === 'all' && selectedYear === 'all') {
      const now = new Date();
      onChange(now.getMonth(), now.getFullYear());
      return;
    }
    if (selectedMonth === 'all' && typeof selectedYear === 'number') {
      onChange('all', selectedYear - 1);
      return;
    }
    if (selectedYear === 'all' && typeof selectedMonth === 'number') {
      if (selectedMonth === 0) onChange(11, 'all');
      else onChange(selectedMonth - 1, 'all');
      return;
    }
    if (typeof selectedMonth === 'number' && typeof selectedYear === 'number') {
      if (selectedMonth === 0) onChange(11, selectedYear - 1);
      else onChange(selectedMonth - 1, selectedYear);
    }
  };

  const goNextMonth = () => {
    if (selectedMonth === 'all' && selectedYear === 'all') {
      const now = new Date();
      onChange(now.getMonth(), now.getFullYear());
      return;
    }
    if (selectedMonth === 'all' && typeof selectedYear === 'number') {
      onChange('all', selectedYear + 1);
      return;
    }
    if (selectedYear === 'all' && typeof selectedMonth === 'number') {
      if (selectedMonth === 11) onChange(0, 'all');
      else onChange(selectedMonth + 1, 'all');
      return;
    }
    if (typeof selectedMonth === 'number' && typeof selectedYear === 'number') {
      if (selectedMonth === 11) onChange(0, selectedYear + 1);
      else onChange(selectedMonth + 1, selectedYear);
    }
  };

  const openPicker = () => {
    if (selectedYear === 'all') {
      setPickerYear('all');
    } else if (availableYears.includes(selectedYear)) {
      setPickerYear(selectedYear);
    } else {
      setPickerYear(availableYears[0] ?? selectedYear);
    }
    setPickerView('month');
    setOpen(true);
  };

  const shiftPickerYear = (delta: number) => {
    if (availableYears.length === 0) return;
    if (pickerYear === 'all') {
      setPickerYear(availableYears[0]);
      return;
    }
    const idx = availableYears.indexOf(pickerYear);
    if (idx === -1) {
      setPickerYear(availableYears[0]);
      return;
    }
    const nextIdx = idx - delta;
    if (nextIdx >= 0 && nextIdx < availableYears.length) {
      setPickerYear(availableYears[nextIdx]);
    }
  };

  const pickerYearIdx = typeof pickerYear === 'number' ? availableYears.indexOf(pickerYear) : -1;
  const canPickerPrevYear = pickerYear === 'all' || (pickerYearIdx !== -1 && pickerYearIdx < availableYears.length - 1);
  const canPickerNextYear = pickerYear === 'all' || pickerYearIdx > 0;

  const close = () => {
    setOpen(false);
    setPickerView('month');
  };

  const selectMonth = (month: MonthSelection) => {
    onChange(month, pickerYear);
    close();
  };

  const panel =
    open &&
    panelPos &&
    createPortal(
      <>
        <div className="fixed inset-0 z-[9998]" onClick={close} />
        <div
          className="fixed z-[9999] w-64 max-w-[calc(100vw-16px)] p-3 bg-[#232021] border border-[#E16428]/30 rounded-xl shadow-2xl"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
          {pickerView === 'month' ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => shiftPickerYear(-1)}
                  disabled={!canPickerPrevYear}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-[#F6E9E9]/60 hover:text-[#E16428] transition-colors disabled:opacity-30 disabled:hover:text-[#F6E9E9]/60"
                  aria-label="Previous year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPickerView('year')}
                  className="px-2 h-8 rounded-md text-sm font-semibold text-[#F6E9E9] font-['Poppins'] hover:text-[#E16428] transition-colors"
                  title="Select year"
                  aria-label="Select year"
                >
                  {pickerYear === 'all' ? 'All years' : pickerYear}
                </button>
                <button
                  type="button"
                  onClick={() => shiftPickerYear(1)}
                  disabled={!canPickerNextYear}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-[#F6E9E9]/60 hover:text-[#E16428] transition-colors disabled:opacity-30 disabled:hover:text-[#F6E9E9]/60"
                  aria-label="Next year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {allowAll && (
                <button
                  type="button"
                  onClick={() => selectMonth('all')}
                  className={`w-full h-9 mb-1.5 rounded-lg text-xs font-['Inter'] transition-colors ${
                    selectedMonth === 'all' && selectedYear === pickerYear
                      ? 'bg-[#E16428] text-white'
                      : 'text-[#F6E9E9]/80 hover:text-[#E16428] border border-[#E16428]/20'
                  }`}
                >
                  All months
                </button>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_SHORT.map((label, month) => {
                  const isSelected = selectedMonth === month && selectedYear === pickerYear;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => selectMonth(month)}
                      className={`h-9 rounded-lg text-xs font-['Inter'] transition-colors ${
                        isSelected
                          ? 'bg-[#E16428] text-white'
                          : 'text-[#F6E9E9]/80 hover:text-[#E16428]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center mb-3">
                <span className="text-sm font-semibold text-[#F6E9E9] font-['Poppins']">
                  Select year
                </span>
              </div>
              {allowAll && (
                <button
                  type="button"
                  onClick={() => {
                    setPickerYear('all');
                    setPickerView('month');
                  }}
                  className={`w-full h-9 mb-1.5 rounded-lg text-xs font-['Inter'] transition-colors ${
                    pickerYear === 'all'
                      ? 'bg-[#E16428] text-white'
                      : 'text-[#F6E9E9]/80 hover:text-[#E16428] border border-[#E16428]/20'
                  }`}
                >
                  All years
                </button>
              )}
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {availableYears.map(year => {
                  const isSelected = pickerYear === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        setPickerYear(year);
                        setPickerView('month');
                      }}
                      className={`h-9 rounded-lg text-xs font-['Inter'] transition-colors ${
                        isSelected
                          ? 'bg-[#E16428] text-white'
                          : 'text-[#F6E9E9]/80 hover:text-[#E16428]'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </>,
      document.body
    );

  return (
    <div ref={rootRef} className={`relative flex-1 sm:flex-none ${className}`}>
      <div className="flex items-center rounded-lg bg-[#232021]/80 overflow-hidden">
        <button
          type="button"
          onClick={goPrevMonth}
          className="w-9 h-9 flex items-center justify-center text-[#F6E9E9]/60 hover:text-[#E16428] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={openPicker}
          className="flex-1 sm:flex-none px-2 sm:px-3 h-9 min-w-0 sm:min-w-[132px] flex items-center justify-center text-xs sm:text-sm text-[#F6E9E9] font-['Poppins'] truncate hover:text-[#E16428] transition-colors"
          title="Select month & year"
          aria-label="Select month and year"
          aria-expanded={open}
        >
          {monthYearLabel}
        </button>
        <button
          type="button"
          onClick={goNextMonth}
          className="w-9 h-9 flex items-center justify-center text-[#F6E9E9]/60 hover:text-[#E16428] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {panel}
    </div>
  );
};
