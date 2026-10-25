// Runs the pure-JS blind signature client against a fixture signed by the real
// server library (@cloudflare/blindrsa-ts), inside whatever JS engine the app runs on.
import { blind, bytesToHex, finalize, hexToBytes, importPublicJwk, verify } from './anon-vote';
import fx from './fixture-2048.json';

export type SelfTestResult = { ok: boolean; ms: number; detail: string };

export function runBlindSignatureSelfTest(): SelfTestResult {
  const start = Date.now();
  try {
    const pk = importPublicJwk(fx.jwk);
    const prepared = hexToBytes(fx.prepared);
    const out = blind(pk, prepared, { salt: hexToBytes(fx.salt), r: BigInt('0x' + fx.r) });
    if (bytesToHex(out.blindedMsg) !== fx.blinded) return { ok: false, ms: Date.now() - start, detail: 'cegamento diferente do servidor' };
    const sig = finalize(pk, prepared, hexToBytes(fx.blindSig), out.inv);
    const ok = bytesToHex(sig) === fx.sig && verify(pk, prepared, sig);
    return { ok, ms: Date.now() - start, detail: ok ? 'assinatura confere com a biblioteca do servidor' : 'assinatura diferente' };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, detail: e instanceof Error ? e.message : String(e) };
  }
}
