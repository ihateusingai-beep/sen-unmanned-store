#!/usr/bin/env node
/* ============================================================
   資料同步檢查
   ------------------------------------------------------------
   ITEMS / LISTS 喺 prototype/index.html 同 paper/checklist.html
   各存一份（形狀仲唔一樣：paper 版 LISTS 多一個 no 欄）。
   課室用網頁、紙本做後備 —— 唔一致係靜默嘅，唔會報錯，
   所以用呢個 script 變成可執行嘅門檻。

   用法：
     node tools/check-sync.mjs
   放落 CI 或改內容後跑一次。
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  proto: join(ROOT, "prototype/index.html"),
  paper: join(ROOT, "paper/checklist.html"),
};

const read = (p) => readFileSync(p, "utf8");

/* 抽 LISTS 嘅 items / shelf（兩個檔都用同一種寫法） */
function parseLists(src) {
  const block = src.match(/const LISTS = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error("搵唔到 const LISTS");
  const items = [...block[1].matchAll(/items:\s*\[([^\]]+)\]/g)].map((m) =>
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
  );
  const shelf = [...block[1].matchAll(/shelf:\s*\[([^\]]+)\]/g)].map((m) =>
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
  );
  return { items, shelf };
}

/* 抽 ITEMS 嘅 key + name */
function parseItems(src) {
  const block = src.match(/const ITEMS = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error("搵唔到 const ITEMS");
  const out = {};
  for (const m of block[1].matchAll(/(\w+):\s*\{[^}]*name:\s*"([^"]+)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const a = { lists: parseLists(read(FILES.proto)), items: parseItems(read(FILES.proto)) };
const b = { lists: parseLists(read(FILES.paper)), items: parseItems(read(FILES.paper)) };

const problems = [];
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

if (!eq(a.lists.items, b.lists.items))
  problems.push(["LISTS.items", a.lists.items, b.lists.items]);
if (!eq(a.lists.shelf, b.lists.shelf))
  problems.push(["LISTS.shelf", a.lists.shelf, b.lists.shelf]);

for (const [k, name] of Object.entries(a.items)) {
  if (!(k in b.items)) problems.push([`ITEMS.${k}`, `有 (${name})`, "❌ 缺"]);
  else if (b.items[k] !== name) problems.push([`ITEMS.${k}.name`, name, b.items[k]]);
}
for (const [k, name] of Object.entries(b.items)) {
  if (!(k in a.items)) problems.push([`ITEMS.${k}`, "❌ 缺", `有 (${name})`]);
}

/* 額外檢查：每張單 3 正 + 3 干擾 = 6（貨架要 3×2 兩行） */
a.lists.items.forEach((list, i) => {
  const n = list.length + a.lists.shelf[i].length;
  if (n !== 6) problems.push([`第 ${i + 1} 單 件數`, `${list.length}+${a.lists.shelf[i].length}=${n}`, "應為 3+3=6"]);
  const dup = list.filter((x, j) => list.indexOf(x) !== j);
  if (dup.length) problems.push([`第 ${i + 1} 單 重複`, dup.join("、"), "唔應重複"]);
  const overlap = list.filter((x) => a.lists.shelf[i].includes(x));
  if (overlap.length) problems.push([`第 ${i + 1} 單 正貨撞干擾`, overlap.join("、"), "唔應重疊"]);
});

if (problems.length) {
  console.error("❌ 資料唔一致：\n");
  for (const [what, x, y] of problems) {
    console.error(`  ${what}\n    prototype : ${JSON.stringify(x)}\n    paper     : ${JSON.stringify(y)}`);
  }
  console.error(`\n共 ${problems.length} 項。改一邊就要改另一邊（見 docs/02）。`);
  process.exit(1);
}

console.log("✅ prototype / paper 資料一致");
console.log(`   ${a.lists.items.length} 張清單，每張 3 正 + 3 干擾 = 6 件`);
console.log(`   ${Object.keys(a.items).length} 件物品庫`);
