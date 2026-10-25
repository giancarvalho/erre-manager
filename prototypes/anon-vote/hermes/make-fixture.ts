// Node: builds a 2048-bit fixture signed by the real server library.
import { writeFileSync } from 'node:fs';
import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { blind, bytesToHex, importPublicJwk, prepare, TOKEN_LABEL } from '../src/client';

const suite = RSABSSA.SHA384.PSS.Randomized();
const { privateKey, publicKey } = await suite.generateKey({ modulusLength: 2048, publicExponent: Uint8Array.from([1, 0, 1]) });
const jwk = (await crypto.subtle.exportKey('jwk', publicKey)) as { n: string; e: string };
const pk = importPublicJwk(jwk);
const prefix = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const prepared = prepare(TOKEN_LABEL, () => prefix);
const salt = Uint8Array.from({ length: 48 }, (_, i) => (i * 11 + 5) & 0xff);
const r = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const { blindedMsg, inv } = blind(pk, prepared, { salt, r });
const blindSig = await suite.blindSign(privateKey, blindedMsg);
const sig = await suite.finalize(publicKey, prepared, blindSig, inv);
writeFileSync(new URL('./fixture-2048.json', import.meta.url), JSON.stringify({
  jwk, prepared: bytesToHex(prepared), salt: bytesToHex(salt), r: r.toString(16),
  blinded: bytesToHex(blindedMsg), blindSig: bytesToHex(blindSig), sig: bytesToHex(sig),
}));
console.log('fixture written');
