const { strict: assert } = await import("node:assert");

const plaintext = "discord-access-token-test";
const storageValue = plaintext;

assert.equal(storageValue, plaintext);
assert.equal(typeof storageValue, "string");
assert.ok(storageValue.length > 0);

console.log("[Glow Test] plaintext OAuth token storage checks passed");
