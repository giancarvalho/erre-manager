// Portado de queridometro@7c5c5bf:src/lib/emojis/infer-glow-color.ts
// Infers an "R G B" glow color from an emoji's rendered colors, for the trophy glow of a custom emoji
// (catalog emojis use TROPHY_GLOW_RGB). Browser only (canvas). On native there is no canvas: the glow is
// computed once when the emoji is created on the web and stored with it; created on native, it stays
// DEFAULT_TROPHY_GLOW_RGB (D-042).
import { DEFAULT_TROPHY_GLOW_RGB } from './trophy-catalog';

type Ctx2D = {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (t: string, x: number, y: number) => void;
  getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray };
  font: string;
  textAlign: string;
  textBaseline: string;
};
type Doc = {
  createElement: (tag: 'canvas') => {
    width: number;
    height: number;
    getContext: (k: '2d', o?: object) => Ctx2D | null;
  };
};

export function inferEmojiGlowColor(char: string): string {
  const document = (globalThis as { document?: Doc }).document;
  if (!document) return DEFAULT_TROPHY_GLOW_RGB;

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_TROPHY_GLOW_RGB;

  ctx.clearRect(0, 0, size, size);
  ctx.font = `${Math.round(size * 0.8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, size / 2, size / 2 + 1);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return DEFAULT_TROPHY_GLOW_RGB;
  }

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (saturation < 0.15) continue;
    if (lightness > 240 || lightness < 15) continue;
    rSum += r;
    gSum += g;
    bSum += b;
    count++;
  }
  if (count === 0) return DEFAULT_TROPHY_GLOW_RGB;
  return `${Math.round(rSum / count)} ${Math.round(gSum / count)} ${Math.round(bSum / count)}`;
}
