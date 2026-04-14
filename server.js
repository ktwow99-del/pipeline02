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

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, DATA_DIR);
  },
  filename(req, file, cb) {
    const dateRaw = String(req.body.date || "");
    const dateCompact = dateRaw.replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const scoreNum = parseInt(String(req.body.score), 10);
    const score = Number.isFinite(scoreNum) ? scoreNum : 0;
    const proj6 = sanitizeSegment(req.body.projectName, 6);
    const ext = path.extname(file.originalname) || "";
    const baseOrig = path.basename(file.originalname, ext);
    const origSafe = sanitizeSegment(baseOrig, 120);
    let name = `${dateCompact}_${score}점_${proj6}_${origSafe}${ext}`;
    let full = path.join(DATA_DIR, name);
    let n = 0;
    while (fs.existsSync(full)) {
      n += 1;
      name = `${dateCompact}_${score}점_${proj6}_${origSafe}_${n}${ext}`;
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
