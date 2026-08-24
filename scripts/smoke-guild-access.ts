import { strict as assert } from "node:assert";
import {
  canManageGuild,
  canManageGuildMember,
  hasDiscordPermission,
  type DiscordGuildSummary,
  type DiscordRole,
} from "../src/lib/discord-api.server";

const owner: DiscordGuildSummary = { id: "owner", name: "Owner guild", icon: null, owner: true };
const ownerString: DiscordGuildSummary = { id: "owner-string", name: "Owner guild", icon: null, owner: "true" };
const ownerId: DiscordGuildSummary = { id: "owner-id", name: "Owner guild", icon: null, owner_id: "123" };
const administrator: DiscordGuildSummary = { id: "admin", name: "Admin guild", icon: null, permissions: "8" };
const manageGuild: DiscordGuildSummary = { id: "manage", name: "Manage guild", icon: null, permissions: 32 };
const member: DiscordGuildSummary = { id: "member", name: "Member guild", icon: null, permissions: "0" };

assert.equal(canManageGuild(owner), true);
assert.equal(canManageGuild(ownerString), true);
assert.equal(canManageGuild(ownerId, "123"), true);
assert.equal(canManageGuild(administrator), true);
assert.equal(canManageGuild(manageGuild), true);
assert.equal(canManageGuild(member), false);
assert.equal(hasDiscordPermission("8", 8n), true);
assert.equal(hasDiscordPermission(32, 32n), true);
assert.equal(hasDiscordPermission("not-a-number", 8n), false);

const adminRole: DiscordRole = {
  id: "role-admin",
  name: "Admin",
  color: 0,
  position: 3,
  managed: false,
  permissions: "8",
};
const manageRole: DiscordRole = {
  id: "role-manage",
  name: "Manager",
  color: 0,
  position: 2,
  managed: false,
  permissions: "32",
};
const regularRole: DiscordRole = {
  id: "role-regular",
  name: "Member",
  color: 0,
  position: 1,
  managed: false,
  permissions: "0",
};
assert.equal(canManageGuildMember({ roles: ["role-admin"] }, [adminRole, manageRole, regularRole]), true);
assert.equal(canManageGuildMember({ roles: ["role-manage"] }, [adminRole, manageRole, regularRole]), true);
assert.equal(canManageGuildMember({ roles: ["role-regular"] }, [adminRole, manageRole, regularRole]), false);

console.log("[Glow Test] owner, Administrator, Manage Guild and role fallback checks passed");
