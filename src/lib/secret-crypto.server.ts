import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function encryptionKey() {
  const secret = process.env["DISCORD_TOKEN_ENCRYPTION_KEY"]?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("DISCORD_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function assertEncryptionKeyConfigured() {
  encryptionKey();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith(`${VERSION}.`)) return value;
  try {
    const parts = value.split(".");
    if (parts.length !== 4) return null;
    const [, encodedIv, encodedTag, encodedCiphertext] = parts;
    const iv = Buffer.from(encodedIv!, "base64url");
    const tag = Buffer.from(encodedTag!, "base64url");
    const ciphertext = Buffer.from(encodedCiphertext!, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isEncryptedSecret(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(`${VERSION}.`);
}
