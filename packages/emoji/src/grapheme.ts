// Portado de queridometro@7c5c5bf:src/lib/emojis/emoji-grapheme.ts, com alternativa sem Intl.Segmenter
// (o Hermes do React Native não tem). O servidor (Node) sempre usa o Segmenter e é quem decide.

/** Code points that attach to the previous one instead of starting a new cluster. */
function attaches(cp: number): boolean {
  return (
    (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors
    (cp >= 0x1f3fb && cp <= 0x1f3ff) || // skin tones
    cp === 0x20e3 || // combining keycap
    (cp >= 0xe0020 && cp <= 0xe007f) || // tags (subdivision flags)
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacritics
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x20d0 && cp <= 0x20ff)
  );
}

const isRegionalIndicator = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

/** Grapheme count by code point rules good enough for emoji (fallback when Intl.Segmenter is missing). */
export function countGraphemesFallback(value: string): number {
  let clusters = 0;
  let joinNext = false;
  let pendingRegional = false;
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x200d) {
      joinNext = true;
      continue;
    }
    if (joinNext || attaches(cp)) {
      joinNext = false;
      if (clusters === 0) clusters = 1;
      continue;
    }
    if (isRegionalIndicator(cp)) {
      if (pendingRegional) {
        pendingRegional = false;
        continue;
      }
      pendingRegional = true;
      clusters += 1;
      continue;
    }
    pendingRegional = false;
    clusters += 1;
  }
  return clusters;
}

type SegmenterCtor = new (
  locale?: string,
  opts?: { granularity: 'grapheme' },
) => { segment: (s: string) => Iterable<unknown> };

/**
 * Exactly one grapheme cluster: rejects pasted text, empty strings, or several emoji glued together.
 * Pure on purpose: used by the API and the app's form.
 */
export function isSingleGrapheme(value: string): boolean {
  if (value.length === 0) return false;
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length === 1;
  return countGraphemesFallback(value) === 1;
}
