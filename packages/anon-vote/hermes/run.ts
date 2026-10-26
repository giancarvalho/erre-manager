// Runs inside Hermes (no console, no crypto, no TextEncoder): uses print().
import rfc from '../test/rfc9474-a1.json';
import fx from './fixture-2048.json';
import {
  blind,
  bytesToBase64Url,
  bytesToBigInt,
  bytesToHex,
  finalize,
  hexToBytes,
  importPublicJwk,
  modInverse,
  verify,
  voterTagFromPreparedMsg,
} from '../src/client';

declare function print(...args: unknown[]): void;
let failures = 0;
function check(name: string, ok: boolean) {
  print((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) failures++;
}

const pkRfc = importPublicJwk({ n: bytesToBase64Url(hexToBytes(rfc.n)), e: bytesToBase64Url(hexToBytes(rfc.e)) });
const rRfc = modInverse(bytesToBigInt(hexToBytes(rfc.inv)), pkRfc.n);
const outRfc = blind(pkRfc, hexToBytes(rfc.prepared_msg), { salt: hexToBytes(rfc.salt), r: rRfc });
check('RFC 9474 A.1 encoded_msg', bytesToHex(outRfc.encodedMsg) === rfc.encoded_msg);
check('RFC 9474 A.1 blinded_msg', bytesToHex(outRfc.blindedMsg) === rfc.blinded_msg);
const sigRfc = finalize(pkRfc, hexToBytes(rfc.prepared_msg), hexToBytes(rfc.blind_sig), hexToBytes(rfc.inv));
check('RFC 9474 A.1 sig', bytesToHex(sigRfc) === rfc.sig);

const pk = importPublicJwk(fx.jwk);
const t0 = Date.now();
const out = blind(pk, hexToBytes(fx.prepared), { salt: hexToBytes(fx.salt), r: BigInt('0x' + fx.r) });
const t1 = Date.now();
check('2048-bit blind matches Node', bytesToHex(out.blindedMsg) === fx.blinded);
const sig = finalize(pk, hexToBytes(fx.prepared), hexToBytes(fx.blindSig), out.inv);
const t2 = Date.now();
check('2048-bit finalize matches server library', bytesToHex(sig) === fx.sig);
check('2048-bit signature verifies', verify(pk, hexToBytes(fx.prepared), sig));
check('voter tag is 64 hex chars', voterTagFromPreparedMsg(hexToBytes(fx.prepared)).length === 64);
print('timing ms: blind=' + (t1 - t0) + ' finalize+verify=' + (t2 - t1));
print(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
