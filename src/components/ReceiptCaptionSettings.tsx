import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Strikethrough,
  RotateCcw,
  Save,
  MessageSquareText,
} from 'lucide-react';
import {
  CAPTION_PARAMS,
  DEFAULT_RECEIPT_CAPTION,
  RECEIPT_CAPTION_STATUSES,
  SAMPLE_CAPTION_VALUES,
  clearReceiptCaptionForStatus,
  fillReceiptCaption,
  getSavedReceiptCaptions,
  saveReceiptCaptionForStatus,
  type CaptionParam,
  type ReceiptCaptionStatus,
} from '../utils/receiptCaption';
import { renderWhatsAppFormatted } from '../utils/whatsappFormat';

function insertAtCursor(
  value: string,
  start: number,
  end: number,
  insert: string
): { next: string; cursor: number } {
  const next = value.slice(0, start) + insert + value.slice(end);
  return { next, cursor: start + insert.length };
}

/** Wrap (or unwrap) selection with WhatsApp markers. No selection → insert markers with placeholder. */
function applyWhatsAppWrap(
  value: string,
  start: number,
  end: number,
  marker: string
): { next: string; selStart: number; selEnd: number } {
  const selected = value.slice(start, end);

  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    const next = value.slice(0, start) + inner + value.slice(end);
    return { next, selStart: start, selEnd: start + inner.length };
  }

  const before = value.slice(Math.max(0, start - marker.length), start);
  const after = value.slice(end, end + marker.length);
  if (selected && before === marker && after === marker) {
    const next =
      value.slice(0, start - marker.length) + selected + value.slice(end + marker.length);
    return {
      next,
      selStart: start - marker.length,
      selEnd: start - marker.length + selected.length,
    };
  }

  if (!selected) {
    const placeholder = 'text';
    const wrapped = `${marker}${placeholder}${marker}`;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    return {
      next,
      selStart: start + marker.length,
      selEnd: start + marker.length + placeholder.length,
    };
  }

  const trimmed = selected.trim();
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  const wrapStart = start + lead;
  const wrapEnd = end - trail;
  const next =
    value.slice(0, wrapStart) + marker + trimmed + marker + value.slice(wrapEnd);

  return {
    next,
    selStart: wrapStart + marker.length,
    selEnd: wrapStart + marker.length + trimmed.length,
  };
}

const STATUS_SHORT: Record<ReceiptCaptionStatus, string> = {
  Running: 'Running',
  Pending: 'Pending',
  'Pending Payment': 'Payment',
  Delivered: 'Delivered',
  Correction: 'Correction',
  Rejected: 'Rejected',
};

export const ReceiptCaptionSettings: React.FC = () => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef({ start: 0, end: 0 });
  const [activeStatus, setActiveStatus] = useState<ReceiptCaptionStatus>('Running');
  const [captions, setCaptions] = useState<Record<ReceiptCaptionStatus, string>>(() => {
    const empty = Object.fromEntries(
      RECEIPT_CAPTION_STATUSES.map(s => [s, DEFAULT_RECEIPT_CAPTION])
    ) as Record<ReceiptCaptionStatus, string>;
    return empty;
  });
  const [savedCaptions, setSavedCaptions] = useState<Record<ReceiptCaptionStatus, string>>(captions);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const template = captions[activeStatus] ?? DEFAULT_RECEIPT_CAPTION;

  const isDirty = useMemo(
    () => RECEIPT_CAPTION_STATUSES.some(s => (captions[s] ?? '') !== (savedCaptions[s] ?? '')),
    [captions, savedCaptions]
  );

  const rememberCaret = () => {
    const el = textareaRef.current;
    if (!el) return;
    caretRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  useEffect(() => {
    const loaded = getSavedReceiptCaptions();
    setCaptions(loaded);
    setSavedCaptions(loaded);
  }, []);

  const preview = useMemo(
    () =>
      fillReceiptCaption(template, {
        ...SAMPLE_CAPTION_VALUES,
        status: activeStatus,
      }),
    [template, activeStatus]
  );

  const focusAndSelect = useCallback((start: number, end: number) => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
      caretRef.current = { start, end };
    });
  }, []);

  const applyTemplate = useCallback(
    (next: string, start?: number, end?: number) => {
      setCaptions(prev => ({ ...prev, [activeStatus]: next }));
      if (start != null && end != null) focusAndSelect(start, end);
    },
    [activeStatus, focusAndSelect]
  );

  const insertParam = useCallback(
    (param: CaptionParam) => {
      const el = textareaRef.current;
      const { start, end } = caretRef.current;
      const value = el?.value ?? template;
      const { next, cursor } = insertAtCursor(value, start, end, param.token);
      caretRef.current = { start: cursor, end: cursor };
      applyTemplate(next, cursor, cursor);
    },
    [applyTemplate, template]
  );

  const wrapWith = useCallback(
    (marker: string) => {
      const el = textareaRef.current;
      const value = el?.value ?? template;
      let start = caretRef.current.start;
      let end = caretRef.current.end;
      if (el && document.activeElement === el) {
        start = el.selectionStart;
        end = el.selectionEnd;
      }
      const { next, selStart, selEnd } = applyWhatsAppWrap(value, start, end, marker);
      applyTemplate(next, selStart, selEnd);
    },
    [applyTemplate, template]
  );

  const onSave = () => {
    try {
      if (!template.trim()) {
        setMsg({ type: 'error', text: 'Caption cannot be empty.' });
        return;
      }
      saveReceiptCaptionForStatus(activeStatus, template);
      setSavedCaptions(prev => ({ ...prev, [activeStatus]: template }));
      setMsg({ type: 'success', text: `Saved for ${activeStatus}.` });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ type: 'error', text: 'Failed to save caption.' });
    }
  };

  const onReset = () => {
    clearReceiptCaptionForStatus(activeStatus);
    setCaptions(prev => ({ ...prev, [activeStatus]: DEFAULT_RECEIPT_CAPTION }));
    setSavedCaptions(prev => ({ ...prev, [activeStatus]: DEFAULT_RECEIPT_CAPTION }));
    setMsg({ type: 'success', text: `Reset ${activeStatus} to default.` });
    setTimeout(() => setMsg(null), 2500);
  };

  const onDragStart = (e: React.DragEvent, param: CaptionParam) => {
    e.dataTransfer.setData('text/plain', param.token);
    e.dataTransfer.setData('application/x-ogo-caption-param', param.token);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const token =
      e.dataTransfer.getData('application/x-ogo-caption-param') ||
      e.dataTransfer.getData('text/plain');
    if (!token || !CAPTION_PARAMS.some(p => p.token === token)) return;

    const el = textareaRef.current;
    const value = el?.value ?? template;
    const { start, end } = caretRef.current;
    const next = value.slice(0, start) + token + value.slice(end);
    const cursor = start + token.length;
    caretRef.current = { start: cursor, end: cursor };
    applyTemplate(next, cursor, cursor);
  };

  const toolBtn =
    'size-8 inline-flex items-center justify-center rounded-md text-[#F6E9E9]/45 hover:text-[#E16428] transition-colors';

  const isCustomized = (status: ReceiptCaptionStatus) =>
    (captions[status] ?? '').trim() !== DEFAULT_RECEIPT_CAPTION.trim();

  return (
    <section className="w-full">
      {/* Title */}
      <div className="flex items-center gap-2.5 mb-6">
        <MessageSquareText className="w-5 h-5 text-[#E16428] shrink-0" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#F6E9E9] font-['Poppins'] tracking-tight">
            Receipt Caption
          </h2>
          <p className="text-[12px] text-[#F6E9E9]/45 font-['Inter'] mt-0.5">
            Separate caption per project status — used automatically when sharing.
          </p>
        </div>
      </div>

      {/*
        Layout:
        - mobile: stacked (status → insert → editor)
        - md+: Insert | Editor | Status
      */}
      <div className="flex flex-col md:flex-row gap-5 md:gap-6 items-stretch md:items-start">
        {/* Insert panel — left on desktop */}
        <aside className="w-full md:w-40 lg:w-44 shrink-0 order-2 md:order-1 md:sticky md:top-24">
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#F6E9E9]/35 font-['Inter'] mb-2.5">
            Insert
          </p>
          <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-0.5 px-0.5">
            {CAPTION_PARAMS.map(param => (
              <button
                key={param.key}
                type="button"
                draggable
                onDragStart={e => onDragStart(e, param)}
                onClick={() => insertParam(param)}
                title={param.token}
                className="shrink-0 md:w-full px-1 py-2 border-0 border-b border-[#E16428]/20 rounded-none bg-transparent text-left text-[11px] md:text-xs font-['Inter'] text-[#F6E9E9]/55 hover:border-[#E16428] hover:text-[#E16428] transition-colors cursor-grab active:cursor-grabbing select-none whitespace-nowrap md:whitespace-normal leading-tight"
              >
                {param.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main editor column */}
        <div className="flex-1 min-w-0 w-full space-y-6 order-3 md:order-2">
          {/* Editor surface */}
          <div
            className={`rounded-xl border transition-colors ${
              dragOver ? 'border-[#E16428]/50' : 'border-[#F6E9E9]/10'
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#F6E9E9]/08">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title="Bold (*text*)"
                  className={toolBtn}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => wrapWith('*')}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Italic (_text_)"
                  className={toolBtn}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => wrapWith('_')}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Strikethrough (~text~)"
                  className={toolBtn}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => wrapWith('~')}
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="pr-1.5 text-[11px] text-[#F6E9E9]/35 font-['Inter'] truncate">
                Editing: {activeStatus}
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={template}
              onChange={e => {
                applyTemplate(e.target.value);
                rememberCaret();
              }}
              onSelect={rememberCaret}
              onClick={rememberCaret}
              onKeyUp={rememberCaret}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                  e.preventDefault();
                  rememberCaret();
                  wrapWith('*');
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                  e.preventDefault();
                  rememberCaret();
                  wrapWith('_');
                }
              }}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              rows={8}
              spellCheck={false}
              placeholder={`Caption for ${activeStatus} projects…`}
              className="w-full px-3.5 py-3 bg-transparent text-[#F6E9E9] text-sm font-['Inter'] leading-relaxed resize-none focus:outline-none placeholder:text-[#F6E9E9]/25"
            />
          </div>

          {/* Preview */}
          <div className="space-y-2.5">
            <p className="text-[11px] tracking-[0.12em] uppercase text-[#F6E9E9]/35 font-['Inter']">
              Preview
            </p>
            <div className="relative pl-3 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-[#25D366]/50">
              <div className="text-[13px] text-[#F6E9E9]/80 whitespace-pre-wrap font-['Inter'] leading-relaxed">
                {preview ? (
                  renderWhatsAppFormatted(preview)
                ) : (
                  <span className="text-[#F6E9E9]/30">Empty caption</span>
                )}
              </div>
            </div>
          </div>

          {/* Status message */}
          {msg && (
            <p
              className={`text-xs font-['Inter'] pt-1 ${
                msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {msg.text}
            </p>
          )}
        </div>

        {/* Status panel — right on desktop */}
        <aside className="w-full md:w-40 lg:w-44 shrink-0 order-1 md:order-3 md:sticky md:top-24">
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#F6E9E9]/35 font-['Inter'] mb-2.5">
            Status
          </p>
          <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-0.5 px-0.5">
            {RECEIPT_CAPTION_STATUSES.map(status => {
              const active = activeStatus === status;
              const custom = isCustomized(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setActiveStatus(status);
                    caretRef.current = { start: 0, end: 0 };
                    setMsg(null);
                  }}
                  className={`relative shrink-0 md:w-full px-1 py-2 md:py-2.5 border-0 border-b-2 rounded-none bg-transparent text-left text-[11px] md:text-xs font-['Inter'] transition-colors whitespace-nowrap md:whitespace-normal leading-tight ${
                    active
                      ? 'border-[#E16428] text-[#E16428]'
                      : 'border-transparent text-[#F6E9E9]/65 hover:text-[#E16428] hover:border-[#E16428]/35'
                  }`}
                  title={status}
                >
                  <span className="md:hidden">{STATUS_SHORT[status]}</span>
                  <span className="hidden md:inline">{status}</span>
                  {custom && !active && (
                    <span
                      className="absolute top-1.5 right-0 size-1.5 rounded-full bg-[#E16428]/80"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {isDirty &&
        createPortal(
          <div className="fixed bottom-5 sm:bottom-7 inset-x-0 z-40 flex justify-center pointer-events-none px-3">
            <div className="pointer-events-auto flex items-center rounded-full bg-[#272121]/95 backdrop-blur-md border border-[#E16428]/25 shadow-xl shadow-black/40 pl-3.5 pr-1.5 py-1 gap-0.5 animate-fadeIn">
              <button
                type="button"
                onClick={onSave}
                className="px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
              >
                Save
              </button>
              <span className="w-px h-4 bg-[#F6E9E9]/15 shrink-0" aria-hidden />
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[#F6E9E9] text-sm font-['Poppins'] font-semibold hover:text-[#E16428] active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 opacity-70" />
                Reset
              </button>
              <div className="ml-1.5 shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E16428] border-2 border-[#E16428]/80 flex items-center justify-center shadow-md">
                <Save className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
};
