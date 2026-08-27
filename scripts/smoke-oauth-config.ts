const { assertSupabaseAdminConfigured } = await import("../src/integrations/supabase/client.server");
const { assertEncryptionKeyConfigured } = await import("../src/lib/secret-crypto.server");

const original = {
  encryption: process.env.DISCORD_TOKEN_ENCRYPTION_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

delete process.env.DISCORD_TOKEN_ENCRYPTION_KEY;
let encryptionRejected = false;
try {
  assertEncryptionKeyConfigured();
} catch {
  encryptionRejected = true;
}
if (!encryptionRejected) throw new Error("OAuth config accepted a missing AES key");

process.env.DISCORD_TOKEN_ENCRYPTION_KEY = "test-only-secret-for-smoke-32-bytes-minimum";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.GLOW_SUPABASE_URL;
delete process.env.GLOW_SUPABASE_SERVICE_ROLE_KEY;
let supabaseRejected = false;
try {
  assertSupabaseAdminConfigured();
} catch {
  supabaseRejected = true;
}
if (!supabaseRejected) throw new Error("OAuth config accepted missing Supabase credentials");

if (original.encryption === undefined) delete process.env.DISCORD_TOKEN_ENCRYPTION_KEY;
else process.env.DISCORD_TOKEN_ENCRYPTION_KEY = original.encryption;
if (original.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
else process.env.SUPABASE_URL = original.supabaseUrl;
if (original.supabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
else process.env.SUPABASE_SERVICE_ROLE_KEY = original.supabaseKey;

console.log("[Glow Test] OAuth configuration preflight checks passed");
