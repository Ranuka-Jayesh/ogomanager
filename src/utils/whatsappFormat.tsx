import React from 'react';

/**
 * Render plain text with WhatsApp-style markers as React nodes:
 * *bold*  _italic_  ~strike~  ```mono```  `inline`
 */
export function renderWhatsAppFormatted(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  return lines.map((line, lineIdx) => (
    <React.Fragment key={lineIdx}>
      {lineIdx > 0 && '\n'}
      {formatInline(line, `${lineIdx}`)}
    </React.Fragment>
  ));
}

function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  const re =
    /```([\s\S]+?)```|\*([^*\n]+?)\*|_([^_\n]+?)_|~([^~\n]+?)~|`([^`\n]+?)`/g;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const k = `${keyPrefix}-${i++}`;
    if (m[1] != null) {
      nodes.push(
        <code
          key={k}
          className="font-mono text-[0.9em] bg-black/30 px-1 py-0.5 rounded"
        >
          {m[1]}
        </code>
      );
    } else if (m[2] != null) {
      nodes.push(
        <strong key={k} className="font-bold text-white">
          {formatInline(m[2], k)}
        </strong>
      );
    } else if (m[3] != null) {
      nodes.push(
        <em key={k} className="italic text-[#F6E9E9]">
          {formatInline(m[3], k)}
        </em>
      );
    } else if (m[4] != null) {
      nodes.push(
        <span key={k} className="line-through text-[#F6E9E9]/60">
          {formatInline(m[4], k)}
        </span>
      );
    } else if (m[5] != null) {
      nodes.push(
        <code
          key={k}
          className="font-mono text-[0.9em] bg-black/30 px-1 py-0.5 rounded"
        >
          {m[5]}
        </code>
      );
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length ? nodes : [text];
}
