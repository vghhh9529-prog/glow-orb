#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = join(root, "artifacts", "autopilot");
const intervalMs = 20 * 60 * 1000;
const once = process.argv.includes("--once");

const sources = [
  { name: "ProBot Commands", url: "https://probot.io/commands" },
  { name: "ProBot Docs", url: "https://docs.probot.io/" },
  { name: "Dyno Modules", url: "https://docs.dyno.gg/en/modules" },
  { name: "Dyno Commands", url: "https://dyno.gg/commands" },
];

function run(command, args) {
  try {
    return { ok: true, output: execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (error) {
    return {
      ok: false,
      output: [error?.stdout, error?.stderr, error?.message].filter(Boolean).join("\n").trim(),
    };
  }
}

function safeExcerpt(value, max = 800) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function research() {
  const results = [];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, { headers: { "user-agent": "Glow-Autopilot/1.0" } });
      const html = await response.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
      results.push({ name: source.name, url: source.url, status: response.status, excerpt: safeExcerpt(text) });
    } catch (error) {
      results.push({ name: source.name, url: source.url, status: "error", excerpt: safeExcerpt(error?.message) });
    }
  }
  return results;
}

async function loadBacklog() {
  try {
    return JSON.parse(await readFile(join(root, "autopilot", "backlog.json"), "utf8"));
  } catch {
    return { items: [] };
  }
}

async function optionalIdeas(backlog, researchResults) {
  if (process.env.AUTOPILOT_ENABLE_LLM !== "true" || !process.env.OPENAI_API_KEY) {
    return { enabled: false, ideas: [], note: "LLM suggestions are disabled; deterministic audit only." };
  }

  const prompt = [
    "You are reviewing a Discord bot dashboard backlog. Return JSON only.",
    "Suggest up to five small, independently testable feature slices for Glow.",
    "Do not copy names, code, text, or UI from other products. Do not propose secret changes, destructive migrations, or direct production deploys.",
    "Each item must contain title, rationale, files, acceptanceTests, and risk.",
    JSON.stringify({ backlog, research: researchResults.map((item) => ({ name: item.name, url: item.url, excerpt: item.excerpt })) }),
  ].join("\n\n");

  try {
    const base = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
    const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.AUTOPILOT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return { enabled: true, ideas: [], note: `LLM request returned HTTP ${response.status}.` };
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return { enabled: true, ideas: Array.isArray(parsed?.items) ? parsed.items.slice(0, 5) : [], note: "Suggestions only; no source files were modified." };
  } catch (error) {
    return { enabled: true, ideas: [], note: `LLM suggestions unavailable: ${safeExcerpt(error?.message)}` };
  }
}

async function runCycle() {
  await mkdir(artifactDir, { recursive: true });
  const timestamp = new Date().toISOString();
  const git = run("git", ["status", "--short"]);
  const head = run("git", ["log", "-1", "--format=%h %s"]);
  const build = run("pnpm", ["build"]);
  const researchResults = await research();
  const backlog = await loadBacklog();
  const ideas = await optionalIdeas(backlog, researchResults);
  const report = {
    timestamp,
    policy: {
      sourceMutation: false,
      automaticCommit: false,
      automaticProductionDeploy: false,
      secretMutation: false,
    },
    repository: { head: safeExcerpt(head.output, 180), dirty: Boolean(git.output), status: safeExcerpt(git.output, 1200) },
    checks: { build: { ok: build.ok, output: safeExcerpt(build.output, 1600) } },
    research: researchResults,
    backlog: backlog.items ?? [],
    ideas,
  };
  const stamp = timestamp.replace(/[:.]/g, "-");
  await writeFile(join(artifactDir, `${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(artifactDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[Glow Autopilot] Cycle ${timestamp} complete: build=${build.ok ? "pass" : "fail"}, research=${researchResults.length}, ideas=${ideas.ideas.length}`);
  return report;
}

async function main() {
  do {
    await runCycle();
    if (!once) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (!once);
}

main().catch((error) => {
  console.error("[Glow Autopilot] Fatal error", error);
  process.exitCode = 1;
});
