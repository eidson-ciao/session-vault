// AES-GCM encryption with PBKDF2 key derivation.
// Format (JSON):
// {
//   v: 1,
//   alg: "AES-GCM",
//   kdf: "PBKDF2-SHA256",
//   iterations: 250000,
//   salt: <base64>,
//   iv: <base64>,
//   ct: <base64>           // ciphertext (includes auth tag)
// }

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJSON(obj, password) {
  const iterations = 250000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const plaintext = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: b64encode(salt),
    iv: b64encode(iv),
    ct: b64encode(ct),
  };
}

export async function decryptJSON(envelope, password) {
  if (!envelope || envelope.v !== 1) throw new Error("不支持的文件版本");
  const salt = new Uint8Array(b64decode(envelope.salt));
  const iv = new Uint8Array(b64decode(envelope.iv));
  const key = await deriveKey(password, salt, envelope.iterations || 250000);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, b64decode(envelope.ct));
  } catch (e) {
    throw new Error("解密失败：密码错误或文件已损坏");
  }
  return JSON.parse(dec.decode(pt));
}
