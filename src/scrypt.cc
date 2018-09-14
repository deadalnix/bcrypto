#include <assert.h>
#include <string.h>
#include <node.h>
#include <nan.h>

#include "scrypt/scrypt.h"
#include "scrypt.h"
#include "scrypt_async.h"

static Nan::Persistent<v8::FunctionTemplate> scrypt_constructor;

BScrypt::BScrypt() {}

BScrypt::~BScrypt() {}

void
BScrypt::Init(v8::Local<v8::Object> &target) {
  Nan::HandleScope scope;

  v8::Local<v8::FunctionTemplate> tpl =
    Nan::New<v8::FunctionTemplate>(BScrypt::New);

  scrypt_constructor.Reset(tpl);

  tpl->SetClassName(Nan::New("Scrypt").ToLocalChecked());
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  Nan::SetMethod(tpl, "derive", BScrypt::Derive);
  Nan::SetMethod(tpl, "deriveAsync", BScrypt::DeriveAsync);

  v8::Local<v8::FunctionTemplate> ctor =
    Nan::New<v8::FunctionTemplate>(scrypt_constructor);

  target->Set(Nan::New("scrypt").ToLocalChecked(), ctor->GetFunction());
}

NAN_METHOD(BScrypt::New) {
  return Nan::ThrowError("Could not create Scrypt instance.");
}

NAN_METHOD(BScrypt::Derive) {
  if (info.Length() < 6)
    return Nan::ThrowError("scrypt.derive() requires arguments.");

  v8::Local<v8::Object> pbuf = info[0].As<v8::Object>();

  if (!node::Buffer::HasInstance(pbuf))
    return Nan::ThrowTypeError("First argument must be a buffer.");

  v8::Local<v8::Object> sbuf = info[1].As<v8::Object>();

  if (!node::Buffer::HasInstance(sbuf))
    return Nan::ThrowTypeError("Second argument must be a buffer.");

  if (!info[2]->IsNumber())
    return Nan::ThrowTypeError("Third argument must be a number.");

  if (!info[3]->IsNumber())
    return Nan::ThrowTypeError("Fourth argument must be a number.");

  if (!info[4]->IsNumber())
    return Nan::ThrowTypeError("Fifth argument must be a number.");

  if (!info[5]->IsNumber())
    return Nan::ThrowTypeError("Sixth argument must be a number.");

  const uint8_t *pass = (const uint8_t *)node::Buffer::Data(pbuf);
  uint32_t passlen = (uint32_t)node::Buffer::Length(pbuf);
  const uint8_t *salt = (const uint8_t *)node::Buffer::Data(sbuf);
  size_t saltlen = (size_t)node::Buffer::Length(sbuf);
  uint64_t N = (uint64_t)info[2]->IntegerValue();
  uint64_t r = (uint64_t)info[3]->IntegerValue();
  uint64_t p = (uint64_t)info[4]->IntegerValue();
  size_t keylen = (size_t)info[5]->IntegerValue();

  uint8_t *key = (uint8_t *)malloc(keylen);

  if (key == NULL)
    return Nan::ThrowError("Could not allocate key.");

  if (!bcrypto_scrypt(pass, passlen, salt, saltlen, N, r, p, key, keylen)) {
    free(key);
    return Nan::ThrowError("Scrypt failed.");
  }

  info.GetReturnValue().Set(
    Nan::NewBuffer((char *)key, keylen).ToLocalChecked());
}

NAN_METHOD(BScrypt::DeriveAsync) {
  if (info.Length() < 6)
    return Nan::ThrowError("scrypt.deriveAsync() requires arguments.");

  v8::Local<v8::Object> pbuf = info[0].As<v8::Object>();

  if (!node::Buffer::HasInstance(pbuf))
    return Nan::ThrowTypeError("First argument must be a buffer.");

  v8::Local<v8::Object> sbuf = info[1].As<v8::Object>();

  if (!node::Buffer::HasInstance(sbuf))
    return Nan::ThrowTypeError("Second argument must be a buffer.");

  if (!info[2]->IsNumber())
    return Nan::ThrowTypeError("Third argument must be a number.");

  if (!info[3]->IsNumber())
    return Nan::ThrowTypeError("Fourth argument must be a number.");

  if (!info[4]->IsNumber())
    return Nan::ThrowTypeError("Fifth argument must be a number.");

  if (!info[5]->IsNumber())
    return Nan::ThrowTypeError("Sixth argument must be a number.");

  if (!info[6]->IsFunction())
    return Nan::ThrowTypeError("Seventh argument must be a Function.");

  v8::Local<v8::Function> callback = info[6].As<v8::Function>();

  const uint8_t *pass = (const uint8_t *)node::Buffer::Data(pbuf);
  uint32_t passlen = (uint32_t)node::Buffer::Length(pbuf);
  const uint8_t *salt = (const uint8_t *)node::Buffer::Data(sbuf);
  size_t saltlen = (size_t)node::Buffer::Length(sbuf);
  uint64_t N = (uint64_t)info[2]->IntegerValue();
  uint64_t r = (uint64_t)info[3]->IntegerValue();
  uint64_t p = (uint64_t)info[4]->IntegerValue();
  size_t keylen = (size_t)info[5]->IntegerValue();

  BScryptWorker *worker = new BScryptWorker(
    pbuf,
    sbuf,
    pass,
    passlen,
    salt,
    saltlen,
    N,
    r,
    p,
    keylen,
    new Nan::Callback(callback)
  );

  Nan::AsyncQueueWorker(worker);
}