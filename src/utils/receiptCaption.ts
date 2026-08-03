/**
 * Receipt share caption templates — one per project status, stored in localStorage.
 * Formatting uses WhatsApp-style markers: *bold* _italic_ ~strike~
 */

export const RECEIPT_CAPTION_STORAGE_KEY = 'ogo_receipt_caption'; // legacy single caption
export const RECEIPT_CAPTIONS_BY_STATUS_KEY = 'ogo_receipt_captions';

/** Project statuses that can have their own share caption */
export const RECEIPT_CAPTION_STATUSES = [
  'Running',
  'Pending',
  'Pending Payment',
  'Delivered',
  'Correction',
  'Rejected',
] as const;

export type ReceiptCaptionStatus = (typeof RECEIPT_CAPTION_STATUSES)[number];

export type CaptionParamKey =
  | 'projectId'
  | 'status'
  | 'clientName'
  | 'clientUniOrg'
  | 'types'
  | 'deadline'
  | 'price'
  | 'advance'
  | 'balance'
  | 'website';

export type CaptionParam = {
  key: CaptionParamKey;
  label: string;
  token: string;
};

export const CAPTION_PARAMS: CaptionParam[] = [
  { key: 'projectId', label: 'Project ID', token: '{{projectId}}' },
  { key: 'status', label: 'Status', token: '{{status}}' },
  { key: 'clientName', label: 'Client Name', token: '{{clientName}}' },
  { key: 'clientUniOrg', label: 'University / ORG', token: '{{clientUniOrg}}' },
  { key: 'types', label: 'Types', token: '{{types}}' },
  { key: 'deadline', label: 'Deadline', token: '{{deadline}}' },
  { key: 'price', label: 'Price', token: '{{price}}' },
  { key: 'advance', label: 'Advance', token: '{{advance}}' },
  { key: 'balance', label: 'Balance', token: '{{balance}}' },
  { key: 'website', label: 'Website', token: '{{website}}' },
];

export const DEFAULT_RECEIPT_CAPTION = `Thank you for your order with OGO Technology.
Please find your project receipt attached.
Project ID: {{projectId}}
Status: {{status}}.

Know more about us: {{website}}`;

export type ReceiptCaptionValues = Partial<Record<CaptionParamKey, string>>;

export type ReceiptCaptionsByStatus = Partial<Record<string, string>>;

function normalizeStatus(status: string | undefined | null): string {
  if (!status) return 'Running';
  const trim = status.trim();
  const match = RECEIPT_CAPTION_STATUSES.find(
    s => s.toLowerCase() === trim.toLowerCase()
  );
  return match ?? trim;
}

/** Legacy single-template read (migration only) */
function getLegacyCaption(): string | null {
  try {
    const saved = localStorage.getItem(RECEIPT_CAPTION_STORAGE_KEY);
    if (saved != null && saved.trim()) return saved;
  } catch {
    /* ignore */
  }
  return null;
}

export function getSavedReceiptCaptions(): Record<ReceiptCaptionStatus, string> {
  const legacy = getLegacyCaption();
  const defaults = Object.fromEntries(
    RECEIPT_CAPTION_STATUSES.map(s => [s, legacy ?? DEFAULT_RECEIPT_CAPTION])
  ) as Record<ReceiptCaptionStatus, string>;

  try {
    const raw = localStorage.getItem(RECEIPT_CAPTIONS_BY_STATUS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as ReceiptCaptionsByStatus;
    if (!parsed || typeof parsed !== 'object') return defaults;

    for (const status of RECEIPT_CAPTION_STATUSES) {
      const value = parsed[status];
      if (typeof value === 'string' && value.trim()) {
        defaults[status] = value;
      }
    }
  } catch {
    /* ignore */
  }

  return defaults;
}

/** Caption used when sharing a project (by status). Falls back to default. */
export function getReceiptCaptionForStatus(status: string | undefined | null): string {
  const key = normalizeStatus(status);
  const all = getSavedReceiptCaptions();
  if (key in all) return all[key as ReceiptCaptionStatus];
  // Unknown status: try exact key from storage map, else default
  try {
    const raw = localStorage.getItem(RECEIPT_CAPTIONS_BY_STATUS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ReceiptCaptionsByStatus;
      if (typeof parsed[key] === 'string' && parsed[key]!.trim()) return parsed[key]!;
    }
  } catch {
    /* ignore */
  }
  return getLegacyCaption() ?? DEFAULT_RECEIPT_CAPTION;
}

/** @deprecated Use getReceiptCaptionForStatus — kept for older imports */
export function getSavedReceiptCaption(): string {
  return getReceiptCaptionForStatus('Running');
}

export function saveReceiptCaptionForStatus(
  status: string,
  template: string
): void {
  const key = normalizeStatus(status);
  const all = getSavedReceiptCaptions();
  const next: ReceiptCaptionsByStatus = { ...all, [key]: template };
  localStorage.setItem(RECEIPT_CAPTIONS_BY_STATUS_KEY, JSON.stringify(next));
}

/** Save full map (e.g. after bulk edit) */
export function saveReceiptCaptions(map: ReceiptCaptionsByStatus): void {
  localStorage.setItem(RECEIPT_CAPTIONS_BY_STATUS_KEY, JSON.stringify(map));
}

/** Reset one status caption to default */
export function clearReceiptCaptionForStatus(status: string): void {
  const key = normalizeStatus(status);
  const all = getSavedReceiptCaptions();
  const next: ReceiptCaptionsByStatus = { ...all, [key]: DEFAULT_RECEIPT_CAPTION };
  localStorage.setItem(RECEIPT_CAPTIONS_BY_STATUS_KEY, JSON.stringify(next));
}

/** Reset every status (and clear legacy key) */
export function clearAllReceiptCaptions(): void {
  try {
    localStorage.removeItem(RECEIPT_CAPTIONS_BY_STATUS_KEY);
    localStorage.removeItem(RECEIPT_CAPTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Use clearReceiptCaptionForStatus / clearAllReceiptCaptions */
export function clearReceiptCaption(): void {
  clearAllReceiptCaptions();
}

/** @deprecated Use saveReceiptCaptionForStatus */
export function saveReceiptCaption(template: string): void {
  saveReceiptCaptionForStatus('Running', template);
}

export function fillReceiptCaption(
  template: string,
  values: ReceiptCaptionValues
): string {
  let out = template;
  for (const { key, token } of CAPTION_PARAMS) {
    const value = values[key] ?? '';
    out = out.split(token).join(value);
  }
  return out;
}

/** Sample values for Settings live preview */
export const SAMPLE_CAPTION_VALUES: ReceiptCaptionValues = {
  projectId: 'PJ1975',
  status: 'Running',
  clientName: 'Dahamsa',
  clientUniOrg: 'NSBM',
  types: 'Report',
  deadline: '8/2/2026',
  price: 'LKR 4,000',
  advance: 'LKR 2,000',
  balance: 'LKR 2,000',
  website: 'www.ogotechnology.net',
};
