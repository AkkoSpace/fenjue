import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPrompt,
  normalizeRecord,
} from "./nano-banana-record.mjs";

function row(overrides = {}) {
  return {
    id: "30439",
    title: "Kazakh Woman in Retro Diner",
    description: "A cinematic realistic fashion portrait in a vintage diner.",
    content: "Photorealistic portrait of a fashion model.",
    sourceLink: "https://x.com/Maddox_Digital/status/2083365985931985022",
    sourcePublishedAt: "2026-08-01T01:35:32.000Z",
    author: JSON.stringify({
      link: "https://x.com/Maddox_Digital",
      name: "Maddox",
    }),
    sourceMedia: JSON.stringify([
      "https://pbs.twimg.com/media/HOmaSQBboAAk8_z.jpg",
    ]),
    ...overrides,
  };
}

test("人像提示词映射到受控分类且标签不超过六个", () => {
  const result = classifyPrompt(
    "Cinematic fashion portrait",
    "A realistic woman in a retro diner",
    "Photorealistic editorial model with vintage lighting",
  );
  assert.equal(result.categoryKey, "portrait");
  assert.ok(result.tagKeys.includes("portrait"));
  assert.ok(result.tagKeys.includes("fashion"));
  assert.ok(result.tagKeys.length <= 6);
});

test("没有关键词时使用摄影与写实兜底", () => {
  const result = classifyPrompt("Untitled", "", "abstract visual");
  assert.equal(result.categoryKey, "photography");
  assert.deepEqual(result.tagKeys, ["realistic"]);
});

test("规范记录保留作者来源并接受白名单图片", () => {
  const record = normalizeRecord(row());
  assert.equal(record.externalId, "30439");
  assert.equal(record.authorName, "Maddox");
  assert.equal(record.mediaUrls.length, 1);
  assert.deepEqual(record.notes, []);
});

test("非白名单图片不会进入下载队列", () => {
  const record = normalizeRecord(
    row({ sourceMedia: JSON.stringify(["http://127.0.0.1/private.png"]) }),
  );
  assert.deepEqual(record.mediaUrls, []);
  assert.ok(record.notes.some((note) => note.includes("不受信任")));
  assert.ok(record.notes.some((note) => note.includes("没有可用图片")));
});

test("缺失作者名称时从来源账号生成可管理的回退值", () => {
  const record = normalizeRecord(row({ author: JSON.stringify({}) }));
  assert.equal(record.authorName, "@Maddox_Digital");
  assert.equal(record.authorUrl, "https://x.com/Maddox_Digital");
  assert.ok(record.notes.some((note) => note.includes("作者名称")));
});
