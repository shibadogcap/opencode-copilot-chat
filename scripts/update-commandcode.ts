/**
 * Generate plan-based VS Code model JSON for CommandCode
 * Filtering with GO < GOAT < PRO < MAX containment
 * - go   : minPlanName === "Go"              (34)
 * - goat : Go + GOAT                         (38)
 * - pro  : Go + GOAT + Pro                   (51)
 * - max  : all                               (57)
 * - all  : all + any API-only models if present
 *
 * Data sources:
 *  - https://api.commandcode.ai/provider/v1/models  (public)
 *  - https://commandcode.ai/docs/plans/goat (RSC:1, full catalog with minPlanName)
 *    A single fetch of the goat page covers all plans.
 *
 * Usage:
 *   bun run scripts/update-commandcode.ts
 */
import { mkdir } from "fs/promises";
import { join } from "path";

const API_URL = "https://api.commandcode.ai/provider/v1/models";
const RSC_URL = "https://commandcode.ai/docs/plans/goat";
const PROVIDER_BASE_URL = "https://api.commandcode.ai/provider/v1";

// --- RSC抽出 ---
function extractModelArrayFromRSC(rsc: string): any[] {
  let idx = 0;
  const arrays: any[][] = [];
  while (true) {
    const start = rsc.indexOf(`"models":[`, idx);
    if (start === -1) break;
    const arrStart = start + `"models":`.length;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = arrStart; i < rsc.length; i++) {
      const c = rsc[i]!;
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === "[") depth++;
        else if (c === "]") { depth--; if (depth === 0) { end = i + 1; break; } }
      }
    }
    if (end === -1) break;
    let jsonStr = rsc.slice(arrStart, end).replaceAll('"$undefined"', "null").replaceAll(":$undefined", ":null");
    try {
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr) && arr[0]?.id) arrays.push(arr);
    } catch {}
    idx = end;
  }
  if (arrays.length === 0) return [];
  arrays.sort((a, b) => b.length - a.length);
  return arrays[0]!;
}

function toVSCodeModel(rscModel: any) {
  const id: string = rscModel.id;
  const isClaude = id.startsWith("claude-");
  const contextWindow: number = rscModel.contextWindow ?? rscModel.context_length ?? 200000;
  const caps = rscModel.caps ?? {};
  const inputCost = rscModel.inputCost ?? rscModel.tiers?.[0]?.rates?.input ?? 0;
  const outputCost = rscModel.outputCost ?? rscModel.tiers?.[0]?.rates?.output ?? 0;
  const cacheRead = rscModel.cacheReadCost ?? rscModel.tiers?.[0]?.rates?.cacheRead ?? 0;
  const cacheWrite = rscModel.cacheWriteCost;
  const cacheWriteNum = typeof cacheWrite === "number" ? cacheWrite : null;
  const tooltip = cacheWriteNum !== null
    ? `Price Per 1M token -- Input ${inputCost}$, Output ${outputCost}$, Cache ${cacheRead}$, Cache ${cacheWriteNum}$`
    : `Price Per 1M token -- Input ${inputCost}$, Output ${outputCost}$, Cache ${cacheRead}$`;
  return {
    id,
    name: rscModel.name ?? id,
    url: PROVIDER_BASE_URL,
    apiType: isClaude ? "messages" : "chat-completions",
    toolCalling: true,
    vision: !!caps.vision,
    thinking: !!caps.reasoning || !!rscModel.reasoning,
    maxInputTokens: contextWindow,
    maxOutputTokens: Math.min(contextWindow, 128000),
    tooltip,
  };
}

// --- fetch ---
const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };

console.log("\n=== 1. Fetch API ===");
const apiRes = await fetch(API_URL, { headers });
console.log(`API status ${apiRes.status}`);
if (!apiRes.ok) {
  console.error(`API fetch failed: ${apiRes.status} ${await apiRes.text().then(t=>t.slice(0,500))}`);
}
let apiData: any[] = [];
if (apiRes.ok) {
  const j: any = await apiRes.json();
  apiData = j.data ?? [];
  console.log(`API count ${apiData.length}`);
}

console.log("\n=== 2. Fetch RSC (goat = full catalog) ===");
const rscHeaders: Record<string, string> = { "RSC": "1", "User-Agent": "Mozilla/5.0" };
const rsc = await fetch(RSC_URL, { headers: rscHeaders }).then(r => r.text());
console.log(`RSC length ${rsc.length}`);
const rscModels = extractModelArrayFromRSC(rsc);
console.log(`RSC extracted ${rscModels.length} models`);
if (rscModels.length === 0) {
  console.error("RSC extraction failed");
  process.exit(1);
}
const dist: Record<string, number> = {};
for (const m of rscModels) dist[m.minPlanName] = (dist[m.minPlanName] || 0) + 1;
console.log("minPlanName distribution", dist);

// API と RSC の id 差異を吸収 (haiku の -20251001 サフィックス等)
const rscIds = new Set(rscModels.map((m: any) => m.id));
const apiOnly = apiData.filter((a: any) => !rscIds.has(a.id));
if (apiOnly.length) {
  console.log(`API-only models: ${apiOnly.map((x: any) => x.id).join(", ")} (${apiOnly.length}) -> added to all`);
  // API側のモデルをRSC形式に補完して追加
  for (const a of apiOnly) {
    rscModels.push({
      id: a.id,
      name: a.name ?? a.id,
      contextWindow: a.context_length ?? 200000,
      caps: { text: true, vision: false, reasoning: false },
      inputCost: 0, outputCost: 0, cacheReadCost: 0,
      minPlanName: "Max", // 不明なのでMax扱い (allに含まれる)
      tiers: [{ rates: { input: 0, output: 0, cacheRead: 0 } }],
    });
  }
}

// --- プラン別フィルタ (GO < GOAT < PRO < MAX) ---
type PlanKey = "go" | "goat" | "pro" | "max" | "all";
const planDefs: { key: PlanKey; label: string; filter: (m:any)=>boolean }[] = [
  { key: "go",   label: "CommandCode Go",   filter: (m:any)=> m.minPlanName === "Go" },
  { key: "goat", label: "CommandCode GOAT", filter: (m:any)=> ["Go","GOAT"].includes(m.minPlanName) },
  { key: "pro",  label: "CommandCode Pro",  filter: (m:any)=> ["Go","GOAT","Pro"].includes(m.minPlanName) },
  { key: "max",  label: "CommandCode Max",  filter: (_:any)=> true },
  { key: "all",  label: "CommandCode All",  filter: (_:any)=> true },
];
// 従量課金のみ (いずれのplanにも含まれない) が将来出た場合は minPlanName が undefined/null になる想定
// その場合は max/all にのみ含まれる (上の filter では all/max は true なので自動的に含まれる)
// 明示的に確認
const paygOnly = rscModels.filter((m:any)=> !["Go","GOAT","Pro","Max"].includes(m.minPlanName));
if (paygOnly.length) console.log(`Pay-as-you-go only: ${paygOnly.map((m:any)=>m.id).join(", ")} -> included in max/all`);

console.log("\n=== 3. Write ===");
await mkdir("models", { recursive: true }).catch(()=>{});

for (const plan of planDefs) {
  const filtered = rscModels.filter(plan.filter);
  const vsModels = filtered.map(toVSCodeModel);
  // 既存repoの形式に合わせる: {"models": [...]} の外側 {} を除いたフラグメントを書く
  // ただし valid JSON として読めるようにもしておくため、とりあえず valid JSON で書き、フラグメントも併記コメントを出す
  const obj = { models: vsModels };
  const jsonFull = JSON.stringify(obj, null, 2);
  const jsonFragment = jsonFull.substring(1, jsonFull.length - 1); // "  \"models\": [...]\\n" 既存と同じトリミング
  const pathFull = join("models", `commandcode-${plan.key}.json`);
  // 既存の models/*.json はフラグメント形式なのでそれに合わせる
  await Bun.write(pathFull, jsonFragment);
  console.log(`[${plan.key}] ${plan.label}: ${vsModels.length} models -> ${pathFull} (${jsonFragment.length} bytes, valid would be ${jsonFull.length})`);
}

// model-settings 形式 (VS Code貼り付け用)
const modelSettings = planDefs.map(plan => ({
  name: plan.label,
  vendor: "customendpoint",
  apiKey: "replace_with_your_api_key",
  models: rscModels.filter(plan.filter).map(toVSCodeModel),
}));
const settingsJson = JSON.stringify(modelSettings, null, 2);
await Bun.write("model-settings-commandcode.json", settingsJson.substring(1, settingsJson.length - 1));
console.log(`\nwrote model-settings-commandcode.json (${modelSettings.length} providers)`);
for (const p of modelSettings) console.log(`  ${p.name}: ${p.models.length} models`);

// Validation: containment check
console.log("\n=== Validation GO < GOAT < PRO < MAX ===");
const counts = Object.fromEntries(planDefs.map(p=>[p.key, rscModels.filter(p.filter).length]));
console.log(counts);
const ok = counts.go! <= counts.goat! && counts.goat! <= counts.pro! && counts.pro! <= counts.max! && counts.max === counts.all;
console.log(ok ? "OK: containment holds" : "NG: containment broken");
console.log("\nDONE: bun run scripts/update-commandcode.ts");
