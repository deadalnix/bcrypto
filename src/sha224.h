#ifndef _BCRYPTO_SHA224_H
#define _BCRYPTO_SHA224_H
#include <node.h>
#include <nan.h>
#include "openssl/sha.h"

class SHA224 : public Nan::ObjectWrap {
public:
  static NAN_METHOD(New);
  static void Init(v8::Local<v8::Object> &target);

  SHA224();
  ~SHA224();

  SHA256_CTX ctx;

private:
  static NAN_METHOD(Init);
  static NAN_METHOD(Update);
  static NAN_METHOD(Final);
  static NAN_METHOD(Digest);
  static NAN_METHOD(Root);
  static NAN_METHOD(Multi);
};
#endif