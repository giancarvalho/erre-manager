import { themeBootScript } from '@erre/ui/boot';
import { themes } from '@erre/ui/tokens';

/** Brand name (DESIGN §2) and the one-line pitch, shared by the page, the PWA manifest and the share image. */
export const APP_NAME = 'Errômetro';
export const DESCRIPTION = 'Um emoji por pessoa, a cada rodada. Votação anônima da sua comunidade.';

/** PWA manifest (CORE-20): installable on Android and iOS, dark like the icon (DESIGN §3.1: the icon never changes). */
export function webManifest(): string {
  const manifest = {
    name: APP_NAME,
    short_name: APP_NAME,
    description: DESCRIPTION,
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: themes.dark.bg.canvas,
    theme_color: themes.dark.bg.canvas,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Web SPA template (Expo uses public/index.html). pt-BR, theme-color, and the inline script that applies
 * the saved theme before the bundle loads (DESIGN §3.1).
 */
export function indexHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <meta name="theme-color" content="${themes.dark.bg.canvas}" />
    <meta name="color-scheme" content="dark light" />
    <title>${APP_NAME}</title>
    <meta name="description" content="${DESCRIPTION}" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="${APP_NAME}" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${APP_NAME}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:image" content="/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <script>${themeBootScript}</script>
    <style id="expo-reset">
      html,
      body {
        height: 100%;
      }
      /* Default before the boot script runs; the script replaces it with the saved theme. */
      html {
        background-color: ${themes.dark.bg.canvas};
      }
      @media (prefers-reduced-motion: no-preference) {
        html { transition: background-color 150ms ease-out; }
      }
      body {
        overflow: hidden;
      }
      #root {
        display: flex;
        height: 100%;
        flex: 1;
      }
    </style>
  </head>
  <body>
    <noscript>Você precisa ativar o JavaScript para usar o app.</noscript>
    <div id="root"></div>
  </body>
</html>
`;
}
