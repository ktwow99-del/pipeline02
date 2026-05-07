"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");

const APP_ROOT = __dirname;
const DATA_DIR = path.join(APP_ROOT, "data");
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.static(APP_ROOT));

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
});
