"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadRecords, saveRecords } = require("../persistence");

test("saveRecords and loadRecords round-trip JSON data", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-rating-"));
  const filePath = path.join(tempDir, "records.json");

  const saved = saveRecords(filePath, [{ id: 1, name: "test" }]);
  assert.deepEqual(saved, [{ id: 1, name: "test" }]);

  const loaded = loadRecords(filePath);
  assert.deepEqual(loaded, [{ id: 1, name: "test" }]);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
