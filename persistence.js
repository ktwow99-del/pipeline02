"use strict";

const fs = require("fs");
const path = require("path");

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to read persistence file: ${filePath}`, error.message);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadRecords(filePath, fallback = []) {
  const parsed = readJsonFile(filePath, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

function saveRecords(filePath, records) {
  const safeRecords = Array.isArray(records) ? records : [];
  writeJsonFile(filePath, safeRecords);
  return safeRecords;
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  loadRecords,
  saveRecords,
};
