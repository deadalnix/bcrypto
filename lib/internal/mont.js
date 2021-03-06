/*!
 * mont.js - key agreement wrapper for ed25519/ed448
 * Copyright (c) 2018, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcrypto
 */

'use strict';

const assert = require('bsert');
const eckey = require('./eckey');
const asn1 = require('./asn1-mini');

/**
 * Mont
 */

class Mont {
  constructor(name, bits, size, oid, ed) {
    assert(typeof name === 'string');
    assert((bits >>> 0) === bits);
    assert((size >>> 0) === size);
    assert(typeof oid === 'string');
    assert(ed && typeof ed === 'object');

    this.id = name;
    this.oid = Buffer.from(oid, 'hex');
    this.ed = ed;
    this.edwards = false;
    this.mont = true;
    this.bits = bits;
    this.size = size;
    this.native = ed.native;
  }

  privateKeyGenerate() {
    return this.ed.scalarGenerate();
  }

  privateKeyVerify(key) {
    return this.ed.scalarVerify(key);
  }

  privateKeyExport(key) {
    assert(this.privateKeyVerify(key));
    return asn1.encodeOct(key);
  }

  privateKeyImport(raw) {
    const key = asn1.decodeOct(raw);
    assert(this.privateKeyVerify(key));
    return Buffer.from(key);
  }

  privateKeyExportPKCS8(key) {
    assert(this.privateKeyVerify(key));

    return asn1.encodePKCS8({
      version: 0,
      algorithm: {
        oid: this.oid,
        type: asn1.NULL,
        params: null
      },
      key: this.privateKeyExport(key)
    });
  }

  privateKeyImportPKCS8(raw) {
    const pki = asn1.decodePKCS8(raw);

    assert(pki.version === 0 || pki.version === 1);
    assert(pki.algorithm.oid.equals(this.oid));
    assert(pki.algorithm.type === asn1.NULL);

    return this.privateKeyImport(pki.key);
  }

  privateKeyExportJWK(key) {
    return eckey.privateKeyExportJWK(this, key);
  }

  privateKeyImportJWK(json) {
    return eckey.privateKeyImportJWK(this, json);
  }

  publicKeyCreate(key) {
    return this.ed.publicKeyConvert(this.ed.publicKeyFromScalar(key));
  }

  publicKeyVerify(key) {
    assert(Buffer.isBuffer(key));
    return key.length === this.size;
  }

  publicKeyExport(key) {
    assert(this.publicKeyVerify(key));
    return Buffer.from(key);
  }

  publicKeyImport(raw) {
    assert(this.publicKeyVerify(raw));
    return Buffer.from(raw);
  }

  publicKeyExportSPKI(key) {
    return asn1.encodeSPKI({
      algorithm: {
        oid: this.oid,
        type: asn1.NULL,
        params: null
      },
      key: this.publicKeyExport(key)
    });
  }

  publicKeyImportSPKI(raw) {
    const spki = asn1.decodeSPKI(raw);

    assert(spki.algorithm.oid.equals(this.oid));
    assert(spki.algorithm.type === asn1.NULL);

    return this.publicKeyImport(spki.key);
  }

  publicKeyExportJWK(key) {
    return eckey.publicKeyExportJWK(this, key);
  }

  publicKeyImportJWK(json) {
    return eckey.publicKeyImportJWK(this, json, false);
  }

  derive(pub, priv) {
    return this.ed.exchangeWithScalar(pub, priv);
  }
}

/*
 * Expose
 */

module.exports = Mont;
