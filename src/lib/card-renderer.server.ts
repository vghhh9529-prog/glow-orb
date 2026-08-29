import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { join } from "node:path";

type CanvasRenderingContext2D = SKRSContext2D;

const DISCORD_EPOCH = 1_420_070_400_000;
const CARD_FONT_FAMILY = "Glow Noto Sans";
const REMOTE_IMAGE_TIMEOUT_MS = 5_000;
const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
  "images-ext-1.discordapp.net",
  "images-ext-2.discordapp.net",
]);
let cardFontsReady = false;

function ensureCardFonts() {
  if (cardFontsReady) return;
  const fontFiles = [
    join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"),
    join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf"),
  ];
  for (const fontPath of fontFiles) {
    if (existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, CARD_FONT_FAMILY);
  }
  cardFontsReady = true;
}

export interface GlowCardStats {
  username: string;
  displayName: string;
  userId: string;
  avatarUrl?: string | null;
  serverName?: string | null;
  level: number;
  xp: number;
  rank: number;
  discordCreatedAt: string;
  serverJoinedAt?: string | null;
}

function discordCreatedAt(id: string) {
  try {
    return new Date(Number((BigInt(id) >> 22n) + BigInt(DISCORD_EPOCH))).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const units: Array<[number, string]> = [
    [31_536_000, "year"],
    [2_592_000, "month"],
    [604_800, "week"],
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];
  for (const [size, label] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${label}${count === 1 ? "" : "s"} ago`;
    }
  }
  return "Just now";
}

async function remoteImage(url?: string | null) {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  try {
    const response = await fetch(parsed, { signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS) });
    if (!response.ok) return null;
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REMOTE_IMAGE_BYTES) return null;

    if (!response.body) {
      const bytes = await response.arrayBuffer();
      return bytes.byteLength <= MAX_REMOTE_IMAGE_BYTES
        ? await loadImage(Buffer.from(bytes))
        : null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_REMOTE_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
    return await loadImage(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
  } catch {
    return null;
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = "600") {
  ensureCardFonts();
  const fontWeight = Number(weight) >= 700 ? "bold" : "normal";
  ctx.font = `${fontWeight} ${size}px "${CARD_FONT_FAMILY}"`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function cardShell(ctx: CanvasRenderingContext2D, width: number, height: number, title: string) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#10152d");
  background.addColorStop(0.55, "#111631");
  background.addColorStop(1, "#090b18");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.82, height * 0.04, 0, width * 0.82, height * 0.04, 440);
  glow.addColorStop(0, "rgba(124,92,255,.35)");
  glow.addColorStop(1, "rgba(124,92,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,.055)";
  for (let index = 0; index < 48; index += 1) {
    const x = (index * 149) % width;
    const y = (index * 83) % height;
    ctx.beginPath();
    ctx.arc(x, y, index % 3 === 0 ? 1.8 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  roundedRect(ctx, 24, 24, width - 48, height - 48, 30);
  ctx.strokeStyle = "rgba(173,160,255,.22)";
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, "GLOW", 72, 88, 20, "#b9aaff", "800");
  text(ctx, title, 72, 122, 14, "#8f95ba", "600");
}

function avatar(ctx: CanvasRenderingContext2D, image: Image | null, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (image) ctx.drawImage(image, x, y, size, size);
  else {
    const fallback = ctx.createLinearGradient(x, y, x + size, y + size);
    fallback.addColorStop(0, "#7c5cff");
    fallback.addColorStop(1, "#19c8ff");
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, size, size);
    text(ctx, "G", x + size * 0.35, y + size * 0.68, size * 0.42, "#fff", "800");
  }
  ctx.restore();
  ctx.strokeStyle = "#9e8cff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();
}

function stat(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number) {
  roundedRect(ctx, x, y, width, 82, 18);
  ctx.fillStyle = "rgba(255,255,255,.045)";
  ctx.fill();
  text(ctx, label.toUpperCase(), x + 20, y + 29, 11, "#858daf", "700");
  text(ctx, value, x + 20, y + 59, 22, "#f2f3ff", "800");
}

function glowCoin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, "#b9aaff");
  gradient.addColorStop(0.52, "#7c5cff");
  gradient.addColorStop(1, "#19c8ff");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.72)";
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.stroke();
  text(ctx, "G", x + size * 0.34, y + size * 0.68, size * 0.42, "#fff", "800");
}

export async function renderUserCard(stats: GlowCardStats) {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  cardShell(ctx, width, height, "MEMBER PROFILE");
  const image = await remoteImage(stats.avatarUrl);
  avatar(ctx, image, 72, 170, 148);
  text(ctx, stats.displayName.slice(0, 28), 260, 218, 38, "#f5f4ff", "800");
  text(ctx, `@${stats.username}`.slice(0, 32), 262, 255, 20, "#a9acc8", "600");
  text(ctx, `ID  ${stats.userId}`, 262, 290, 14, "#777d9e", "500");
  text(ctx, stats.serverName ? `Member of ${stats.serverName}`.slice(0, 54) : "Glow community member", 72, 366, 18, "#c7c9df", "600");
  stat(ctx, "Level", String(stats.level), 72, 405, 240);
  stat(ctx, "XP", stats.xp.toLocaleString("en-US"), 330, 405, 240);
  stat(ctx, "Server rank", stats.rank > 0 ? `#${stats.rank}` : "Unranked", 588, 405, 240);
  stat(ctx, "Account age", relativeTime(stats.discordCreatedAt), 846, 405, 282);
  stat(ctx, "Joined this server", relativeTime(stats.serverJoinedAt), 72, 505, 350);
  stat(ctx, "Profile status", "Active", 444, 505, 310);
  stat(ctx, "Glow member", "Verified", 776, 505, 352);
  return canvas.toBuffer("image/png");
}

export async function renderProfileCard(stats: GlowCardStats) {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  cardShell(ctx, width, height, "GLOW PROFILE CARD");
  const image = await remoteImage(stats.avatarUrl);
  avatar(ctx, image, 72, 160, 172);
  text(ctx, stats.displayName.slice(0, 27), 282, 214, 42, "#f5f4ff", "800");
  text(ctx, `@${stats.username}`.slice(0, 30), 284, 252, 20, "#a9acc8", "600");
  roundedRect(ctx, 282, 280, 154, 34, 17);
  ctx.fillStyle = "rgba(124,92,255,.2)";
  ctx.fill();
  text(ctx, "GLOW MEMBER", 304, 303, 12, "#b9aaff", "800");
  text(ctx, "Your community progress at a glance", 72, 370, 18, "#c7c9df", "600");
  stat(ctx, "Level", String(stats.level), 72, 405, 240);
  stat(ctx, "XP progress", stats.xp.toLocaleString("en-US"), 330, 405, 240);
  stat(ctx, "Rank", stats.rank > 0 ? `#${stats.rank}` : "Unranked", 588, 405, 240);
  stat(ctx, "Account age", relativeTime(stats.discordCreatedAt), 846, 405, 282);
  stat(ctx, "Server time", relativeTime(stats.serverJoinedAt), 72, 505, 350);
  stat(ctx, "Community", stats.serverName?.slice(0, 18) || "Glow", 444, 505, 310);
  stat(ctx, "Status", "Online", 776, 505, 352);
  return canvas.toBuffer("image/png");
}

export interface GlowBalanceCardStats {
  username: string;
  displayName: string;
  userId: string;
  avatarUrl?: string | null;
  balance: number;
  streak: number;
  totalEarned: number;
}

export async function renderBalanceCard(stats: GlowBalanceCardStats) {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  cardShell(ctx, width, height, "GLOW COIN BALANCE");
  const image = await remoteImage(stats.avatarUrl);
  avatar(ctx, image, 72, 166, 148);
  text(ctx, stats.displayName.slice(0, 28), 260, 215, 38, "#f5f4ff", "800");
  text(ctx, `@${stats.username}`.slice(0, 32), 262, 252, 20, "#a9acc8", "600");
  text(ctx, `ID  ${stats.userId}`, 262, 286, 14, "#777d9e", "500");

  glowCoin(ctx, 72, 350, 94);
  text(ctx, "GLOW COIN BALANCE", 194, 382, 13, "#858daf", "700");
  text(ctx, stats.balance.toLocaleString("en-US"), 194, 435, 54, "#f5f4ff", "800");
  text(ctx, "Glow Coin", 198, 464, 20, "#a996ff", "700");

  stat(ctx, "Daily streak", String(stats.streak), 72, 510, 300);
  stat(ctx, "Total earned", stats.totalEarned.toLocaleString("en-US"), 396, 510, 340);
  stat(ctx, "Currency", "Glow Coin", 760, 510, 368);
  return canvas.toBuffer("image/png");
}

export interface GlowTransferCodeCardStats {
  senderName: string;
  recipientName: string;
  amount: number;
  code: string;
  expiresInMinutes: number;
}

export function renderTransferCodeCard(stats: GlowTransferCodeCardStats) {
  const width = 800;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#0b1028");
  background.addColorStop(0.5, "#1a1850");
  background.addColorStop(1, "#351f78");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  roundedRect(ctx, 52, 48, width - 104, height - 96, 24);
  ctx.fillStyle = "rgba(16, 18, 55, .72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(190, 175, 255, .55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const codeLine = stats.code.slice(0, 4).split("").join("    ");
  ctx.textAlign = "center";
  text(ctx, codeLine, width / 2, 190, 86, "#ffffff", "800");
  ctx.textAlign = "start";
  return canvas.toBuffer("image/png");
}

export function discordAccountCreatedAt(id: string) {
  return discordCreatedAt(id);
}
