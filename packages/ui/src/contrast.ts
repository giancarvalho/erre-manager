// WCAG 2 contrast for tokens (DESIGN §3.5). Translucent colors are composited over their background.

type RGBA = { r: number; g: number; b: number; a: number };

export function parseColor(value: string): RGBA {
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: hex[2] ? parseInt(hex[2], 16) / 255 : 1 };
  }
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value.replace(/\s+/g, ''));
  if (rgba) return { r: +rgba[1]!, g: +rgba[2]!, b: +rgba[3]!, a: rgba[4] === undefined ? 1 : +rgba[4] };
  throw new Error(`unsupported color ${value}`);
}

/** `top` drawn over an opaque `bottom`. */
export function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function luminance({ r, g, b }: RGBA): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Contrast ratio of `fg` on `bg`; translucent layers are composited onto `base` (the canvas). */
export function contrast(fg: string, bg: string, base = '#000000'): number {
  const b = over(parseColor(bg), parseColor(base));
  const f = over(parseColor(fg), b);
  const [l1, l2] = [luminance(f), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}
