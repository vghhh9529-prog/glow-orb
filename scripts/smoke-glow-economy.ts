import { strict as assert } from "node:assert";
import {
  dailyRewardForStreak,
  dailyStreakForClaim,
} from "../src/lib/glow.server";

const now = Date.parse("2026-08-27T12:00:00.000Z");

assert.equal(dailyRewardForStreak(1), 300);
assert.equal(dailyRewardForStreak(10), 750);
assert.equal(dailyRewardForStreak(999), 750);
assert.equal(dailyRewardForStreak(Number.NaN), 300);
assert.equal(dailyStreakForClaim(null, 0, now), 1);
assert.equal(dailyStreakForClaim("2026-08-26T12:00:00.000Z", 3, now), 4);
assert.equal(dailyStreakForClaim("2026-08-25T23:59:59.000Z", 3, now), 1);
assert.equal(dailyStreakForClaim("not-a-date", 3, now), 1);
assert.equal(dailyStreakForClaim("2026-08-27T11:00:00.000Z", 999, now), 999);

console.log("Glow economy smoke checks passed");
