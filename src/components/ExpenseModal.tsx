import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, ChevronDown, ImagePlus, Package } from 'lucide-react';
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
  ExpenseProduct,
  ExpenseStatus,
  ExpenseType,
} from '../types';
import { UnderlineDatePicker } from './UnderlineDatePicker';
import { supabase } from '../supabaseClient';

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
  productId: null,
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
  const [products, setProducts] = useState<ExpenseProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = saving || isSubmitting;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('expense_products')
          .select('*')
          .order('name', { ascending: true });
        if (cancelled || err || !data) return;
        setProducts(
          data.map((row: any) => ({
            id: row.id,
            name: row.name,
            category: row.category as ExpenseCategory,
            imageUrl: row.image_url || null,
          }))
        );
      } catch {
        /* catalog optional until migration */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        productId: expense.productId || null,
      });
      setAmountDisplay(formatAmountDisplay(expense.amount));
      setImagePreview(expense.imageUrl || null);
      setSelectedProductId(expense.productId || null);
    } else {
      setFormData(emptyForm());
      setAmountDisplay('');
      setImagePreview(null);
      setSelectedProductId(null);
    }
    setImageFile(null);
    setRemoveImage(false);
    setError('');
  }, [expense]);

  const applyProduct = (productId: string | null) => {
    setSelectedProductId(productId);
    if (!productId) {
      setFormData(prev => ({
        ...prev,
        productId: null,
        // keep name/category/image for custom entry
      }));
      return;
    }
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setRemoveImage(false);
    setImagePreview(product.imageUrl);
    setFormData(prev => ({
      ...prev,
      productId: product.id,
      name: product.name,
      category: product.category,
      imageUrl: product.imageUrl,
      type: 'subscription',
      billingCycle: prev.billingCycle || 'monthly',
      startDate: prev.startDate || todayISO(),
      nextRenewalDate:
        prev.nextRenewalDate ||
        addBillingPeriod(prev.startDate || todayISO(), prev.billingCycle || 'monthly'),
      status: prev.status === 'paid' ? 'active' : prev.status,
    }));
  };

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
    if (isBusy) return;
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

    setIsSubmitting(true);
    try {
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
          productId: selectedProductId || formData.productId || null,
        },
        {
          imageFile: imageFile || null,
          removeImage,
        }
      );
    } catch {
      /* parent reports errors */
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: ExpenseStatus[] =
    formData.type === 'subscription'
      ? ['active', 'paused', 'cancelled']
      : ['paid', 'cancelled'];

  const isSub = formData.type === 'subscription';
  const catalogLocked = Boolean(selectedProductId);
  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        aria-busy={isBusy}
        className={`relative flex flex-col bg-[#272121] border border-[#E16428]/25 rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-hidden animate-scaleIn ${
          isBusy ? 'pointer-events-none' : ''
        }`}
      >
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E16428]/15 bg-[#272121] shrink-0">
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
            disabled={isBusy}
            title="Close"
            aria-label="Close"
            className="size-7 min-w-7 min-h-7 max-w-7 max-h-7 flex-none box-border p-0 inline-flex items-center justify-center rounded-md text-[#F6E9E9]/60 hover:text-[#F6E9E9] hover:bg-[#E16428]/15 transition-colors disabled:opacity-40 disabled:pointer-events-none pointer-events-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`px-4 py-3 space-y-3 overflow-y-auto min-h-0 flex-1 ${
            isBusy ? 'overflow-hidden' : ''
          }`}
        >
          {/* Product catalog dropdown */}
          {products.length > 0 && (
            <div>
              <label className={labelClass}>Product</label>
              <Listbox
                value={selectedProductId ?? ''}
                onChange={(id: string) => applyProduct(id || null)}
              >
                <div className="relative">
                  <Listbox.Button className="w-full flex items-center gap-3 px-0 py-2 bg-transparent border-0 border-b border-[#E16428]/30 text-left focus:border-[#E16428] outline-none transition-[border-color]">
                    <div className="w-9 h-9 rounded-lg bg-white border border-[#E16428]/15 overflow-hidden flex items-center justify-center shrink-0">
                      {selectedProduct?.imageUrl || (catalogLocked && imagePreview) ? (
                        <img
                          src={selectedProduct?.imageUrl || imagePreview || ''}
                          alt=""
                          className="w-full h-full object-contain p-0.5"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-[#F6E9E9]/30" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {selectedProduct ? (
                        <>
                          <p className="text-sm text-[#F6E9E9] font-['Inter'] truncate">
                            {selectedProduct.name}
                          </p>
                          <p className="text-[11px] text-[#E16428]/80 font-['Inter'] truncate">
                            {selectedProduct.category}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-[#F6E9E9]/45 font-['Inter']">
                          Select product or custom
                        </p>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#F6E9E9]/40 shrink-0" />
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-lg bg-[#232021] border border-[#E16428]/30 shadow-xl py-1">
                    <Listbox.Option
                      value=""
                      className={({ active }) =>
                        `cursor-pointer px-3 py-2.5 flex items-center gap-3 ${
                          active ? 'bg-[#E16428]/12' : ''
                        }`
                      }
                    >
                      <div className="w-9 h-9 rounded-lg border border-dashed border-[#E16428]/25 flex items-center justify-center shrink-0">
                        <ImagePlus className="w-3.5 h-3.5 text-[#F6E9E9]/35" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-[#F6E9E9] font-['Inter']">Custom / other</p>
                        <p className="text-[11px] text-[#F6E9E9]/40 font-['Inter']">
                          Enter name & logo manually
                        </p>
                      </div>
                    </Listbox.Option>
                    {products.map(p => (
                      <Listbox.Option
                        key={p.id}
                        value={p.id}
                        className={({ active, selected }) =>
                          `cursor-pointer px-3 py-2.5 flex items-center gap-3 ${
                            active ? 'bg-[#E16428]/12' : ''
                          } ${selected ? 'bg-[#E16428]/8' : ''}`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <div className="w-9 h-9 rounded-lg bg-white border border-[#E16428]/15 overflow-hidden flex items-center justify-center shrink-0">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  className="w-full h-full object-contain p-0.5"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-[#272121]/40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-[#F6E9E9] font-['Inter'] truncate">
                                {p.name}
                              </p>
                              <p className="text-[11px] text-[#E16428]/80 font-['Inter'] truncate">
                                {p.category}
                              </p>
                            </div>
                            {selected && <Check className="w-4 h-4 text-[#E16428] shrink-0" />}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>
          )}

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
                className={`${fieldClass} ${catalogLocked ? 'opacity-70' : ''}`}
                required
                readOnly={catalogLocked}
              />
            </div>
            <div className="relative shrink-0 pb-0.5">
              <button
                type="button"
                onClick={() => {
                  if (!catalogLocked) fileInputRef.current?.click();
                }}
                disabled={saving || catalogLocked}
                className="relative w-11 h-11 rounded-lg border border-[#E16428]/30 bg-[#1a1818] overflow-hidden flex items-center justify-center hover:border-[#E16428]/55 transition-colors disabled:opacity-60"
                title={
                  catalogLocked
                    ? 'Logo from product catalog'
                    : imagePreview
                      ? 'Change logo'
                      : 'Upload logo'
                }
                aria-label={imagePreview ? 'Change logo' : 'Upload logo'}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-[#F6E9E9]/40" />
                )}
              </button>
              {imagePreview && !catalogLocked && (
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
                disabled={catalogLocked}
              >
                <div className="relative">
                  <Listbox.Button
                    className={`${fieldClass} flex justify-between items-center text-left ${
                      catalogLocked ? 'opacity-70 cursor-default' : ''
                    }`}
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
                disabled={isBusy}
                title={expense ? 'Update expense' : 'Add expense'}
                aria-label={expense ? 'Update expense' : 'Add expense'}
                className="aspect-square w-full flex items-center justify-center rounded-md border border-[#E16428]/50 bg-[#E16428] text-white hover:bg-[#E16428]/90 transition-colors disabled:opacity-60 pointer-events-auto"
              >
                {isBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isBusy && (
          <div
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center rounded-2xl bg-[#1a1616]/92 backdrop-blur-sm pointer-events-auto animate-fadeIn"
            role="status"
            aria-live="polite"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E16428]/35 bg-[#272121] shadow-lg shadow-black/40">
              <Loader2 className="w-7 h-7 text-[#E16428] animate-spin" strokeWidth={2.25} />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#F6E9E9] font-['Poppins']">
              {expense ? 'Updating expense…' : 'Adding expense…'}
            </p>
            <p className="mt-1 text-xs text-[#F6E9E9]/50 font-['Inter']">Please wait…</p>
          </div>
        )}
      </form>
    </div>,
    document.body
  );
};
