(function () {
  const form = document.getElementById("rating-form");
  const gradeSummary = document.getElementById("grade-summary");
  const btnAdminExpand = document.getElementById("btn-admin-expand");
  const btnAdminCollapse = document.getElementById("btn-admin-collapse");
  const adminPasswordBlock = document.getElementById("adminPasswordBlock");
  const adminGradeContent = document.getElementById("adminGradeContent");
  const adminPasswordInput = document.getElementById("adminPassword");
  const btnAdminUnlock = document.getElementById("btn-admin-unlock");
  const btnAdminCancel = document.getElementById("btn-admin-cancel");
  const adminPasswordError = document.getElementById("adminPasswordError");
  const btnReset = document.getElementById("btn-reset");
  const btnPdf = document.getElementById("btn-pdf");
  const btnLedgerSave = document.getElementById("btn-ledger-save");
  const btnLedgerExport = document.getElementById("btn-ledger-export");
  const btnReceiptStatus = document.getElementById("btn-receipt-status");
  const ledgerStatus = document.getElementById("ledger-status");
  const locationDetailInput = document.getElementById("locationDetail");
  const receiptModal = document.getElementById("receiptModal");
  const receiptModalBackdrop = document.getElementById("receiptModalBackdrop");
  const receiptModalBody = document.getElementById("receiptModalBody");
  const btnReceiptModalClose = document.getElementById("btnReceiptModalClose");

  const LEDGER_STORAGE_KEY = "pipeline_rating_ledger_v1";

  /** @typedef {{ key: string, header: string }} LedgerColumn */
  /** @type {LedgerColumn[]} */
  const LEDGER_COLUMNS = [
    { key: "dateKey", header: "일자" },
    { key: "savedAt", header: "저장시각" },
    { key: "employeeIdName", header: "사번/이름" },
    { key: "projectName", header: "사업명" },
    { key: "floorArea", header: "연면적" },
    { key: "strategyFit", header: "전략방향 정합성" },
    { key: "location", header: "입지" },
    { key: "locationDetail", header: "입지 상세(주소)" },
    { key: "strategyDirection", header: "상품 종류" },
    { key: "siteArea", header: "대지 면적" },
    { key: "client", header: "발주처" },
    { key: "biddingMethod", header: "입찰방식" },
    { key: "consultation", header: "협의처" },
    { key: "architectCm", header: "설계사 / 감리(CM)" },
    { key: "finance", header: "금융구도" },
    { key: "budget", header: "사업예산" },
    { key: "competitor", header: "경쟁사" },
    { key: "orderPossibility", header: "수주 가능성" },
    { key: "notes", header: "특이사항 / 진행현황 / Key Partner" },
    { key: "attachmentNames", header: "첨부파일명" },
    { key: "gradeTotal", header: "배점 합계" },
  ];

  function formatLocalDate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getSelectDisplayLabel(selectEl) {
    if (!selectEl || !selectEl.value) return "";
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return "";
    return (opt.dataset.label || opt.textContent || "").trim();
  }

  function getFieldValue(name) {
    const el = form.elements.namedItem(name);
    if (!el) return "";
    if (el instanceof RadioNodeList) {
      const checked = Array.from(el).find((n) => n.checked);
      return checked ? String(checked.value || "").trim() : "";
    }
    if (el instanceof HTMLSelectElement) return getSelectDisplayLabel(el);
    if (el instanceof HTMLTextAreaElement) return el.value.trim();
    if (el instanceof HTMLInputElement) return el.value.trim();
    return "";
  }

  /** @returns {Record<string, string | number>} */
  function collectFormSnapshot() {
    const floorAreaEl = form.querySelector('[data-grade-key="floorArea"]');
    const locationEl = form.querySelector('[data-grade-key="location"]');
    const strategyFitEl = form.querySelector('[data-grade-key="strategyFit"]');
    const strategyDirectionEl = form.querySelector('[data-grade-key="strategyDirection"]');
    const orderPossibilityEl = form.querySelector('[data-grade-key="orderPossibility"]');

    const attachmentNames =
      attachmentStore.length > 0 ? attachmentStore.map((f) => f.name).join(", ") : "";

    return {
      employeeIdName: getFieldValue("employeeIdName"),
      projectName: getFieldValue("projectName"),
      floorArea: floorAreaEl ? getSelectDisplayLabel(floorAreaEl) : "",
      strategyFit: strategyFitEl ? getSelectDisplayLabel(strategyFitEl) : "",
      location: locationEl ? getSelectDisplayLabel(locationEl) : "",
      locationDetail: getFieldValue("locationDetail"),
      strategyDirection: strategyDirectionEl ? getSelectDisplayLabel(strategyDirectionEl) : "",
      siteArea: getFieldValue("siteArea"),
      client: getFieldValue("client"),
      biddingMethod: getFieldValue("biddingMethod"),
      consultation: getFieldValue("consultation"),
      architectCm: getFieldValue("architectCm"),
      finance: getFieldValue("finance"),
      budget: getFieldValue("budget"),
      competitor: getFieldValue("competitor"),
      orderPossibility: orderPossibilityEl ? getSelectDisplayLabel(orderPossibilityEl) : "",
      notes: getFieldValue("notes"),
      attachmentNames,
      gradeTotal: computeTotalPoints(),
    };
  }

  function newLedgerEntryId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function splitEmployeeIdName(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return { employeeId: "", employeeName: "" };
    const slash = s.indexOf("/");
    if (slash >= 0) {
      return {
        employeeId: s.slice(0, slash).trim(),
        employeeName: s.slice(slash + 1).trim(),
      };
    }
    const numPrefix = s.match(/^(\d+)(?:\s|[,，])/);
    if (numPrefix) {
      const rest = s.slice(numPrefix[0].length).trim();
      return { employeeId: numPrefix[1], employeeName: rest };
    }
    const sep = s.search(/\s|[,，]/);
    if (sep > 0) {
      return {
        employeeId: s.slice(0, sep).trim(),
        employeeName: s.slice(sep + 1).trim(),
      };
    }
    return { employeeId: "", employeeName: s };
  }

  /** @returns {Record<string, string | number>[]} */
  function loadLedger() {
    try {
      const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      let changed = false;
      const withIds = parsed.map((row) => {
        if (row && typeof row === "object" && row.entryId) return row;
        changed = true;
        const base = row && typeof row === "object" ? row : {};
        return { ...base, entryId: newLedgerEntryId() };
      });
      if (changed) {
        localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(withIds));
      }
      return withIds;
    } catch {
      return [];
    }
  }

  function saveLedger(rows) {
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(rows));
  }

  function renderLedgerStatus() {
    if (!ledgerStatus) return;
    const n = loadLedger().length;
    ledgerStatus.textContent = n ? `누적 저장 ${n}건` : "누적 내역 없음";
  }

  function appendLedgerEntry(entry) {
    const list = loadLedger();
    list.push(entry);
    list.sort((a, b) => {
      const byDate = String(a.dateKey).localeCompare(String(b.dateKey));
      if (byDate !== 0) return byDate;
      return String(a.savedAt).localeCompare(String(b.savedAt));
    });
    saveLedger(list);
  }

  function downloadLedgerXlsx() {
    if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.writeFile) {
      window.alert("엑셀 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const ledger = loadLedger();
    if (ledger.length === 0) {
      window.alert("저장된 누적 내역이 없습니다. 먼저 하단의「저장」을 눌러 주세요.");
      return;
    }
    const headerRow = LEDGER_COLUMNS.map((c) => c.header);
    const dataRows = ledger.map((snap) => LEDGER_COLUMNS.map((c) => snap[c.key] ?? ""));
    const aoa = [headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "누적");
    const stamp = formatLocalDate().replace(/-/g, "");
    XLSX.writeFile(wb, `pipeline_rating_누적_${stamp}.xlsx`);
  }

  function onLedgerSaveClick() {
    const now = new Date();
    const dateKey = formatLocalDate(now);
    const snap = collectFormSnapshot();
    const entry = {
      ...snap,
      dateKey,
      savedAt: now.toISOString(),
      entryId: newLedgerEntryId(),
    };
    try {
      appendLedgerEntry(entry);
      renderLedgerStatus();
      if (receiptModal && !receiptModal.hidden) {
        renderReceiptModalBody();
      }
      window.alert(`${dateKey} 입력을 누적 목록에 한 건 추가했습니다. 같은 날 여러 번 저장하면 각각 별도 행으로 쌓입니다.`);
    } catch (e) {
      window.alert("브라우저 저장 공간에 쓸 수 없습니다. 다른 탭을 닫거나 저장 용량을 비운 뒤 다시 시도해 주세요.");
      console.error(e);
    }
  }

  function removeLedgerEntryById(entryId) {
    const next = loadLedger().filter((r) => r.entryId !== entryId);
    saveLedger(next);
  }

  function renderReceiptModalBody() {
    if (!receiptModalBody) return;
    receiptModalBody.replaceChildren();
    const rows = loadLedger();
    if (rows.length === 0) {
      const p = document.createElement("p");
      p.className = "receipt-empty";
      p.textContent = "접수된 내역이 없습니다.";
      receiptModalBody.append(p);
      return;
    }
    const table = document.createElement("table");
    table.className = "receipt-table";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    ["일자", "사번", "이름", "사업명", ""].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      hr.append(th);
    });
    thead.append(hr);
    const tb = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const { employeeId, employeeName } = splitEmployeeIdName(row.employeeIdName);
      [row.dateKey, employeeId, employeeName, row.projectName].forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell == null ? "" : String(cell);
        tr.append(td);
      });
      const tdDel = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ghost btn-admin-sm receipt-del";
      btn.textContent = "삭제";
      btn.dataset.entryId = String(row.entryId || "");
      tdDel.append(btn);
      tr.append(tdDel);
      tb.append(tr);
    });
    table.append(thead, tb);
    receiptModalBody.append(table);
  }

  function openReceiptModal() {
    if (!receiptModal) return;
    receiptModal.hidden = false;
    document.body.style.overflow = "hidden";
    renderReceiptModalBody();
    btnReceiptModalClose?.focus();
  }

  function closeReceiptModal() {
    if (!receiptModal) return;
    receiptModal.hidden = true;
    document.body.style.overflow = "";
  }

  const ADMIN_PANEL_PASSWORD = "pipelineadmin";
  const attachmentFiles = document.getElementById("attachmentFiles");
  const attachmentNames = document.getElementById("attachmentNames");
  const btnAttachment = document.getElementById("btn-attachment");

  const ATTACHMENT_NAMES_EMPTY = "선택된 파일이 없습니다";

  /** @type {File[]} */
  let attachmentStore = [];

  let attachmentUploadServerWarned = false;

  function attachmentFileKey(file) {
    return `${file.name}\0${file.size}\0${file.lastModified}`;
  }

  function syncAttachmentInput() {
    if (!attachmentFiles) return;
    const dt = new DataTransfer();
    attachmentStore.forEach((f) => dt.items.add(f));
    attachmentFiles.files = dt.files;
  }

  function renderAttachmentNames() {
    if (!attachmentFiles || !attachmentNames) return;
    attachmentNames.replaceChildren();
    if (attachmentStore.length === 0) {
      attachmentNames.textContent = ATTACHMENT_NAMES_EMPTY;
      attachmentNames.classList.remove("has-files");
      return;
    }
    attachmentNames.classList.add("has-files");
    const ul = document.createElement("ul");
    ul.className = "attachment-list";
    attachmentStore.forEach((file, index) => {
      const li = document.createElement("li");
      li.className = "attachment-item";
      const nameEl = document.createElement("span");
      nameEl.className = "attachment-item-name";
      nameEl.textContent = file.name;
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "attachment-remove no-print";
      delBtn.textContent = "삭제";
      delBtn.setAttribute("aria-label", `${file.name} 삭제`);
      delBtn.addEventListener("click", () => {
        attachmentStore.splice(index, 1);
        syncAttachmentInput();
        renderAttachmentNames();
      });
      li.append(nameEl, delBtn);
      ul.append(li);
    });
    attachmentNames.append(ul);
  }

  function onAttachmentFilesChange() {
    if (!attachmentFiles) return;
    const picked = Array.from(attachmentFiles.files);
    const seen = new Set(attachmentStore.map(attachmentFileKey));
    /** @type {File[]} */
    const added = [];
    picked.forEach((f) => {
      const key = attachmentFileKey(f);
      if (!seen.has(key)) {
        attachmentStore.push(f);
        seen.add(key);
        added.push(f);
      }
    });
    attachmentFiles.value = "";
    syncAttachmentInput();
    renderAttachmentNames();
    added.forEach((f) => {
      uploadAttachmentFileToServer(f).catch((err) => {
        console.error(err);
        if (!attachmentUploadServerWarned) {
          attachmentUploadServerWarned = true;
          window.alert(
            "첨부를 PC의 data 폴더에 저장하려면 프로젝트 폴더에서 터미널로 npm install 후 npm start 를 실행하고, 브라우저에서는 http://localhost:3980 같은 서버 주소로 이 페이지를 열어 주세요."
          );
        }
      });
    });
  }

  const gradeFields = [
    { key: "floorArea", title: "연면적" },
    { key: "location", title: "입지" },
    { key: "strategyDirection", title: "상품 종류" },
    { key: "strategyFit", title: "전략방향 정합성" },
    { key: "orderPossibility", title: "수주 가능성" },
  ];

  const SCORE_MAX = 50;

  function gradeToPoints(grade) {
    if (grade === "A") return 10;
    if (grade === "B") return 5;
    if (grade === "C") return 0;
    return 0;
  }

  function selectedOptionMeta(selectEl) {
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt || !selectEl.value) {
      return { grade: null, label: null };
    }
    return {
      grade: selectEl.value,
      label: opt.dataset.label || opt.textContent.trim(),
    };
  }

  function computeTotalPoints() {
    return gradeFields.reduce((sum, { key }) => {
      const sel = form.querySelector(`[data-grade-key="${key}"]`);
      const { grade } = selectedOptionMeta(sel);
      return sum + gradeToPoints(grade);
    }, 0);
  }

  function uploadAttachmentFileToServer(file) {
    renderGrades();
    const fd = new FormData();
    fd.append("date", formatLocalDate());
    fd.append("score", String(computeTotalPoints()));
    fd.append("projectName", getFieldValue("projectName"));
    fd.append("file", file, file.name);
    return fetch("/api/upload-attachment", {
      method: "POST",
      body: fd,
    }).then((res) => {
      if (!res.ok) {
        return res.text().then((t) => {
          throw new Error(t || res.statusText);
        });
      }
      return res.json();
    });
  }

  function renderGrades() {
    if (!gradeSummary) return;
    const metas = gradeFields.map(({ key }) => {
      const sel = form.querySelector(`[data-grade-key="${key}"]`);
      return selectedOptionMeta(sel);
    });
    const choiceLabels = metas.map(({ label }) => label || "미선택");

    const totalPoints = computeTotalPoints();
    const scoreLine = `${choiceLabels.join("/")} = <strong>${totalPoints}</strong>/${SCORE_MAX}`;

    gradeSummary.innerHTML = `<div class="score-line"><span class="score-line-main">${scoreLine}</span></div>`;
  }

  form.addEventListener("submit", (e) => e.preventDefault());

  form.addEventListener("change", renderGrades);
  form.addEventListener("input", () => {
    /* no-op: grades from selects only */
  });

  if (btnAttachment && attachmentFiles) {
    btnAttachment.addEventListener("click", () => attachmentFiles.click());
  }
  if (attachmentFiles) {
    attachmentFiles.addEventListener("change", onAttachmentFilesChange);
  }

  function openPostcodeSearch() {
    if (typeof daum === "undefined" || !daum.Postcode) {
      window.alert("주소 검색 모듈을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.");
      return;
    }
    if (!locationDetailInput) return;
    new daum.Postcode({
      oncomplete(data) {
        const zip = data.zonecode ? `[${data.zonecode}] ` : "";
        const road = data.roadAddress || data.autoRoadAddress || "";
        const jibun = data.jibunAddress || data.autoJibunAddress || "";
        const main = data.userSelectedType === "R" ? road || jibun : jibun || road;
        let line = (main || "").trim();
        if (data.buildingName && line && !line.includes(data.buildingName)) {
          line += ` ${data.buildingName}`;
        }
        locationDetailInput.value = `${zip}${line}`.trim();
      },
    }).open();
  }

  locationDetailInput?.addEventListener("click", () => {
    openPostcodeSearch();
  });

  btnReset.addEventListener("click", () => {
    attachmentStore = [];
    form.reset();
    renderGrades();
    syncAttachmentInput();
    renderAttachmentNames();
  });

  btnPdf.addEventListener("click", () => {
    renderGrades();
    window.print();
  });

  btnLedgerSave?.addEventListener("click", () => {
    renderGrades();
    onLedgerSaveClick();
  });
  btnLedgerExport?.addEventListener("click", () => {
    renderGrades();
    downloadLedgerXlsx();
  });

  btnReceiptStatus?.addEventListener("click", () => {
    renderGrades();
    openReceiptModal();
  });

  btnReceiptModalClose?.addEventListener("click", () => {
    closeReceiptModal();
  });

  receiptModalBackdrop?.addEventListener("click", () => {
    closeReceiptModal();
  });

  receiptModalBody?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const delBtn = t.closest("button.receipt-del");
    if (!delBtn || !("entryId" in delBtn.dataset) || !delBtn.dataset.entryId) return;
    if (!window.confirm("이 접수 건을 목록에서 삭제할까요?")) return;
    removeLedgerEntryById(delBtn.dataset.entryId);
    renderReceiptModalBody();
    renderLedgerStatus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && receiptModal && !receiptModal.hidden) {
      closeReceiptModal();
    }
  });

  function setAdminPasswordError(msg) {
    if (!adminPasswordError) return;
    if (msg) {
      adminPasswordError.textContent = msg;
      adminPasswordError.hidden = false;
    } else {
      adminPasswordError.textContent = "";
      adminPasswordError.hidden = true;
    }
  }

  function showAdminPasswordStep() {
    if (!adminPasswordBlock || !btnAdminExpand) return;
    closeReceiptModal();
    adminPasswordBlock.hidden = false;
    btnAdminExpand.hidden = true;
    if (adminGradeContent) adminGradeContent.hidden = true;
    if (adminPasswordInput) adminPasswordInput.value = "";
    setAdminPasswordError("");
    adminPasswordInput?.focus();
  }

  function hideAdminPasswordStep() {
    if (!adminPasswordBlock || !btnAdminExpand) return;
    closeReceiptModal();
    adminPasswordBlock.hidden = true;
    btnAdminExpand.hidden = false;
    if (adminGradeContent) adminGradeContent.hidden = true;
    if (adminPasswordInput) adminPasswordInput.value = "";
    setAdminPasswordError("");
  }

  function unlockAdminPanel() {
    if (!adminPasswordBlock || !adminGradeContent || !btnAdminExpand || !btnAdminCollapse) return;
    adminPasswordBlock.hidden = true;
    adminGradeContent.hidden = false;
    btnAdminExpand.hidden = true;
    btnAdminCollapse.hidden = false;
    if (adminPasswordInput) adminPasswordInput.value = "";
    setAdminPasswordError("");
    renderGrades();
  }

  function lockAdminPanel() {
    if (!adminGradeContent || !btnAdminExpand || !btnAdminCollapse) return;
    closeReceiptModal();
    adminGradeContent.hidden = true;
    btnAdminCollapse.hidden = true;
    btnAdminExpand.hidden = false;
  }

  btnAdminExpand?.addEventListener("click", showAdminPasswordStep);
  btnAdminCancel?.addEventListener("click", hideAdminPasswordStep);
  btnAdminCollapse?.addEventListener("click", lockAdminPanel);
  btnAdminUnlock?.addEventListener("click", () => {
    const v = (adminPasswordInput?.value || "").trim();
    if (v !== ADMIN_PANEL_PASSWORD) {
      setAdminPasswordError("비밀번호가 올바르지 않습니다.");
      return;
    }
    unlockAdminPanel();
  });
  adminPasswordInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnAdminUnlock?.click();
    }
  });

  renderGrades();
  renderAttachmentNames();
  renderLedgerStatus();
})();
