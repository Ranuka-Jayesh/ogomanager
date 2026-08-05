import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Bell,
  RefreshCw,
  Wallet,
  Repeat,
  Receipt,
  AlertTriangle,
  ImageIcon,
} from 'lucide-react';
import { Expense, ExpenseBillingCycle } from '../types';
import { GlassCard } from './GlassCard';
import { MonthYearNavigator, MonthSelection, YearSelection } from './MonthYearNavigator';
import { ExpenseModal, ExpenseFormData } from './ExpenseModal';
import { UnderlineDatePicker } from './UnderlineDatePicker';
import { supabase } from '../supabaseClient';
import { useMobileNotifications } from '../hooks/useMobileNotifications';

type FilterTab = 'all' | 'subscription' | 'one_time' | 'due_soon';

const EXPENSE_LOGO_BUCKET = 'expense-logos';

function mapFromDB(row: any): Expense {
  return {
    id: row.id,
    name: row.name,
    account: row.account || '',
    amount: Number(row.amount) || 0,
    category: row.category,
    type: row.type,
    billingCycle: row.billing_cycle,
    startDate: row.start_date,
    nextRenewalDate: row.next_renewal_date,
    expenseDate: row.expense_date,
    reminderDaysBefore: row.reminder_days_before ?? 5,
    status: row.status,
    notes: row.notes || '',
    paymentMethod: row.payment_method || '',
    imageUrl: row.image_url || null,
    productId: row.product_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToDB(data: ExpenseFormData) {
  return {
    name: data.name,
    account: data.account || '',
    amount: data.amount,
    category: data.category,
    type: data.type,
    billing_cycle: data.billingCycle,
    start_date: data.startDate,
    next_renewal_date: data.nextRenewalDate,
    expense_date: data.expenseDate,
    reminder_days_before: data.reminderDaysBefore,
    status: data.status,
    notes: data.notes || '',
    payment_method: data.paymentMethod || '',
    image_url: data.imageUrl || null,
    product_id: data.productId || null,
    updated_at: new Date().toISOString(),
  };
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${EXPENSE_LOGO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
}

async function uploadExpenseLogo(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(EXPENSE_LOGO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(EXPENSE_LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteExpenseLogo(url: string | null | undefined) {
  if (!url) return;
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(EXPENSE_LOGO_BUCKET).remove([path]);
}

function parseLocalDate(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = parseLocalDate(iso);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function addBillingPeriod(dateStr: string, cycle: ExpenseBillingCycle): string {
  const d = parseLocalDate(dateStr);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(amount: number): string {
  return `LKR ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function isDueSoon(expense: Expense): boolean {
  if (expense.type !== 'subscription' || expense.status !== 'active') return false;
  const days = daysUntil(expense.nextRenewalDate);
  if (days === null) return false;
  const window = expense.reminderDaysBefore ?? 5;
  // Include overdue (days < 0) and upcoming within reminder window
  return days <= window;
}

/** Renew only on/after the renewal date — not before. */
function canMarkRenewed(expense: Expense): boolean {
  if (expense.type !== 'subscription' || expense.status !== 'active') return false;
  const days = daysUntil(expense.nextRenewalDate);
  return days !== null && days <= 0;
}

function expenseAnchorDate(expense: Expense): string | null {
  if (expense.type === 'subscription') {
    return expense.startDate || expense.nextRenewalDate;
  }
  return expense.expenseDate || expense.createdAt?.slice(0, 10) || null;
}

/** Year*12 + month index for inclusive range compares. */
function yearMonthKey(iso: string): number {
  const d = parseLocalDate(iso);
  return d.getFullYear() * 12 + d.getMonth();
}

/**
 * Active/paused subscriptions appear in every month from start (subscribed)
 * through next renewal (due) month, inclusive.
 */
function subscriptionCoversPeriod(
  expense: Expense,
  selectedMonth: MonthSelection,
  selectedYear: YearSelection
): boolean {
  if (selectedMonth === 'all' && selectedYear === 'all') return true;

  const startIso = expense.startDate || expense.nextRenewalDate;
  const endIso = expense.nextRenewalDate || expense.startDate;
  if (!startIso) return false;

  let startKey = yearMonthKey(startIso);
  let endKey = yearMonthKey(endIso || startIso);
  if (startKey > endKey) {
    const t = startKey;
    startKey = endKey;
    endKey = t;
  }

  if (selectedYear === 'all') {
    if (selectedMonth === 'all') return true;
    for (let k = startKey; k <= endKey; k++) {
      if (k % 12 === selectedMonth) return true;
    }
    return false;
  }

  if (selectedMonth === 'all') {
    const yearStart = (selectedYear as number) * 12;
    const yearEnd = yearStart + 11;
    return startKey <= yearEnd && endKey >= yearStart;
  }

  const selectedKey = (selectedYear as number) * 12 + (selectedMonth as number);
  return selectedKey >= startKey && selectedKey <= endKey;
}

function expenseDueSortKey(expense: Expense): number {
  const iso =
    expense.type === 'subscription'
      ? expense.nextRenewalDate || expense.startDate
      : expense.expenseDate || expense.createdAt?.slice(0, 10) || null;
  const days = daysUntil(iso);
  // No date → end of list; otherwise soonest / most overdue first
  return days === null ? Number.POSITIVE_INFINITY : days;
}

/** Upcoming / due-soon renewals first (e.g. 5d left), then everything else. */
function compareExpensesByUpcoming(a: Expense, b: Expense): number {
  const aUpcoming = isDueSoon(a);
  const bUpcoming = isDueSoon(b);
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

  // Within upcoming: soonest / overdue first
  if (aUpcoming && bUpcoming) {
    return (
      (daysUntil(a.nextRenewalDate) ?? Number.POSITIVE_INFINITY) -
      (daysUntil(b.nextRenewalDate) ?? Number.POSITIVE_INFINITY)
    );
  }

  // Others: still by due/expense date ascending
  return expenseDueSortKey(a) - expenseDueSortKey(b);
}

export const Expenses: React.FC = () => {
  const { showNotification } = useMobileNotifications();
  const now = new Date();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedMonth, setSelectedMonth] = useState<MonthSelection>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<YearSelection>(now.getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [confirmRenew, setConfirmRenew] = useState<Expense | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewFrom, setRenewFrom] = useState('');
  const [renewTo, setRenewTo] = useState('');
  const [renewAmount, setRenewAmount] = useState('');
  const [renewAccount, setRenewAccount] = useState('');
  const [renewError, setRenewError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [statsSlide, setStatsSlide] = useState(0);
  const statsTouchX = useRef<number | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses((data || []).map(mapFromDB));
    } catch (err: any) {
      console.error('Error loading expenses:', err);
      setLoadError(
        err?.message?.includes('relation') || err?.code === '42P01'
          ? 'Expenses table not found. Run DB/migration_expenses_table.sql in Supabase.'
          : err?.message?.includes('image_url')
            ? 'Run DB/migration_expenses_image.sql in Supabase to enable logos.'
            : err?.message || 'Failed to load expenses'
      );
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  // Mobile stats carousel — one card at a time
  useEffect(() => {
    const interval = setInterval(() => {
      setStatsSlide(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    expenses.forEach(e => {
      if (e.type === 'subscription') {
        if (e.startDate) years.add(parseLocalDate(e.startDate).getFullYear());
        if (e.nextRenewalDate) years.add(parseLocalDate(e.nextRenewalDate).getFullYear());
      } else {
        const d = expenseAnchorDate(e);
        if (!d) return;
        years.add(parseLocalDate(d).getFullYear());
      }
    });
    if (years.size === 0) years.add(now.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses]);

  const inSelectedPeriod = useCallback(
    (expense: Expense) => {
      // Active / paused plans: show in all months from subscribed → due month
      if (
        expense.type === 'subscription' &&
        (expense.status === 'active' || expense.status === 'paused')
      ) {
        return subscriptionCoversPeriod(expense, selectedMonth, selectedYear);
      }

      const d = expenseAnchorDate(expense);
      if (!d) return selectedMonth === 'all' && selectedYear === 'all';
      const date = parseLocalDate(d);
      const monthOk = selectedMonth === 'all' || date.getMonth() === selectedMonth;
      const yearOk = selectedYear === 'all' || date.getFullYear() === selectedYear;
      return monthOk && yearOk;
    },
    [selectedMonth, selectedYear]
  );

  const dueSoonAll = useMemo(
    () =>
      expenses
        .filter(isDueSoon)
        .sort(
          (a, b) =>
            (daysUntil(a.nextRenewalDate) ?? 99) - (daysUntil(b.nextRenewalDate) ?? 99)
        ),
    [expenses]
  );

  const periodExpenses = useMemo(
    () => expenses.filter(inSelectedPeriod),
    [expenses, inSelectedPeriod]
  );

  const filtered = useMemo(() => {
    let list = periodExpenses;
    if (filter === 'subscription') list = list.filter(e => e.type === 'subscription');
    else if (filter === 'one_time') list = list.filter(e => e.type === 'one_time');
    else if (filter === 'due_soon') list = dueSoonAll;
    return [...list].sort(compareExpensesByUpcoming);
  }, [periodExpenses, filter, dueSoonAll]);

  const stats = useMemo(() => {
    const periodTotal = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const activeSubs = expenses.filter(
      e => e.type === 'subscription' && e.status === 'active'
    );
    const monthlyBurn = activeSubs.reduce((sum, e) => {
      if (e.billingCycle === 'yearly') return sum + e.amount / 12;
      return sum + e.amount;
    }, 0);
    return {
      periodTotal,
      activeSubCount: activeSubs.length,
      monthlyBurn,
      dueSoonCount: dueSoonAll.length,
    };
  }, [periodExpenses, expenses, dueSoonAll]);

  const handleSave = async (
    data: ExpenseFormData,
    extras?: { imageFile?: File | null; removeImage?: boolean }
  ) => {
    setSaving(true);
    try {
      let imageUrl = data.imageUrl || null;
      const previousUrl = editing?.imageUrl || null;
      const isCatalogLogo = (url: string | null | undefined) =>
        Boolean(url && url.includes('/expense-logos/') && url.includes('/products/'));

      if (extras?.removeImage) {
        if (previousUrl && !isCatalogLogo(previousUrl)) await deleteExpenseLogo(previousUrl);
        imageUrl = null;
      } else if (extras?.imageFile) {
        imageUrl = await uploadExpenseLogo(extras.imageFile);
        if (previousUrl && previousUrl !== imageUrl && !isCatalogLogo(previousUrl)) {
          await deleteExpenseLogo(previousUrl);
        }
      }

      const payload = mapToDB({ ...data, imageUrl });

      if (editing) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        showNotification(`${data.name} updated`, 'success', {
          title: 'Expenses',
          icon: '/app.png',
        });
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
        showNotification(`${data.name} added`, 'success', {
          title: 'Expenses',
          icon: '/app.png',
        });
      }
      setIsModalOpen(false);
      setEditing(null);
      await fetchExpenses();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      showNotification(err?.message || 'Failed to save expense', 'error', {
        title: 'Expenses',
        icon: '/app.png',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.imageUrl) {
        await deleteExpenseLogo(confirmDelete.imageUrl);
      }
      const { error } = await supabase.from('expenses').delete().eq('id', confirmDelete.id);
      if (error) throw error;
      showNotification(`${confirmDelete.name} deleted`, 'info', {
        title: 'Expenses',
        icon: '/app.png',
      });
      setConfirmDelete(null);
      await fetchExpenses();
    } catch (err: any) {
      console.error('Error deleting expense:', err);
      showNotification(err?.message || 'Failed to delete', 'error', {
        title: 'Expenses',
        icon: '/app.png',
      });
    }
  };

  const openRenewModal = (expense: Expense) => {
    const cycle: ExpenseBillingCycle = expense.billingCycle || 'monthly';
    const from = expense.nextRenewalDate || expense.startDate || new Date().toISOString().slice(0, 10);
    const to = addBillingPeriod(from, cycle);
    setRenewFrom(from);
    setRenewTo(to);
    setRenewAmount(
      Number.isFinite(expense.amount) && expense.amount > 0
        ? expense.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : ''
    );
    setRenewAccount(expense.account || '');
    setRenewError('');
    setConfirmRenew(expense);
  };

  const handleMarkRenewed = async () => {
    if (!confirmRenew) return;
    setRenewError('');

    if (!renewFrom) {
      setRenewError('Renew from date is required');
      return;
    }
    if (!renewTo) {
      setRenewError('Renew to date is required');
      return;
    }
    if (renewTo < renewFrom) {
      setRenewError('Renew to date must be on or after from date');
      return;
    }
    const amountRaw = renewAmount.replace(/,/g, '').trim();
    const amount = parseFloat(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) {
      setRenewError('Enter a valid price');
      return;
    }

    setRenewing(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          start_date: renewFrom,
          next_renewal_date: renewTo,
          amount,
          account: renewAccount.trim(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', confirmRenew.id);
      if (error) throw error;
      showNotification(
        `${confirmRenew.name} renewed · ${formatDate(renewFrom)} → ${formatDate(renewTo)}`,
        'success',
        {
          title: 'Expenses',
          icon: '/app.png',
        }
      );
      setConfirmRenew(null);
      await fetchExpenses();
    } catch (err: any) {
      console.error('Error renewing expense:', err);
      showNotification(err?.message || 'Failed to renew', 'error', {
        title: 'Expenses',
        icon: '/app.png',
      });
    } finally {
      setRenewing(false);
    }
  };

  useEffect(() => {
    if (!confirmRenew && !confirmDelete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmRenew && !renewing) setConfirmRenew(null);
        if (confirmDelete) setConfirmDelete(null);
      }
      // Enter renew handled by form submit only
      if (event.key === 'Enter' && confirmDelete) {
        event.preventDefault();
        void handleDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmRenew, confirmDelete, renewing]);

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: periodExpenses.length },
    {
      id: 'subscription',
      label: 'Subscriptions',
      count: periodExpenses.filter(e => e.type === 'subscription').length,
    },
    {
      id: 'one_time',
      label: 'One-time',
      count: periodExpenses.filter(e => e.type === 'one_time').length,
    },
    { id: 'due_soon', label: 'Due soon', count: dueSoonAll.length },
  ];

  const summarySlides = [
    {
      title: 'Period total',
      value: formatMoney(stats.periodTotal),
      icon: Wallet,
      iconWrap: 'bg-[#E16428]/15 border-[#E16428]/25',
      iconClass: 'text-[#E16428]',
    },
    {
      title: 'Active subs · monthly burn',
      value: `${stats.activeSubCount} · ${formatMoney(Math.round(stats.monthlyBurn))}`,
      icon: Repeat,
      iconWrap: 'bg-[#E16428]/15 border-[#E16428]/25',
      iconClass: 'text-[#E16428]',
    },
    {
      title: 'Due soon',
      value: String(stats.dueSoonCount),
      icon: Bell,
      iconWrap: 'bg-amber-500/15 border-amber-500/25',
      iconClass: 'text-amber-400',
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 pb-24">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F6E9E9] font-['Playfair_Display']">
            Expenses
          </h1>

          {/* Desktop: MonthYear on the right */}
          <div className="hidden sm:flex items-center gap-2">
            <MonthYearNavigator
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onChange={(m, y) => {
                setSelectedMonth(m);
                setSelectedYear(y);
              }}
              availableYears={availableYears}
            />
          </div>
        </div>

        {/* Mobile: MonthYear full width */}
        <div className="sm:hidden">
          <MonthYearNavigator
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChange={(m, y) => {
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
            availableYears={availableYears}
          />
        </div>

        {/* Mobile: filters right under month/year */}
        <div className="sm:hidden flex items-center gap-1 border-b border-[#E16428]/15 overflow-x-auto -mx-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors font-['Inter'] ${
                filter === tab.id
                  ? 'border-[#E16428] text-[#E16428]'
                  : 'border-transparent text-[#F6E9E9]/45 hover:text-[#F6E9E9]'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-[11px] opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary — mobile carousel / desktop 3-col */}
      <div className="sm:hidden">
        <GlassCard
          className="p-4 relative overflow-hidden active:scale-[0.99] transition-transform"
          onClick={() => setStatsSlide(prev => (prev + 1) % summarySlides.length)}
          onTouchStart={e => {
            statsTouchX.current = e.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={e => {
            const startX = statsTouchX.current;
            statsTouchX.current = null;
            if (startX == null) return;
            const endX = e.changedTouches[0]?.clientX ?? startX;
            const delta = endX - startX;
            if (Math.abs(delta) < 40) return;
            e.stopPropagation();
            setStatsSlide(prev =>
              delta < 0
                ? (prev + 1) % summarySlides.length
                : (prev - 1 + summarySlides.length) % summarySlides.length
            );
          }}
        >
          <div className="relative min-h-[52px]">
            {summarySlides.map((slide, idx) => {
              const Icon = slide.icon;
              return (
                <div
                  key={slide.title}
                  className={`flex items-center justify-between gap-3 transition-all duration-300 ease-out ${
                    statsSlide === idx
                      ? 'opacity-100 translate-y-0 relative'
                      : 'opacity-0 absolute inset-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[#F6E9E9]/55 text-xs font-['Inter'] truncate">
                      {slide.title}
                    </p>
                    <p className="text-xl font-bold text-[#F6E9E9] font-['Poppins'] mt-0.5 truncate">
                      {slide.value}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center ${slide.iconWrap}`}
                  >
                    <Icon className={`w-5 h-5 ${slide.iconClass}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <div className="hidden sm:grid sm:grid-cols-3 gap-3">
        {summarySlides.map(slide => {
          const Icon = slide.icon;
          return (
            <GlassCard key={slide.title} className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center ${slide.iconWrap}`}
                >
                  <Icon className={`w-5 h-5 ${slide.iconClass}`} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#F6E9E9]/40 font-['Inter']">
                    {slide.title}
                  </p>
                  <p className="text-lg font-semibold text-[#F6E9E9] font-['Poppins']">
                    {slide.value}
                  </p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Reminder banner */}
      {dueSoonAll.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium font-['Inter']">
              {dueSoonAll.length} subscription{dueSoonAll.length > 1 ? 's' : ''} renewing soon
            </span>
          </div>
          <div className="space-y-1.5">
            {dueSoonAll.slice(0, 4).map(e => {
              const days = daysUntil(e.nextRenewalDate);
              const renewable = canMarkRenewed(e);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm font-['Inter']"
                >
                  <span className="text-[#F6E9E9]/85">
                    <span className="text-[#F6E9E9] font-medium">{e.name}</span>
                    {' · '}
                    {days !== null && days < 0
                      ? `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
                      : days === 0
                        ? 'renews today'
                        : days === 1
                          ? 'renews tomorrow'
                          : `renews in ${days} days`}
                    {' ('}
                    {formatDate(e.nextRenewalDate)}
                    {') · '}
                    {formatMoney(e.amount)}
                  </span>
                  {renewable && (
                    <button
                      type="button"
                      onClick={() => openRenewModal(e)}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-amber-400/40 text-amber-300 hover:bg-amber-500/15 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Mark renewed
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters — desktop (mobile filters sit under month/year) */}
      <div className="hidden sm:flex items-center gap-1 border-b border-[#E16428]/15 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors font-['Inter'] ${
              filter === tab.id
                ? 'border-[#E16428] text-[#E16428]'
                : 'border-transparent text-[#F6E9E9]/45 hover:text-[#F6E9E9]'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[11px] opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 font-['Inter']">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-[#F6E9E9]/40 font-['Inter']">Loading expenses…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#E16428]/20 rounded-2xl">
          <Receipt className="w-10 h-10 mx-auto text-[#E16428]/40 mb-3" />
          <p className="text-[#F6E9E9]/60 font-['Inter']">No expenses here yet</p>
          <p className="mt-1 text-sm text-[#F6E9E9]/35 font-['Inter']">
            Add ChatGPT, Cursor, ads, or one-time costs like print jobs
          </p>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 text-[#E16428] text-sm font-['Inter'] hover:underline"
          >
            <Plus className="w-4 h-4" /> Add first expense
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(expense => {
            const days = daysUntil(expense.nextRenewalDate);
            const due = isDueSoon(expense);
            const renewable = canMarkRenewed(expense);
            return (
              <div
                key={expense.id}
                className={`group relative flex flex-col rounded-xl border transition-colors duration-200 ${
                  due
                    ? 'border-amber-500/35 bg-amber-500/5'
                    : 'border-[#E16428]/15 bg-[#232021]/70 hover:border-[#E16428]/35'
                }`}
              >
                <div className="p-4 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="min-w-0">
                        <h3 className="text-[#F6E9E9] font-medium font-['Inter'] truncate">
                          {expense.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#F6E9E9]/40 font-['Inter'] truncate">
                          {expense.category}
                          {expense.paymentMethod ? ` · ${expense.paymentMethod}` : ''}
                          {expense.account ? ` · ${expense.account}` : ''}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-['Inter'] ${
                            expense.type === 'subscription'
                              ? 'bg-[#E16428]/15 text-[#E16428]'
                              : 'bg-[#F6E9E9]/08 text-[#F6E9E9]/55'
                          }`}
                        >
                          {expense.type === 'subscription'
                            ? expense.billingCycle === 'yearly'
                              ? 'Yearly'
                              : 'Monthly'
                            : 'One-time'}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-['Inter'] ${
                            expense.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : expense.status === 'paused'
                                ? 'bg-amber-500/15 text-amber-400'
                                : expense.status === 'paid'
                                  ? 'bg-sky-500/15 text-sky-400'
                                  : 'bg-[#F6E9E9]/08 text-[#F6E9E9]/40'
                          }`}
                        >
                          {expense.status}
                        </span>
                        {due && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-['Inter']">
                            {days !== null && days < 0
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                                ? 'Today'
                                : `${days}d left`}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-[#E16428] font-semibold font-['Poppins'] text-sm">
                        {formatMoney(expense.amount)}
                      </p>

                      <div className="mt-2 text-xs text-[#F6E9E9]/45 font-['Inter'] space-y-0.5">
                        {expense.type === 'subscription' ? (
                          <>
                            <p>Started {formatDate(expense.startDate)}</p>
                            <p>
                              Next renewal{' '}
                              <span className={due ? 'text-amber-300' : 'text-[#F6E9E9]/70'}>
                                {formatDate(expense.nextRenewalDate)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p>Date {formatDate(expense.expenseDate)}</p>
                        )}
                        {expense.notes ? (
                          <p className="truncate text-[#F6E9E9]/35">{expense.notes}</p>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className={`shrink-0 w-20 h-20 aspect-square rounded-xl border border-[#E16428]/20 overflow-hidden flex items-center justify-center self-center ${
                        expense.imageUrl ? 'bg-white' : 'bg-[#272121]/80'
                      }`}
                    >
                      {expense.imageUrl ? (
                        <img
                          src={expense.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-7 h-7 text-[#F6E9E9]/25" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-t border-[#E16428]/10">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => {
                        setEditing(expense);
                        setIsModalOpen(true);
                      }}
                      className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[#F6E9E9]/45 hover:text-[#E16428] hover:bg-[#E16428]/10 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => setConfirmDelete(expense)}
                      className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-[#F6E9E9]/45 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {renewable && (
                    <button
                      type="button"
                      onClick={() => openRenewModal(expense)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#F6E9E9]/50 hover:text-[#E16428] transition-colors font-['Inter']"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Renewed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <ExpenseModal
          expense={editing}
          onClose={() => {
            setIsModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {confirmRenew &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={() => {
              if (!renewing) setConfirmRenew(null);
            }}
          >
            <form
              className="w-full max-w-md bg-[#272121] border border-[#E16428]/25 rounded-2xl shadow-2xl p-5 sm:p-6 animate-scaleIn"
              onClick={e => e.stopPropagation()}
              onSubmit={e => {
                e.preventDefault();
                void handleMarkRenewed();
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white border border-[#E16428]/20 overflow-hidden flex items-center justify-center shrink-0">
                  {confirmRenew.imageUrl ? (
                    <img
                      src={confirmRenew.imageUrl}
                      alt=""
                      className="w-full h-full object-contain p-0.5"
                    />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-[#E16428]" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
                    Renew subscription
                  </h3>
                  <p className="text-sm text-[#F6E9E9]/55 font-['Inter'] truncate">
                    {confirmRenew.name}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <UnderlineDatePicker
                      label={
                        <>
                          From date <span className="text-[#E16428]">*</span>
                        </>
                      }
                      value={renewFrom}
                      onChange={iso => {
                        setRenewFrom(iso);
                        if (iso && confirmRenew) {
                          setRenewTo(
                            addBillingPeriod(iso, confirmRenew.billingCycle || 'monthly')
                          );
                        }
                      }}
                    />
                  </div>
                  <div>
                    <UnderlineDatePicker
                      label={
                        <>
                          To date <span className="text-[#E16428]">*</span>
                        </>
                      }
                      value={renewTo}
                      onChange={setRenewTo}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']">
                    Price (LKR) <span className="text-[#E16428]">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={renewAmount}
                    disabled={renewing}
                    onChange={e => {
                      const withoutCommas = e.target.value.replace(/,/g, '').trim();
                      if (withoutCommas === '') {
                        setRenewAmount('');
                        return;
                      }
                      if (!/^\d*\.?\d{0,2}$/.test(withoutCommas)) return;
                      if (withoutCommas.endsWith('.')) {
                        const intPart = withoutCommas.slice(0, -1);
                        setRenewAmount(
                          `${intPart === '' ? '0' : Number(intPart).toLocaleString('en-US')}.`
                        );
                        return;
                      }
                      if (withoutCommas.includes('.')) {
                        const [intPart, decPart] = withoutCommas.split('.');
                        setRenewAmount(
                          `${Number(intPart || '0').toLocaleString('en-US')}.${decPart}`
                        );
                        return;
                      }
                      setRenewAmount(Number(withoutCommas).toLocaleString('en-US'));
                    }}
                    placeholder="0"
                    className="underline-field w-full px-0 py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter'] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']">
                    Account (username / email)
                  </label>
                  <input
                    type="text"
                    value={renewAccount}
                    disabled={renewing}
                    onChange={e => setRenewAccount(e.target.value)}
                    placeholder="e.g. you@company.com or @username"
                    autoComplete="username"
                    className="underline-field w-full px-0 py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter'] disabled:opacity-50"
                  />
                </div>

                {renewError && (
                  <p className="text-xs text-red-400 font-['Inter']">{renewError}</p>
                )}
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={renewing}
                  onClick={() => setConfirmRenew(null)}
                  className="sm:flex-1 py-2.5 text-sm text-[#F6E9E9]/55 hover:text-[#F6E9E9] font-['Inter'] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewing}
                  className="sm:flex-1 inline-flex items-center justify-center gap-2 py-2.5 border-0 border-b-2 border-[#E16428]/70 text-sm font-semibold text-[#E16428] hover:text-[#f07a42] hover:border-[#E16428] font-['Inter'] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${renewing ? 'animate-spin' : ''}`} />
                  {renewing ? 'Renewing…' : 'Confirm renew'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {confirmDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="w-full max-w-[280px] p-6 animate-scaleIn text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="relative mx-auto mb-5 h-[4.5rem] w-[4.5rem]">
                <span
                  className="absolute inset-0 rounded-full border border-red-400/25 opacity-60"
                  style={{ animation: 'delete-ring 2.4s ease-out infinite' }}
                />
                <span
                  className="absolute inset-2 rounded-full border border-[#E16428]/20 opacity-50"
                  style={{ animation: 'delete-ring 2.4s ease-out 0.6s infinite' }}
                />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-red-400/40 bg-gradient-to-br from-red-500/15 to-transparent">
                  <Trash2
                    className="h-6 w-6 text-red-400"
                    style={{ animation: 'delete-icon 2.8s ease-in-out infinite' }}
                  />
                </div>
              </div>

              <h3 className="text-2xl font-semibold tracking-tight text-[#F6E9E9] font-['Playfair_Display']">
                Delete expense?
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
                Remove{' '}
                <span className="text-[#E16428] font-medium">{confirmDelete.name}</span>
                {confirmDelete.account ? (
                  <>
                    {' '}
                    <span className="text-[#F6E9E9]/35">· {confirmDelete.account}</span>
                  </>
                ) : null}
                . This can’t be undone.
              </p>

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="group w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-red-500/70 rounded-none bg-transparent text-sm font-semibold text-red-400 hover:text-red-300 hover:border-red-400 transition-all duration-200 font-['Inter'] focus:outline-none"
                >
                  <Trash2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  <span>Yes, delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="w-full py-2.5 border-0 border-b border-transparent rounded-none bg-transparent text-sm text-[#F6E9E9]/50 hover:text-[#F6E9E9] hover:border-[#F6E9E9]/25 transition-all duration-200 font-['Inter'] focus:outline-none"
                >
                  Keep expense
                </button>
              </div>

              <p className="mt-5 text-[10px] tracking-[0.18em] uppercase text-[#F6E9E9]/25 font-['Inter']">
                Esc to keep · Enter to delete
              </p>

              <style>{`
                @keyframes delete-ring {
                  0% { transform: scale(0.85); opacity: 0.55; }
                  70% { transform: scale(1.25); opacity: 0; }
                  100% { transform: scale(1.25); opacity: 0; }
                }
                @keyframes delete-icon {
                  0%, 100% { transform: scale(1) rotate(0deg); }
                  50% { transform: scale(1.08) rotate(-6deg); }
                }
              `}</style>
            </div>
          </div>,
          document.body
        )}

      {!isModalOpen &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setIsModalOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
                title="Add Expense"
                aria-label="Add Expense"
              >
                Add Expense
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
