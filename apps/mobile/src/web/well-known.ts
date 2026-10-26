// Files the web build adds next to the app (CORE-21, CORE-22): absolute share-image URLs and the universal-link
// files for iOS and Android. They depend on values only known at deploy time (public URL, Apple team, signing
// certificate); without them, nothing is written: no placeholder ever reaches production.
import app from '../../app.json';

const IOS_BUNDLE = app.expo.ios.bundleIdentifier;
const ANDROID_PACKAGE = app.expo.android.package;

/** Paths the native app opens instead of the browser: invites and every in-app route. */
const APP_PATHS = ['/convite/*', '/errometro/*', '/eventos/*', '/comunidade/*', '/'];

/** og:image (and og:url) absolute: WhatsApp and most crawlers ignore relative URLs. */
export function absolutizeShareTags(html: string, webUrl: string): string {
  const base = webUrl.replace(/\/$/, '');
  return html
    .replace('<meta property="og:image" content="/og.png" />', `<meta property="og:image" content="${base}/og.png" />`)
    .replace(
      '<meta property="og:type" content="website" />',
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${base}/" />`,
    );
}

/** iOS universal links (apple-app-site-association), for the team that signs the app. */
export function appleAppSiteAssociation(teamId: string): string {
  const appID = `${teamId}.${IOS_BUNDLE}`;
  return `${JSON.stringify(
    {
      applinks: { details: [{ appIDs: [appID], components: APP_PATHS.map((p) => ({ '/': p })) }] },
      webcredentials: { apps: [appID] },
    },
    null,
    2,
  )}\n`;
}

/** Android App Links (assetlinks.json), for the certificates that sign the app (SHA-256, "AA:BB:..."). */
export function assetLinks(fingerprints: string[]): string {
  return `${JSON.stringify(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
      },
    ],
    null,
    2,
  )}\n`;
}
