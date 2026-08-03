/**
 * WhatsApp *bold* / _italic_ markup works in chat messages, but often
 * does NOT apply to image captions from the Web Share API.
 * Convert markers to Unicode styled letters so captions still look formatted.
 */

function mapAscii(
  text: string,
  upperStart: number,
  lowerStart: number,
  digitStart: number | null
): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(upperStart + (code - 0x41));
    } else if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(lowerStart + (code - 0x61));
    } else if (digitStart != null && code >= 0x30 && code <= 0x39) {
      out += String.fromCodePoint(digitStart + (code - 0x30));
    } else {
      out += ch;
    }
  }
  return out;
}

/** Mathematical Sans-Serif Bold */
function toBold(text: string): string {
  return mapAscii(text, 0x1d5d4, 0x1d5ee, 0x1d7ec);
}

/** Mathematical Sans-Serif Italic */
function toItalic(text: string): string {
  return mapAscii(text, 0x1d608, 0x1d622, null);
}

/** Combining long stroke overlay */
function toStrike(text: string): string {
  return [...text].map(ch => (ch === ' ' || ch === '\n' ? ch : ch + '\u0336')).join('');
}

/**
 * Replace WhatsApp markers with Unicode styled text for share captions.
 * Supports nesting by applying innermost matches repeatedly.
 */
export function whatsappMarkupToShareText(input: string): string {
  let text = input;
  // Run a few passes for nested styles like *_bold italic_*
  for (let pass = 0; pass < 4; pass++) {
    const before = text;
    text = text.replace(/\*([^*\n]+?)\*/g, (_, inner: string) => toBold(inner));
    text = text.replace(/_([^_\n]+?)_/g, (_, inner: string) => toItalic(inner));
    text = text.replace(/~([^~\n]+?)~/g, (_, inner: string) => toStrike(inner));
    if (text === before) break;
  }
  return text;
}
