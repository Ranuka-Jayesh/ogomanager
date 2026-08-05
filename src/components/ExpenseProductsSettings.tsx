import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, Plus, Save, ImagePlus, Package, ChevronDown } from 'lucide-react';
import { Listbox } from '@headlessui/react';
import { ExpenseCategory, ExpenseProduct } from '../types';
import { supabase } from '../supabaseClient';

const CATEGORIES: ExpenseCategory[] = [
  'AI Tools',
  'Marketing',
  'Print',
  'Software',
  'Office',
  'Other',
];

const LOGO_BUCKET = 'expense-logos';

function mapFromDB(row: any): ExpenseProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    imageUrl: row.image_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${LOGO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
}

async function uploadLogo(file: File): Promise<string> {
  const ext =
    (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteLogo(url: string | null | undefined) {
  if (!url) return;
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(LOGO_BUCKET).remove([path]);
}

export const ExpenseProductsSettings: React.FC = () => {
  const [products, setProducts] = useState<ExpenseProduct[]>([]);
  /** Purchases / subscriptions per product id */
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('AI Tools');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExpenseProduct | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseProduct | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('expense_products')
        .select('*')
        .order('name', { ascending: true });
      if (err) throw err;
      const list = (data || []).map(mapFromDB);
      setProducts(list);

      // Count how many expense rows use each product (by product_id or name)
      const counts: Record<string, number> = {};
      list.forEach(p => {
        counts[p.id] = 0;
      });

      if (list.length > 0) {
        const { data: expenseRows, error: expErr } = await supabase
          .from('expenses')
          .select('product_id, name');
        if (!expErr && expenseRows) {
          const nameToIds = new Map<string, string[]>();
          list.forEach(p => {
            const key = p.name.trim().toLowerCase();
            const arr = nameToIds.get(key) || [];
            arr.push(p.id);
            nameToIds.set(key, arr);
          });
          expenseRows.forEach((row: { product_id?: string | null; name?: string }) => {
            if (row.product_id && counts[row.product_id] !== undefined) {
              counts[row.product_id] += 1;
              return;
            }
            const key = (row.name || '').trim().toLowerCase();
            const ids = nameToIds.get(key);
            if (ids?.length === 1) {
              counts[ids[0]] += 1;
            }
          });
        }
      }
      setUsageCounts(counts);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message?.includes('expense_products') || err?.code === '42P01'
          ? 'Products table not found. Run DB/migration_expense_products.sql in Supabase.'
          : err?.message || 'Failed to load products'
      );
      setProducts([]);
      setUsageCounts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDelete(null);
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete]);

  const resetForm = () => {
    setName('');
    setCategory('AI Tools');
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setEditing(null);
    setError('');
  };

  const startEdit = (p: ExpenseProduct) => {
    setEditing(p);
    setName(p.name);
    setCategory(p.category);
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(p.imageUrl);
    setError('');
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2 MB');
      return;
    }
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let imageUrl = editing?.imageUrl || null;
      if (imageFile) {
        imageUrl = await uploadLogo(imageFile);
        if (editing?.imageUrl && editing.imageUrl !== imageUrl) {
          await deleteLogo(editing.imageUrl);
        }
      }

      if (editing) {
        const { error: err } = await supabase
          .from('expense_products')
          .update({
            name: trimmed,
            category,
            image_url: imageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('expense_products').insert({
          name: trimmed,
          category,
          image_url: imageUrl,
        });
        if (err) throw err;
      }
      resetForm();
      await fetchProducts();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await deleteLogo(confirmDelete.imageUrl);
      const { error: err } = await supabase
        .from('expense_products')
        .delete()
        .eq('id', confirmDelete.id);
      if (err) throw err;
      if (editing?.id === confirmDelete.id) resetForm();
      setConfirmDelete(null);
      await fetchProducts();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete');
      setConfirmDelete(null);
    } finally {
      setSaving(false);
    }
  };

  const formDirty = Boolean(
    editing ||
      name.trim() ||
      imageFile ||
      (imagePreview && !editing)
  );

  return (
    <section className="w-full">
      <div className="flex items-center gap-2.5 mb-5">
        <Package className="w-5 h-5 text-[#E16428] shrink-0" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
            Subscription Products
          </h2>
          <p className="text-[12px] text-[#F6E9E9]/45 font-['Inter'] mt-0.5">
            Name, category & photo — pick these when adding an expense.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-400 font-['Inter']">{error}</p>
      )}

      {/* Add / edit form — photo beside fields on mobile; row on desktop */}
      <div className="flex items-start gap-3 sm:items-end sm:gap-3 mb-6">
        <div className="relative shrink-0 pt-0.5 sm:pt-0 sm:pb-0.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-xl sm:rounded-lg border border-[#E16428]/30 bg-[#1a1818] overflow-hidden flex flex-col items-center justify-center gap-0.5 hover:border-[#E16428]/55 active:scale-[0.98] transition-all disabled:opacity-50"
            title="Product photo"
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt=""
                className="w-full h-full object-contain bg-white p-0.5"
              />
            ) : (
              <>
                <ImagePlus className="w-4 h-4 text-[#F6E9E9]/40" />
                <span className="sm:hidden text-[8px] uppercase tracking-wide text-[#F6E9E9]/30 font-['Inter'] leading-none">
                  Photo
                </span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0 flex-1">
            <label className="block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']">
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              placeholder="e.g. Cursor AI Pro"
              className="underline-field w-full px-0 py-2.5 sm:py-2 bg-transparent border-0 border-b border-[#E16428]/30 rounded-none text-[#F6E9E9] text-sm placeholder-[#F6E9E9]/35 focus:border-[#E16428] font-['Inter']"
            />
          </div>

          <div className="min-w-0 w-full sm:w-40 shrink-0">
            <label className="block text-[10px] uppercase tracking-wide text-[#F6E9E9]/45 mb-0.5 font-['Inter']">
              Category
            </label>
            <Listbox value={category} onChange={setCategory}>
              <div className="relative">
                <Listbox.Button className="underline-field w-full flex items-center justify-between gap-1 px-0 py-2.5 sm:py-2 bg-transparent border-0 border-b border-[#E16428]/30 text-left text-sm text-[#F6E9E9] font-['Inter']">
                  <span className="truncate">{category}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#F6E9E9]/40 shrink-0" />
                </Listbox.Button>
                <Listbox.Options className="absolute z-40 mt-1 w-full min-w-[10rem] left-0 right-0 sm:right-0 bg-[#232021] border border-[#E16428]/30 rounded-lg shadow-xl max-h-48 overflow-auto">
                  {CATEGORIES.map(c => (
                    <Listbox.Option
                      key={c}
                      value={c}
                      className={({ active }) =>
                        `cursor-pointer px-3 py-2.5 text-sm font-['Inter'] ${
                          active ? 'bg-[#E16428]/15 text-[#E16428]' : 'text-[#F6E9E9]/85'
                        }`
                      }
                    >
                      {c}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-[#F6E9E9]/50 text-sm font-['Inter'] py-3">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-[#F6E9E9]/40 text-sm font-['Inter'] py-3 border-b border-[#E16428]/15">
          No products yet — add Cursor, ChatGPT, etc. here.
        </p>
      ) : (
        <div className="flex flex-col max-h-[min(55vh,24rem)] overflow-y-auto overscroll-contain pr-1">
          {products.map(p => {
            const times = usageCounts[p.id] ?? 0;
            return (
            <div
              key={p.id}
              className="group flex items-center gap-3 py-2.5 border-b border-[#E16428]/15 hover:border-[#E16428]/35 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E16428]/15 overflow-hidden flex items-center justify-center shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <Package className="w-4 h-4 text-[#F6E9E9]/30" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#F6E9E9] font-['Inter'] truncate">{p.name}</p>
                <p className="text-[11px] text-[#F6E9E9]/45 font-['Inter'] truncate">
                  <span className="text-[#E16428]/80">{p.category}</span>
                  <span className="mx-1.5 text-[#F6E9E9]/20">·</span>
                  <span>
                    {times === 0
                      ? 'Not used yet'
                      : times === 1
                        ? '1 time used'
                        : `${times} times used`}
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums mr-1">
                <p className="text-sm font-semibold text-[#E16428] font-['Poppins'] leading-none">
                  {times}
                </p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[#F6E9E9]/30 font-['Inter']">
                  {times === 1 ? 'buy' : 'buys'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(p)}
                className="p-1.5 text-[#F6E9E9]/35 hover:text-[#E16428] transition-colors opacity-70 group-hover:opacity-100"
                aria-label={`Edit ${p.name}`}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(p)}
                className="p-1.5 text-[#F6E9E9]/35 hover:text-red-400 transition-colors opacity-70 group-hover:opacity-100"
                aria-label={`Delete ${p.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            );
          })}
        </div>
      )}

      {formDirty &&
        !confirmDelete &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#F6E9E9]"
              >
                {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
              </button>
              <span className="w-px h-4 bg-[#F6E9E9]/15 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                {editing ? (
                  <Save className="w-4 h-4 text-white" strokeWidth={2.5} />
                ) : (
                  <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
                )}
              </div>
            </div>
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
                Delete product?
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#F6E9E9]/55 font-['Inter']">
                Remove{' '}
                <span className="text-[#E16428] font-medium">{confirmDelete.name}</span> from the
                catalog. Existing expenses keep their data.
              </p>

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={saving}
                  className="group w-full flex items-center justify-center gap-2 py-3 border-0 border-b-2 border-red-500/70 rounded-none bg-transparent text-sm font-semibold text-red-400 hover:text-red-300 hover:border-red-400 transition-all duration-200 font-['Inter'] focus:outline-none disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  <span>{saving ? 'Deleting…' : 'Yes, delete'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  disabled={saving}
                  className="w-full py-2.5 border-0 border-b border-transparent rounded-none bg-transparent text-sm text-[#F6E9E9]/50 hover:text-[#F6E9E9] hover:border-[#F6E9E9]/25 transition-all duration-200 font-['Inter'] focus:outline-none disabled:opacity-50"
                >
                  Keep product
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
    </section>
  );
};
