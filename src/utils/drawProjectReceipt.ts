/**
 * Draw a project receipt onto a canvas (no html2canvas).
 * Balanced height — not cramped, not oversized.
 */

export type ReceiptDrawInput = {
  projectId: string;
  clientName: string;
  clientUniOrg: string;
  typeNames: string[];
  deadlineDate: string;
  price: number;
  advance: number;
  balance: number;
  status: string;
  hasDiscount: boolean;
  discountAmount: number;
  discountPercent: number;
  netPrice: number;
  fastDeliver: boolean;
};

const COLORS = {
  bg: '#161313',
  footerBg: '#1c1818',
  text: '#F6E9E9',
  muted: 'rgba(246, 233, 233, 0.45)',
  label: 'rgba(246, 233, 233, 0.5)',
  accent: '#E16428',
  accentSoft: '#f08a4b',
  green: '#4ade80',
  red: '#f87171',
  emerald: '#6ee7b7',
  yellow: '#fde047',
  line: 'rgba(225, 100, 40, 0.25)',
};

const STATUS_COLORS: Record<string, string> = {
  Running: '#93c5fd',
  Delivered: '#86efac',
  Pending: '#fde047',
  'Pending Payment': '#d8b4fe',
  Correction: '#fdba74',
  Rejected: '#fca5a5',
};

const W = 380;
const PAD = 22;
const ROW_H = 27;
const SCALE = 2;
const FOOTER_H = 42;
const LOGO_SIZE = 78;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function money(n: number) {
  return `LKR ${n.toLocaleString()}`;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Lucide-style crown, sized to `size` (viewBox 24). */
function drawCrownIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(11.562, 3.266);
  ctx.lineTo(16, 8);
  ctx.lineTo(22, 4);
  ctx.lineTo(19, 15);
  ctx.lineTo(5, 15);
  ctx.lineTo(2, 4);
  ctx.lineTo(8, 8);
  ctx.lineTo(11.562, 3.266);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, 19);
  ctx.lineTo(19, 19);
  ctx.stroke();
  ctx.restore();
}

/** Lucide-style badge-percent icon. */
function drawBadgePercentIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // rounded square
  roundRect(ctx, 3, 3, 18, 18, 4);
  ctx.stroke();
  // percent marks
  ctx.beginPath();
  ctx.arc(9, 9, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, 15, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 9);
  ctx.lineTo(10, 15);
  ctx.stroke();
  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
  bg: string,
  border: string,
  drawIcon: (ctx: CanvasRenderingContext2D, ix: number, iy: number, size: number, color: string) => void
) {
  const iconSize = 11;
  const padX = 7;
  const gap = 4;
  const h = 22;
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  const textW = ctx.measureText(label).width;
  const w = padX + iconSize + gap + textW + padX;

  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 5);
  ctx.stroke();

  const iconY = y + (h - iconSize) / 2;
  drawIcon(ctx, x + padX, iconY, iconSize, color);

  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.fillText(label, x + padX + iconSize + gap, y + h / 2);

  return w;
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  value: string,
  valueColor = COLORS.text
) {
  const left = PAD;
  const right = W - PAD;
  ctx.textBaseline = 'middle';

  ctx.font = '500 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.label;
  ctx.textAlign = 'left';
  ctx.fillText(label, left, y);

  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = valueColor;
  ctx.textAlign = 'right';
  const maxVal = right - left - 140;
  ctx.fillText(ellipsize(ctx, value, maxVal), right, y);
  ctx.textAlign = 'left';

  return y + ROW_H;
}

function drawDivider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  return y + 12;
}

function maxCanvasHeight(data: ReceiptDrawInput) {
  let h = 110;
  if (data.fastDeliver || data.hasDiscount) h += 34;
  h += 14;
  h += 5 * ROW_H + 6;
  h += 14;
  h += 4 * ROW_H + 6;
  if (data.hasDiscount) h += 2 * ROW_H;
  h += 16;
  h += FOOTER_H;
  return h + 20;
}

export async function drawProjectReceiptCanvas(data: ReceiptDrawInput): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const logo = await loadImage('/logo_ogo.png');
  const maxH = maxCanvasHeight(data);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * SCALE);
  canvas.height = Math.round(maxH * SCALE);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, maxH);

  // Top accent
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, COLORS.accent);
  grad.addColorStop(0.5, COLORS.accentSoft);
  grad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 4);

  // Big logo — top right
  if (logo) {
    ctx.drawImage(logo, W - PAD - LOGO_SIZE, 18, LOGO_SIZE, LOGO_SIZE);
  }

  // Header (leave room for large logo on the right)
  let y = 24;
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 16px Poppins, Inter, system-ui, sans-serif';
  ctx.fillText('ogo Assignment', PAD, y);
  y += 24;

  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 10px Inter, system-ui, sans-serif';
  ctx.fillText('DEPARTMENT OF ACADEMIC', PAD, y);
  y += 18;

  ctx.fillStyle = COLORS.muted;
  ctx.font = '400 12px Inter, system-ui, sans-serif';
  ctx.fillText('+94 75 930 7059', PAD, y);

  // Keep header block at least as tall as the logo
  y = Math.max(y + 22, 18 + LOGO_SIZE + 12);

  y = drawDivider(ctx, y);

  y = drawRow(ctx, y + 2, 'Project ID', data.projectId, COLORS.accent);
  y = drawRow(ctx, y, 'Client Name', data.clientName || '—');
  y = drawRow(ctx, y, 'University / ORG', data.clientUniOrg || '—');
  y = drawRow(
    ctx,
    y,
    'Types',
    data.typeNames.length ? data.typeNames.join(', ') : '—',
    COLORS.accent
  );
  y = drawRow(
    ctx,
    y,
    'Deadline',
    data.deadlineDate ? new Date(data.deadlineDate).toLocaleDateString() : '—'
  );

  y = drawDivider(ctx, y + 2);

  y = drawRow(ctx, y + 2, 'Price', money(data.price));
  if (data.hasDiscount) {
    y = drawRow(
      ctx,
      y,
      `Discount${data.discountPercent ? ` ${data.discountPercent}%` : ''}`,
      `− ${money(data.discountAmount)}`,
      COLORS.emerald
    );
    y = drawRow(ctx, y, 'Net', money(data.netPrice));
  }
  y = drawRow(ctx, y, 'Advance', money(data.advance), COLORS.green);
  y = drawRow(
    ctx,
    y,
    'Balance',
    money(data.balance),
    data.balance > 0 ? COLORS.red : COLORS.green
  );
  y = drawRow(ctx, y, 'Status', data.status, STATUS_COLORS[data.status] || COLORS.text);

  // Fast / discount badges below Status (match modal: icon + label, high contrast for share)
  if (data.fastDeliver || data.hasDiscount) {
    let bx = PAD;
    const badgeY = y + 2;
    if (data.fastDeliver) {
      const tw = drawBadge(
        ctx,
        bx,
        badgeY,
        'Fast',
        '#fde047',
        'rgba(234, 179, 8, 0.22)',
        'rgba(234, 179, 8, 0.55)',
        drawCrownIcon
      );
      bx += tw + 8;
    }
    if (data.hasDiscount) {
      drawBadge(
        ctx,
        bx,
        badgeY,
        `−${data.discountPercent}%`,
        '#6ee7b7',
        'rgba(16, 185, 129, 0.22)',
        'rgba(16, 185, 129, 0.55)',
        drawBadgePercentIcon
      );
    }
    y = badgeY + 28;
  }

  const footerTop = y + 14;
  const finalH = footerTop + FOOTER_H;

  ctx.fillStyle = COLORS.footerBg;
  ctx.fillRect(0, footerTop, W, FOOTER_H);

  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop);
  ctx.lineTo(W, footerTop);
  ctx.stroke();

  const footerY = footerTop + FOOTER_H / 2;
  ctx.textBaseline = 'middle';
  ctx.font = '400 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'left';
  ctx.fillText(
    new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    PAD,
    footerY
  );

  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.accent;
  ctx.textAlign = 'right';
  ctx.fillText('ogo technology', W - PAD, footerY);
  ctx.textAlign = 'left';

  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = Math.round(finalH * SCALE);
  const octx = out.getContext('2d');
  if (!octx) return canvas;
  octx.fillStyle = COLORS.bg;
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  return out;
}
