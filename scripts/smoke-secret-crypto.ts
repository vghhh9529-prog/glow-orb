process.env.DISCORD_TOKEN_ENCRYPTION_KEY = "test-only-secret-for-smoke-32-bytes-minimum";

const { decryptSecret, encryptSecret, isEncryptedSecret } = await import("../src/lib/secret-crypto.server");

const plaintext = "discord-access-token-test";
const encrypted = encryptSecret(plaintext);
if (!isEncryptedSecret(encrypted)) throw new Error("secret was not encrypted");
if (encrypted === plaintext) throw new Error("encrypted value equals plaintext");
if (decryptSecret(encrypted) !== plaintext) throw new Error("encrypted secret did not round-trip");
if (decryptSecret(plaintext) !== plaintext) throw new Error("legacy plaintext migration read failed");
if (decryptSecret("v1.invalid") !== null) throw new Error("invalid encrypted secret was accepted");

console.log("[Glow Test] secret encryption round-trip and legacy-read checks passed");
