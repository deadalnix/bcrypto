/*!
 * schnorr.js - bip-schnorr for bcrypto
 * Copyright (c) 2019, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcrypto
 *
 * Parts of this software are based on sipa/bip-schnorr:
 *   https://github.com/sipa/bips/blob/bip-schnorr/bip-schnorr/reference.py
 *
 * Parts of this software are based on ElementsProject/secp256k1-zkp:
 *   https://github.com/ElementsProject/secp256k1-zkp/tree/secp256k1-zkp/src/modules/schnorrsig
 *
 * Resources:
 *   https://github.com/sipa/bips/blob/bip-schnorr/bip-schnorr.mediawiki
 *   https://github.com/sipa/bips/blob/bip-schnorr/bip-schnorr/reference.py
 *   https://github.com/sipa/bips/blob/bip-schnorr/bip-schnorr/test-vectors.csv
 *   https://github.com/ElementsProject/secp256k1-zkp
 *   https://github.com/ElementsProject/secp256k1-zkp/tree/secp256k1-zkp/src/modules/musig
 *   https://github.com/ElementsProject/secp256k1-zkp/tree/secp256k1-zkp/src/modules/schnorrsig
 */

'use strict';

const assert = require('bsert');
const primes = require('../internal/primes');
const BN = require('../bn.js');
const {jacobi, randomInt} = primes;

/**
 * Schnorr
 */

class Schnorr {
  constructor(curve) {
    this.curve = curve;
  }

  sign(msg, key) {
    assert(Buffer.isBuffer(msg));
    assert(Buffer.isBuffer(key));
    assert(msg.length === this.curve.size);
    assert(key.length === this.curve.size);

    const N = this.curve.n;
    const P = this.curve.p;
    const G = this.curve.g;

    // Let k' = int(hash(bytes(d) || m)) mod n
    let k = this.curve.hashInt(key, msg);

    // Fail if k' = 0.
    if (k.isZero())
      throw new Error('Signing failed (k\' = 0).');

    // Let R = k'*G.
    const Rp = G.mul(k);

    // Let k = k' if jacobi(y(R)) = 1, otherwise let k = n - k'.
    if (jacobi(Rp.getY(), P) !== 1)
      k = N.sub(k);

    // The secret key d: an integer in the range 1..n-1.
    const a = this.curve.decodeInt(key);

    if (a.isZero() || a.cmp(this.curve.n) >= 0)
      throw new Error('Invalid private key.');

    // Let e = int(hash(bytes(x(R)) || bytes(d*G) || m)) mod n.
    const Araw = this.curve.encodePoint(G.mul(a));
    const Rraw = this.curve.encodeInt(Rp.getX());
    const e = this.curve.hashInt(Rraw, Araw, msg);

    // The signature is bytes(x(R)) || bytes(k + e*d mod n).
    const S = k.add(e.mul(a)).umod(N);

    return Buffer.concat([Rraw, this.curve.encodeInt(S)]);
  }

  verify(msg, sig, key) {
    assert(Buffer.isBuffer(msg));
    assert(Buffer.isBuffer(sig));
    assert(Buffer.isBuffer(key));

    try {
      return this._verify(msg, sig, key);
    } catch (e) {
      return false;
    }
  }

  _verify(msg, sig, key) {
    assert(Buffer.isBuffer(msg));
    assert(Buffer.isBuffer(sig));
    assert(Buffer.isBuffer(key));

    if (msg.length !== this.curve.size)
      return false;

    if (sig.length !== this.curve.size * 2)
      return false;

    const N = this.curve.n;
    const P = this.curve.p;
    const G = this.curve.g;

    // Let P = point(pk); fail if point(pk) fails.
    const A = this.curve.decodePoint(key);

    // Let r = int(sig[0:32]); fail if r >= p.
    // Let s = int(sig[32:64]); fail if s >= n.
    const Rraw = sig.slice(0, this.curve.size);
    const Sraw = sig.slice(this.curve.size);
    const R = this.curve.decodeInt(Rraw);
    const S = this.curve.decodeInt(Sraw);

    if (R.cmp(P) >= 0 || S.cmp(N) >= 0)
      return false;

    // Let e = int(hash(bytes(r) || bytes(P) || m)) mod n.
    const e = this.curve.hashInt(Rraw, key, msg);

    // Let R = s*G - e*P.
    const Rp = G.mul(S).add(A.mul(N.sub(e)));

    // Fail if infinite(R) or jacobi(y(R)) != 1 or x(R) != r.
    if (Rp.isInfinity())
      return false;

    if (jacobi(Rp.getY(), P) !== 1)
      return false;

    if (!Rp.getX().eq(R))
      return false;

    return true;
  }

  batchVerify(batch) {
    assert(Array.isArray(batch));

    if (batch.length === 0)
      return true;

    for (const item of batch) {
      assert(item && typeof item === 'object');

      const {message, signature, key} = item;

      assert(Buffer.isBuffer(message));
      assert(Buffer.isBuffer(signature));
      assert(Buffer.isBuffer(key));

      if (message.length !== this.curve.size)
        return false;

      if (signature.length !== this.curve.size * 2)
        return false;
    }

    try {
      return this._batchVerify(batch);
    } catch (e) {
      return false;
    }
  }

  _batchVerify(batch) {
    const N = this.curve.n;
    const P = this.curve.p;
    const G = this.curve.g;

    const three = new BN(3);
    const red7 = new BN(7).toRed(this.curve.red);
    const exp = P.addn(1).divn(4);
    const items = [];

    // Preprocess signatures.
    for (const {message, signature, key} of batch) {
      // Let Pi = point(pki); fail if point(pki) fails.
      const A = this.curve.decodePoint(key);

      // Let r = int(sigi[0:32]); fail if r >= p.
      // Let si = int(sigi[32:64]); fail if si >= n.
      const Rraw = signature.slice(0, this.curve.size);
      const Sraw = signature.slice(this.curve.size);
      const R = this.curve.decodeInt(Rraw);
      const S = this.curve.decodeInt(Sraw);

      if (R.cmp(P) >= 0 || S.cmp(N) >= 0)
        return false;

      // Let ei = int(hash(bytes(r) || bytes(Pi) || mi)) mod n.
      const e = this.curve.hashInt(Rraw, key, message);

      // Switch to modular arithmetic.
      const Rred = R.toRed(this.curve.red);

      // Let c = (r^3 + 7) mod p.
      const c = Rred.redPow(three).redIAdd(red7);

      // Let y = c^((p+1)/4) mod p.
      const y = c.redPow(exp);

      // Fail if c != y^2 mod p.
      if (!c.eq(y.redSqr()))
        return false;

      // Let Ri = (r, y).
      const Ri = this.curve.point(Rred, y);

      items.push({
        A,
        S,
        e,
        R: Ri
      });
    }

    // Let lhs = s1 + a2*s2 + ... + au*su.
    // Let rhs = R1 + a2*R2 + ... + au*Ru + e1*P1 + (a2*e2)P2 + ... + (au*eu)Pu.
    const item = items[0];

    let lhs = item.S;
    let rhs = item.R.add(item.A.mul(item.e));

    for (let i = 1; i < items.length; i++) {
      const {A, S, e, R} = items[i];

      // Generate u-1 random integers a2...u in the range 1...n-1.
      let a = null;

      do {
        a = randomInt(N);
      } while (a.isZero());

      lhs = lhs.iadd(a.mul(S)).umod(N);
      rhs = rhs.add(R.mulAdd(a, A, a.mul(e)));
    }

    // Fail if lhs*G != rhs.
    return G.mul(lhs).eq(rhs);
  }
}

/*
 * Expose
 */

module.exports = Schnorr;
