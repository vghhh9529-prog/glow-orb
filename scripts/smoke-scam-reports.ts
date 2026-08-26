import {
  isScamReviewButton,
  SCAMMER_ROLE_ID,
  SCAM_REVIEW_CHANNEL_ID,
} from "../src/lib/scam-reports.server";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

assert(SCAM_REVIEW_CHANNEL_ID === "1542130215713509437", "review channel changed unexpectedly");
assert(SCAMMER_ROLE_ID === "1542129398830866523", "scammer role changed unexpectedly");
assert(isScamReviewButton("glow_scam_approve:00000000-0000-0000-0000-000000000000"), "approve action not recognized");
assert(isScamReviewButton("glow_scam_delete:00000000-0000-0000-0000-000000000000"), "delete action not recognized");
assert(!isScamReviewButton("glow_ticket_delete"), "ticket action was misclassified as scam review");
assert(!isScamReviewButton("glow_scam_approve"), "malformed review action was recognized");

console.log("[Glow Test] scam report review routing and fixed Discord targets passed");
