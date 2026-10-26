import { themeBootScript } from '@erre/ui/boot';
import { themes } from '@erre/ui/tokens';

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
    <title>Erre</title>
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
