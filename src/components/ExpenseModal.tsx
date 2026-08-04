import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, ChevronDown, ImagePlus } from 'lucide-react';
import { Listbox } from '@headlessui/react';
import RepeatOnIcon from '@mui/icons-material/RepeatOn';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import {
  Expense,
  ExpenseBillingCycle,
  ExpenseCategory,
  ExpenseStatus,
  ExpenseType,
} from '../types';
import { UnderlineDatePicker } from './UnderlineDatePicker';

const CATEGORIES: ExpenseCategory[] = [
  'AI Tools',
  'Marketing',
  'Print',
  'Software',
  'Office',
  'Other',
];

export type ExpenseFormData = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

export type ExpenseSaveExtras = {
  imageFile?: File | null;
  removeImage?: boolean;
};

interface ExpenseModalProps {
  expense: Expense | null;
  onClose: () => void;
  onSave: (data: ExpenseFormData, extras?: ExpenseSaveExtras) => void | Promise<void>;
  saving?: boolean;
}

function addBillingPeriod(dateStr: string, cycle: ExpenseBillingCycle): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (cycle === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatAmountDisplay(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatAmountWhileTyping(rawWithoutCommas: string): string {
  if (rawWithoutCommas === '') return '';
  if (rawWithoutCommas.endsWith('.')) {
    const intPart = rawWithoutCommas.slice(0, -1);
    const formatted = intPart === '' ? '0' : Number(intPart).toLocaleString('en-US');
    return `${formatted}.`;
  }
  if (rawWithoutCommas.includes('.')) {
    const [intPart, decPart] = rawWithoutCommas.split('.');
    return `${Number(intPart || '0').toLocaleString('en-US')}.${decPart}`;
  }
  return Number(rawWithoutCommas).toLocaleString('en-US');
}

const emptyForm = (): ExpenseFormData => ({
  name: '',
  account: '',
  amount: 0,
  category: 'AI Tools',
  type: 'subscription',
  billingCycle: 'monthly',
  startDate: todayISO(),
  nextRenewalDate: addBillingPeriod(todayISO(), 'monthly'),
  expenseDate: todayISO(),
  reminderDaysBefore: 5,
  status: 'active',
  notes: '',
  paymentMethod: 'Card',
  imageUrl: null,
});

const fieldClass =
  "underline-field w-full px-0 py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter'] transition-[border-color]";
const labelClass =
  "block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']";

const iconIdle =
  'bg-transparent text-[#F6E9E9]/50 border-[#E16428]/20 hover:border-[#E16428]/40 hover:text-[#F6E9E9]/80';
const iconDisabled =
  'bg-transparent text-[#F6E9E9]/25 border-[#E16428]/10 opacity-40 cursor-not-allowed';

const iconBtnClass = (active: boolean, activeClass: string, disabled = false) =>
  `aspect-square w-full flex items-center justify-center rounded-md border transition-colors ${
    disabled ? iconDisabled : active ? activeClass : iconIdle
  }`;

function statusLabel(status: ExpenseStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  expense,
  onClose,
  onSave,
  saving = false,
}) => {
  const [formData, setFormData] = useState<ExpenseFormData>(emptyForm);
  const [amountDisplay, setAmountDisplay] = useState('');
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        account: expense.account || '',
        amount: expense.amount,
        category: expense.category,
        type: expense.type,
        billingCycle: expense.billingCycle,
        startDate: expense.startDate,
        nextRenewalDate: expense.nextRenewalDate,
        expenseDate: expense.expenseDate,
        reminderDaysBefore: expense.reminderDaysBefore ?? 5,
        status: expense.status,
        notes: expense.notes || '',
        paymentMethod: expense.paymentMethod || '',
        imageUrl: expense.imageUrl || null,
      });
      setAmountDisplay(formatAmountDisplay(expense.amount));
      setImagePreview(expense.imageUrl || null);
    } else {
      setFormData(emptyForm());
      setAmountDisplay('');
      setImagePreview(null);
    }
    setImageFile(null);
    setRemoveImage(false);
    setError('');
  }, [expense]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  const setType = (type: ExpenseType) => {
    setFormData(prev => {
      if (type === 'subscription') {
        const start = prev.startDate || todayISO();
        const cycle: ExpenseBillingCycle = prev.billingCycle || 'monthly';
        return {
          ...prev,
          type,
          billingCycle: cycle,
          startDate: start,
          nextRenewalDate: prev.nextRenewalDate || addBillingPeriod(start, cycle),
          status: prev.status === 'paid' ? 'active' : prev.status,
        };
      }
      return {
        ...prev,
        type,
        billingCycle: null,
        startDate: null,
        nextRenewalDate: null,
        expenseDate: prev.expenseDate || todayISO(),
        status: prev.status === 'active' || prev.status === 'paused' ? 'paid' : prev.status,
      };
    });
  };

  const handleStartDateChange = (startDate: string) => {
    setFormData(prev => {
      const cycle = prev.billingCycle || 'monthly';
      return {
        ...prev,
        startDate,
        nextRenewalDate: startDate ? addBillingPeriod(startDate, cycle) : prev.nextRenewalDate,
      };
    });
  };

  const handleBillingCycleChange = (billingCycle: ExpenseBillingCycle) => {
    setFormData(prev => {
      if (prev.type !== 'subscription') {
        const start = prev.startDate || todayISO();
        return {
          ...prev,
          type: 'subscription',
          billingCycle,
          startDate: start,
          nextRenewalDate: addBillingPeriod(start, billingCycle),
          status: prev.status === 'paid' ? 'active' : prev.status,
        };
      }
      const start = prev.startDate || todayISO();
      return {
        ...prev,
        billingCycle,
        nextRenewalDate: addBillingPeriod(start, billingCycle),
      };
    });
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB');
      return;
    }
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
    setError('');
  };

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    setFormData(prev => ({ ...prev, imageUrl: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!Number.isFinite(formData.amount) || formData.amount < 0) {
      setError('Enter a valid amount');
      return;
    }
    if (formData.type === 'subscription') {
      if (!formData.startDate) {
        setError('Subscribed date is required');
        return;
      }
      if (!formData.nextRenewalDate) {
        setError('Next renewal date is required');
        return;
      }
    } else if (!formData.expenseDate) {
      setError('Expense date is required');
      return;
    }

    await onSave(
      {
        ...formData,
        name: formData.name.trim(),
        account: formData.account.trim(),
        notes: formData.notes.trim(),
        paymentMethod: formData.paymentMethod.trim(),
        billingCycle: formData.type === 'subscription' ? formData.billingCycle || 'monthly' : null,
        startDate: formData.type === 'subscription' ? formData.startDate : null,
        nextRenewalDate: formData.type === 'subscription' ? formData.nextRenewalDate : null,
        expenseDate: formData.type === 'one_time' ? formData.expenseDate : null,
        reminderDaysBefore:
          formData.type === 'subscription' ? Math.max(0, formData.reminderDaysBefore || 5) : 0,
        imageUrl: removeImage ? null : formData.imageUrl,
      },
      {
        imageFile: imageFile || null,
        removeImage,
      }
    );
  };

  const statusOptions: ExpenseStatus[] =
    formData.type === 'subscription'
      ? ['active', 'paused', 'cancelled']
      : ['paid', 'cancelled'];

  const isSub = formData.type === 'subscription';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 z-[9999] animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="relative bg-[#272121] border border-[#E16428]/25 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto animate-scaleIn"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E16428]/15 bg-[#272121]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo_ogo.png"
              alt="OGO"
              className="w-7 h-7 object-contain flex-shrink-0"
            />
            <h2 className="text-sm font-semibold text-[#F6E9E9] font-['Poppins'] truncate">
              {expense ? 'Edit Expense' : 'Add Expense'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            title="Close"
            aria-label="Close"
            className="size-7 min-w-7 min-h-7 max-w-7 max-h-7 flex-none box-border p-0 inline-flex items-center justify-center rounded-md text-[#F6E9E9]/60 hover:text-[#F6E9E9] hover:bg-[#E16428]/15 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Name + logo (same row) */}
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className={labelClass}>
                Name <span className="text-[#E16428]">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Cursor AI, FB Marketing…"
                className={fieldClass}
                required
              />
            </div>
            <div className="relative shrink-0 pb-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="relative w-11 h-11 rounded-lg border border-[#E16428]/30 bg-[#1a1818] overflow-hidden flex items-center justify-center hover:border-[#E16428]/55 transition-colors disabled:opacity-50"
                title={imagePreview ? 'Change logo' : 'Upload logo'}
                aria-label={imagePreview ? 'Change logo' : 'Upload logo'}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-[#F6E9E9]/40" />
                )}
              </button>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={saving}
                  title="Remove logo"
                  aria-label="Remove logo"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#272121] border border-red-400/40 text-red-400 flex items-center justify-center hover:bg-red-500/20 disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleImagePick}
              />
            </div>
          </div>

          {/* Account username / email */}
          <div>
            <label className={labelClass}>Account (username / email)</label>
            <input
              type="text"
              value={formData.account}
              onChange={e => setFormData({ ...formData, account: e.target.value })}
              placeholder="e.g. you@company.com or @username"
              className={fieldClass}
              autoComplete="username"
            />
          </div>

          {/* Amount */}
          <div>
            <label className={labelClass}>
              Amount (LKR) <span className="text-[#E16428]">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountDisplay}
              onChange={e => {
                const rawValue = e.target.value;
                const withoutCommas = rawValue.replace(/,/g, '').trim();
                if (withoutCommas === '') {
                  setAmountDisplay('');
                  setFormData({ ...formData, amount: 0 });
                  return;
                }
                if (!/^\d*\.?\d{0,2}$/.test(withoutCommas)) return;
                setFormData({ ...formData, amount: parseFloat(withoutCommas) || 0 });
                setAmountDisplay(formatAmountWhileTyping(withoutCommas));
              }}
              onBlur={() => {
                setAmountDisplay(formatAmountDisplay(formData.amount));
              }}
              placeholder="0"
              className={fieldClass}
              required
            />
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className={labelClass}>Category</label>
              <Listbox
                value={formData.category}
                onChange={(category: ExpenseCategory) =>
                  setFormData({ ...formData, category })
                }
              >
                <div className="relative">
                  <Listbox.Button
                    className={`${fieldClass} flex justify-between items-center text-left`}
                  >
                    <span className="truncate">{formData.category}</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-1 text-[#E16428] flex-shrink-0" />
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-40 mt-1 w-full bg-[#232021] border border-[#E16428]/30 rounded-lg shadow-xl max-h-48 overflow-auto">
                    {CATEGORIES.map(c => (
                      <Listbox.Option
                        key={c}
                        value={c}
                        className={({ active, selected }) =>
                          `px-3 py-2 text-xs font-['Inter'] cursor-pointer flex items-center justify-between ${
                            active ? 'bg-[#E16428]/15 text-[#F6E9E9]' : 'text-[#F6E9E9]/80'
                          } ${selected ? 'text-[#E16428]' : ''}`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span>{c}</span>
                            {selected ? <Check className="w-3 h-3 text-[#E16428]" /> : null}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>

            <div className="relative">
              <label className={labelClass}>Status</label>
              <Listbox
                value={formData.status}
                onChange={(status: ExpenseStatus) => setFormData({ ...formData, status })}
              >
                <div className="relative">
                  <Listbox.Button
                    className={`${fieldClass} flex justify-between items-center text-left`}
                  >
                    <span className="truncate">{statusLabel(formData.status)}</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-1 text-[#E16428] flex-shrink-0" />
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-40 mt-1 w-full bg-[#232021] border border-[#E16428]/30 rounded-lg shadow-xl max-h-48 overflow-auto">
                    {statusOptions.map(s => (
                      <Listbox.Option
                        key={s}
                        value={s}
                        className={({ active, selected }) =>
                          `px-3 py-2 text-xs font-['Inter'] cursor-pointer flex items-center justify-between ${
                            active ? 'bg-[#E16428]/15 text-[#F6E9E9]' : 'text-[#F6E9E9]/80'
                          } ${selected ? 'text-[#E16428]' : ''}`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span>{statusLabel(s)}</span>
                            {selected ? <Check className="w-3 h-3 text-[#E16428]" /> : null}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>
          </div>

          {isSub ? (
            <>
              <div>
                <label className={labelClass}>Remind (days before)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.reminderDaysBefore}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    setFormData({
                      ...formData,
                      reminderDaysBefore: raw === '' ? 0 : Math.min(30, parseInt(raw, 10) || 0),
                    });
                  }}
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <UnderlineDatePicker
                  label="Subscribed"
                  value={formData.startDate || ''}
                  onChange={handleStartDateChange}
                  required
                />
                <UnderlineDatePicker
                  label="Next renewal"
                  value={formData.nextRenewalDate || ''}
                  onChange={iso => setFormData({ ...formData, nextRenewalDate: iso })}
                  required
                />
              </div>
            </>
          ) : (
            <UnderlineDatePicker
              label="Expense date"
              value={formData.expenseDate || ''}
              onChange={iso => setFormData({ ...formData, expenseDate: iso })}
              required
            />
          )}

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optional…"
              className={`${fieldClass} resize-none`}
            />
          </div>

          {error && <p className="text-red-400 text-[10px] font-['Inter']">{error}</p>}

          {/* Type / cycle / payment / save — colored icon row */}
          <div>
            <label className={labelClass}>Type · cycle · payment</label>
            <div className="grid grid-cols-7 gap-1">
              <button
                type="button"
                onClick={() => setType('subscription')}
                title="Subscription"
                aria-label="Subscription"
                aria-pressed={isSub}
                className={iconBtnClass(
                  isSub,
                  'bg-blue-500/20 text-blue-300 border-blue-500/40'
                )}
              >
                <RepeatOnIcon sx={{ fontSize: 18 }} />
              </button>

              <button
                type="button"
                onClick={() => setType('one_time')}
                title="One-time"
                aria-label="One-time"
                aria-pressed={!isSub}
                className={iconBtnClass(
                  !isSub,
                  'bg-purple-500/20 text-purple-300 border-purple-500/40'
                )}
              >
                <RepeatOneIcon sx={{ fontSize: 18 }} />
              </button>

              <button
                type="button"
                onClick={() => handleBillingCycleChange('monthly')}
                title="Monthly"
                aria-label="Monthly"
                aria-pressed={isSub && formData.billingCycle === 'monthly'}
                disabled={!isSub}
                className={iconBtnClass(
                  isSub && formData.billingCycle === 'monthly',
                  'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
                  !isSub
                )}
              >
                <CalendarTodayIcon sx={{ fontSize: 18 }} />
              </button>

              <button
                type="button"
                onClick={() => handleBillingCycleChange('yearly')}
                title="Yearly"
                aria-label="Yearly"
                aria-pressed={isSub && formData.billingCycle === 'yearly'}
                disabled={!isSub}
                className={iconBtnClass(
                  isSub && formData.billingCycle === 'yearly',
                  'bg-green-500/20 text-green-300 border-green-500/40',
                  !isSub
                )}
              >
                <CalendarViewMonthIcon sx={{ fontSize: 18 }} />
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'Card' })}
                title="Card"
                aria-label="Card"
                aria-pressed={formData.paymentMethod === 'Card'}
                className={iconBtnClass(
                  formData.paymentMethod === 'Card',
                  'bg-sky-500/20 text-sky-300 border-sky-500/40'
                )}
              >
                <CreditCardIcon sx={{ fontSize: 18 }} />
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'Bank' })}
                title="Bank"
                aria-label="Bank"
                aria-pressed={formData.paymentMethod === 'Bank'}
                className={iconBtnClass(
                  formData.paymentMethod === 'Bank',
                  'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                )}
              >
                <AccountBalanceIcon sx={{ fontSize: 18 }} />
              </button>

              <button
                type="submit"
                disabled={saving}
                title={expense ? 'Update expense' : 'Add expense'}
                aria-label={expense ? 'Update expense' : 'Add expense'}
                className="aspect-square w-full flex items-center justify-center rounded-md border border-[#E16428]/50 bg-[#E16428] text-white hover:bg-[#E16428]/90 transition-colors disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {saving && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-[#272121]/85 backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 text-[#E16428] animate-spin" />
            <p className="mt-3 text-xs font-semibold text-[#F6E9E9] font-['Poppins']">
              {expense ? 'Updating expense…' : 'Adding expense…'}
            </p>
            <p className="mt-1 text-[10px] text-[#F6E9E9]/45 font-['Inter']">Please wait…</p>
          </div>
        )}
      </form>
    </div>,
    document.body
  );
};
