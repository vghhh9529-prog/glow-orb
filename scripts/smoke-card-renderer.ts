import { renderBalanceCard, renderProfileCard } from "../src/lib/card-renderer.server";

const png = await renderProfileCard({
  username: "demo_user",
  displayName: "Demo User",
  userId: "123456789012345678",
  level: 12,
  xp: 3456,
  rank: 4,
  discordCreatedAt: new Date(Date.now() - 18 * 31_536_000).toISOString(),
  serverJoinedAt: new Date(Date.now() - 8 * 604_800).toISOString(),
});

if (png.length < 10_000) throw new Error(`PNG output is unexpectedly small: ${png.length}`);
if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Output is not a PNG");

const balancePng = await renderBalanceCard({
  username: "demo_user",
  displayName: "Demo User",
  userId: "123456789012345678",
  balance: 12_345,
  streak: 7,
  totalEarned: 54_321,
});
if (balancePng.length < 10_000) throw new Error(`Balance card is unexpectedly small: ${balancePng.length}`);
if (balancePng.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Balance output is not a PNG");
console.log(`card renderer ok: profile=${png.length} bytes, balance=${balancePng.length} bytes`);
