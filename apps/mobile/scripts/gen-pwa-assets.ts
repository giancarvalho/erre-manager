/// <reference types="node" />
// Static PWA icons and the share (OG) image (P-008, provisional A: generated once, committed). The brand is the 🦄
// over the dark canvas with the cyan glow (DESIGN §2); the icon never changes with the theme (§3.1).
// Run: pnpm --filter @erre/mobile exec tsx scripts/gen-pwa-assets.ts (needs Chromium with color emoji).
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { themes } from '@erre/ui/tokens';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');
const canvas = themes.dark.bg.canvas;
// The accent glow (DESIGN §7), a bit stronger than on screen so it reads at icon size.
// eslint-disable-next-line erre/no-raw-style -- built from the token, for an image, not a screen
const glow = `rgb(${themes.dark.accent.glowRgb} / 0.22)`;
const geist = path.dirname(createRequire(import.meta.url).resolve('@expo-google-fonts/geist/package.json'));
const font = (file: string) => readFileSync(path.join(geist, file)).toString('base64');

/** The brand on a square: `scale` is how much of the side the emoji takes (maskable icons keep it in the safe zone). */
const icon = (side: number, scale: number) => `
  <div style="width:${side}px;height:${side}px;background:radial-gradient(circle at 50% 50%, ${glow}, ${canvas} 48%);
    display:flex;align-items:center;justify-content:center">
    <span style="font-size:${Math.round(side * scale)}px;line-height:1;font-family:'Noto Color Emoji'">🦄</span>
  </div>`;

const og = `
  <style>
    @font-face{font-family:Geist;font-weight:400;src:url(data:font/ttf;base64,${font('400Regular/Geist_400Regular.ttf')})}
    @font-face{font-family:Geist;font-weight:700;src:url(data:font/ttf;base64,${font('700Bold/Geist_700Bold.ttf')})}
  </style>
  <div style="width:1200px;height:630px;background:radial-gradient(circle at 20% 50%, ${glow}, ${canvas} 32%);
    display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;font-family:Geist;color:${themes.dark.text.primary}">
    <span style="font-size:220px;line-height:1;font-family:'Noto Color Emoji'">🦄</span>
    <div style="display:flex;flex-direction:column;gap:20px">
      <span style="font-size:28px;letter-spacing:4px;color:${themes.dark.text.muted}">VOTAÇÃO EM GRUPO</span>
      <span style="font-size:96px;font-weight:700;letter-spacing:-2px">Errômetro</span>
      <span style="font-size:34px;color:${themes.dark.text.secondary}">Um emoji por pessoa, a cada rodada. Anônimo.</span>
    </div>
  </div>`;

const assets: { file: string; width: number; height: number; html: string }[] = [
  { file: 'icons/icon-192.png', width: 192, height: 192, html: icon(192, 0.62) },
  { file: 'icons/icon-512.png', width: 512, height: 512, html: icon(512, 0.62) },
  { file: 'icons/maskable-512.png', width: 512, height: 512, html: icon(512, 0.46) },
  { file: 'icons/apple-touch-icon.png', width: 180, height: 180, html: icon(180, 0.6) },
  { file: 'og.png', width: 1200, height: 630, html: og },
];

async function main() {
  const browser = await chromium.launch();
  try {
    mkdirSync(path.join(out, 'icons'), { recursive: true });
    for (const a of assets) {
      const page = await browser.newPage({ viewport: { width: a.width, height: a.height } });
      await page.setContent(`<body style="margin:0">${a.html}</body>`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, a.file), omitBackground: false });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

void main();
