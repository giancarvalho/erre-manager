import { indexHtml } from '../src/web/index-html';
import { absolutizeShareTags, appleAppSiteAssociation, assetLinks } from '../src/web/well-known';

test('share tags become absolute with the public URL', () => {
  const html = absolutizeShareTags(indexHtml(), 'https://app.example.com/');
  expect(html).toContain('<meta property="og:image" content="https://app.example.com/og.png" />');
  expect(html).toContain('<meta property="og:url" content="https://app.example.com/" />');
  expect(html).not.toContain('content="/og.png"');
});

test('apple-app-site-association names the team and bundle, and covers invites', () => {
  const aasa = JSON.parse(appleAppSiteAssociation('ABCDE12345')) as {
    applinks: { details: { appIDs: string[]; components: { '/': string }[] }[] };
  };
  expect(aasa.applinks.details[0]!.appIDs).toEqual(['ABCDE12345.com.erre.app']);
  expect(aasa.applinks.details[0]!.components).toContainEqual({ '/': '/convite/*' });
});

test('assetlinks.json names the package and the certificates', () => {
  const links = JSON.parse(assetLinks(['AA:BB'])) as {
    target: { package_name: string; sha256_cert_fingerprints: string[] };
  }[];
  expect(links[0]!.target).toEqual({
    namespace: 'android_app',
    package_name: 'com.erre.app',
    sha256_cert_fingerprints: ['AA:BB'],
  });
});
