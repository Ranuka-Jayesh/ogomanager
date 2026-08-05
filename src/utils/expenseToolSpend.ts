/** Shared expense period + per-tool spend helpers (Analytics, Report, Excel). */

export type ExpenseSpendRow = {
  id: string;
  name: string;
  account: string;
  amount: number;
  type: 'subscription' | 'one_time';
  status: string;
  category: string;
  expenseDate: string | null;
  nextRenewalDate: string | null;
  startDate: string | null;
  createdAt: string | null;
  productId: string | null;
  imageUrl: string | null;
};

export type ToolSpendCard = {
  key: string;
  name: string;
  category: string;
  imageUrl: string | null;
  spend: number;
  accountCount: number;
  buyCount: number;
  prevSpend: number;
  prevAccountCount: number;
  spendChangePct: number | null;
};

function parseLocalDate(iso: string): Date {
  return new Date(String(iso).slice(0, 10) + 'T12:00:00');
}

function yearMonthKey(iso: string): number {
  const d = parseLocalDate(iso);
  return d.getFullYear() * 12 + d.getMonth();
}

export function expenseAnchorDate(row: ExpenseSpendRow): string | null {
  if (row.type === 'subscription') {
    return row.startDate || row.nextRenewalDate || row.createdAt?.slice(0, 10) || null;
  }
  return row.expenseDate || row.createdAt?.slice(0, 10) || null;
}

/**
 * Date the product was bought / subscription period was started.
 * Used for tool-spend cards — does NOT span “active for this month”.
 */
export function expensePurchaseDate(row: ExpenseSpendRow): string | null {
  if (row.type === 'subscription') {
    // Subscription counted in the month the period started (subscribe / renew start).
    return row.startDate || row.createdAt?.slice(0, 10) || null;
  }
  return row.expenseDate || row.createdAt?.slice(0, 10) || null;
}

/** Bought or newly subscribed in this calendar month only. */
export function expenseBoughtOrSubscribedInMonth(
  row: ExpenseSpendRow,
  month: number,
  year: number
): boolean {
  const iso = expensePurchaseDate(row);
  if (!iso) return false;
  const d = parseLocalDate(iso);
  return d.getMonth() === month && d.getFullYear() === year;
}

/** Bought/subscribed in period (for tool spend when all months or all years). */
export function expenseBoughtOrSubscribedInPeriod(
  row: ExpenseSpendRow,
  month: number | 'all',
  year: number | 'all'
): boolean {
  if (month !== 'all' && year !== 'all') {
    return expenseBoughtOrSubscribedInMonth(row, month, year);
  }
  if (month === 'all' && year === 'all') return true;
  const iso = expensePurchaseDate(row);
  if (!iso) return false;
  const d = parseLocalDate(iso);
  const monthOk = month === 'all' || d.getMonth() === month;
  const yearOk = year === 'all' || d.getFullYear() === year;
  return monthOk && yearOk;
}

/** Active plans span start month → due month (inclusive). */
export function expenseCoversMonthYear(
  row: ExpenseSpendRow,
  month: number,
  year: number
): boolean {
  if (row.type === 'subscription' && (row.status === 'active' || row.status === 'paused')) {
    const startIso = row.startDate || row.nextRenewalDate;
    const endIso = row.nextRenewalDate || row.startDate;
    if (!startIso) return false;
    let startKey = yearMonthKey(startIso);
    let endKey = yearMonthKey(endIso || startIso);
    if (startKey > endKey) {
      const t = startKey;
      startKey = endKey;
      endKey = t;
    }
    const selectedKey = year * 12 + month;
    return selectedKey >= startKey && selectedKey <= endKey;
  }
  const iso = expenseAnchorDate(row);
  if (!iso) return false;
  const d = parseLocalDate(iso);
  return d.getMonth() === month && d.getFullYear() === year;
}

/**
 * Expense counts in analytics period by buy / subscribe date only
 * (not “active coverage” from start → due).
 */
export function expenseInPeriod(
  row: ExpenseSpendRow,
  month: number | 'all',
  year: number | 'all'
): boolean {
  return expenseBoughtOrSubscribedInPeriod(row, month, year);
}

export function periodExpenseTotal(
  rows: ExpenseSpendRow[],
  month: number | 'all',
  year: number | 'all'
): number {
  return rows
    .filter(r => expenseInPeriod(r, month, year))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

/** Aggregate tool spend for any filter; MoM % only when a single month+year is selected. */
export function buildToolSpendForPeriod(
  expenses: ExpenseSpendRow[],
  month: number | 'all',
  year: number | 'all'
): ToolSpendCard[] {
  if (month !== 'all' && year !== 'all') {
    return buildToolSpendCards(expenses, month, year);
  }

  type Acc = {
    name: string;
    category: string;
    imageUrl: string | null;
    spend: number;
    accounts: Set<string>;
    buys: number;
  };
  const map = new Map<string, Acc>();
  expenses.forEach(row => {
    // Buy / subscribe attribution only — not “active this period”
    if (!expenseBoughtOrSubscribedInPeriod(row, month, year)) return;
    const key = row.productId || row.name.trim().toLowerCase() || row.id;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        name: row.name,
        category: row.category || 'Other',
        imageUrl: row.imageUrl,
        spend: 0,
        accounts: new Set(),
        buys: 0,
      };
      map.set(key, acc);
    }
    acc.spend += row.amount;
    acc.buys += 1;
    if (row.imageUrl && !acc.imageUrl) acc.imageUrl = row.imageUrl;
    const accountKey = (row.account || '').trim().toLowerCase();
    if (accountKey) acc.accounts.add(accountKey);
    else acc.accounts.add(`__row_${row.id}`);
  });

  return Array.from(map.entries())
    .map(([key, acc]) => ({
      key,
      name: acc.name,
      category: acc.category,
      imageUrl: acc.imageUrl,
      spend: acc.spend,
      accountCount: acc.accounts.size,
      buyCount: acc.buys,
      prevSpend: 0,
      prevAccountCount: 0,
      spendChangePct: null as number | null,
    }))
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

export function buildToolSpendCards(
  expenses: ExpenseSpendRow[],
  month: number,
  year: number
): ToolSpendCard[] {
  const prev = new Date(year, month - 1, 1);
  const prevMonth = prev.getMonth();
  const prevYear = prev.getFullYear();

  type Acc = {
    name: string;
    category: string;
    imageUrl: string | null;
    spend: number;
    accounts: Set<string>;
    buys: number;
  };

  const build = (m: number, y: number) => {
    const map = new Map<string, Acc>();
    expenses.forEach(row => {
      // Only products bought or subscribed in this month (not all active coverage)
      if (!expenseBoughtOrSubscribedInMonth(row, m, y)) return;
      const key = row.productId || row.name.trim().toLowerCase() || row.id;
      let acc = map.get(key);
      if (!acc) {
        acc = {
          name: row.name,
          category: row.category || 'Other',
          imageUrl: row.imageUrl,
          spend: 0,
          accounts: new Set(),
          buys: 0,
        };
        map.set(key, acc);
      }
      acc.spend += row.amount;
      acc.buys += 1;
      if (row.imageUrl && !acc.imageUrl) acc.imageUrl = row.imageUrl;
      const accountKey = (row.account || '').trim().toLowerCase();
      if (accountKey) acc.accounts.add(accountKey);
      else acc.accounts.add(`__row_${row.id}`);
    });
    return map;
  };

  const current = build(month, year);
  const previous = build(prevMonth, prevYear);
  const keys = new Set([...current.keys(), ...previous.keys()]);

  return Array.from(keys)
    .map(key => {
      const cur = current.get(key);
      const prevAcc = previous.get(key);
      const spend = cur?.spend ?? 0;
      const prevSpend = prevAcc?.spend ?? 0;
      let spendChangePct: number | null = null;
      if (prevSpend > 0) {
        spendChangePct = ((spend - prevSpend) / prevSpend) * 100;
      }
      return {
        key,
        name: cur?.name || prevAcc?.name || 'Unknown',
        category: cur?.category || prevAcc?.category || 'Other',
        imageUrl: cur?.imageUrl || prevAcc?.imageUrl || null,
        spend,
        accountCount: cur?.accounts.size ?? 0,
        buyCount: cur?.buys ?? 0,
        prevSpend,
        prevAccountCount: prevAcc?.accounts.size ?? 0,
        spendChangePct,
      };
    })
    .filter(c => c.spend > 0 || c.prevSpend > 0)
    .sort((a, b) => b.spend - a.spend);
}

export function mapExpenseRowFromDB(row: any): ExpenseSpendRow {
  return {
    id: row.id,
    name: row.name || 'Unnamed',
    account: row.account || '',
    amount: Number(row.amount) || 0,
    type: row.type === 'subscription' ? 'subscription' : 'one_time',
    status: row.status || (row.type === 'subscription' ? 'active' : 'paid'),
    category: row.category || 'Other',
    expenseDate: row.expense_date ?? null,
    nextRenewalDate: row.next_renewal_date ?? null,
    startDate: row.start_date ?? null,
    createdAt: row.created_at ?? null,
    productId: row.product_id || null,
    imageUrl: row.image_url || null,
  };
}
