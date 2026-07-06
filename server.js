"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { loadRecords, saveRecords } = require("./persistence");

const APP_ROOT = __dirname;
const DATA_DIR = path.join(APP_ROOT, "data");
const LEDGER_FILE = path.join(DATA_DIR, "ledger.json");
const REVIEW_FILE = path.join(DATA_DIR, "reviews.json");
const PORT = Number(process.env.PORT) || 3980;

fs.mkdirSync(DATA_DIR, { recursive: true });

function sanitizeSegment(str, maxChars) {
  const t = String(str ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const cut = [...t].slice(0, maxChars).join("");
  return cut || "미입력";
}

function sanitizeCompactSegment(str, maxChars) {
  const t = String(str ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[\s,，]+/g, "")
    .trim();
  const cut = [...t].slice(0, maxChars).join("");
  return cut || "미입력";
}

function decodeUtf8Filename(originalName) {
  const raw = String(originalName ?? "");
  const decoded = Buffer.from(raw, "latin1").toString("utf8");
  const rawHasHangul = /[\uac00-\ud7a3]/.test(raw);
  const decodedHasHangul = /[\uac00-\ud7a3]/.test(decoded);
  const rawLooksMojibake = /[\u0080-\u009f]|[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(raw);
  if (!decoded.includes("\uFFFD") && ((decodedHasHangul && !rawHasHangul) || rawLooksMojibake)) {
    return decoded.normalize("NFC");
  }
  return raw.normalize("NFC");
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, DATA_DIR);
  },
  filename(req, file, cb) {
    const dateRaw = String(req.body.date || "");
    const dateCompact = dateRaw.replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const employeeIdName = sanitizeCompactSegment(req.body.employeeIdName, 40);
    const originalName = decodeUtf8Filename(file.originalname);
    const ext = path.extname(originalName) || "";
    const baseOrig = path.basename(originalName, ext);
    const origSafe = sanitizeSegment(baseOrig, 120);
    let name = `${dateCompact}_${employeeIdName}_${origSafe}${ext}`;
    let full = path.join(DATA_DIR, name);
    let n = 0;
    while (fs.existsSync(full)) {
      n += 1;
      name = `${dateCompact}_${employeeIdName}_${origSafe}_${n}${ext}`;
      full = path.join(DATA_DIR, name);
    }
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json());
app.use(express.static(APP_ROOT));

app.get("/api/ledger", (req, res) => {
  res.json(loadRecords(LEDGER_FILE, []));
});

app.post("/api/ledger", (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [];
  saveRecords(LEDGER_FILE, payload);
  res.json(payload);
});

app.delete("/api/ledger/:entryId", (req, res) => {
  const rows = loadRecords(LEDGER_FILE, []);
  const next = rows.filter((row) => String(row.entryId || "") !== String(req.params.entryId || ""));
  saveRecords(LEDGER_FILE, next);
  res.json(next);
});

app.get("/api/reviews", (req, res) => {
  res.json(loadRecords(REVIEW_FILE, []));
});

app.post("/api/reviews", (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [];
  saveRecords(REVIEW_FILE, payload);
  res.json(payload);
});

app.delete("/api/reviews/:sourceEntryId", (req, res) => {
  const rows = loadRecords(REVIEW_FILE, []);
  const next = rows.filter((row) => String(row.sourceEntryId || "") !== String(req.params.sourceEntryId || ""));
  saveRecords(REVIEW_FILE, next);
  res.json(next);
});

app.post("/api/upload-attachment", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).type("text/plain; charset=utf-8").send("파일이 없습니다.");
    return;
  }
  res.json({ ok: true, savedAs: req.file.filename });
});

app.listen(PORT, () => {
  console.log(`pipeline_rating_2 서버: http://localhost:${PORT}`);
  console.log(`첨부 저장 경로: ${DATA_DIR}`);
  console.log(`누적 데이터 저장 경로: ${LEDGER_FILE}`);
  console.log(`검토 데이터 저장 경로: ${REVIEW_FILE}`);
});
