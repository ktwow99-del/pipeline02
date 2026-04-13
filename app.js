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

  const ADMIN_PANEL_PASSWORD = "pipelineadmin";
  const attachmentFiles = document.getElementById("attachmentFiles");
  const attachmentNames = document.getElementById("attachmentNames");
  const btnAttachment = document.getElementById("btn-attachment");

  const ATTACHMENT_NAMES_EMPTY = "선택된 파일이 없습니다";

  /** @type {File[]} */
  let attachmentStore = [];

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
    picked.forEach((f) => {
      const key = attachmentFileKey(f);
      if (!seen.has(key)) {
        attachmentStore.push(f);
        seen.add(key);
      }
    });
    attachmentFiles.value = "";
    syncAttachmentInput();
    renderAttachmentNames();
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
    adminPasswordBlock.hidden = false;
    btnAdminExpand.hidden = true;
    if (adminPasswordInput) adminPasswordInput.value = "";
    setAdminPasswordError("");
    adminPasswordInput?.focus();
  }

  function hideAdminPasswordStep() {
    if (!adminPasswordBlock || !btnAdminExpand) return;
    adminPasswordBlock.hidden = true;
    btnAdminExpand.hidden = false;
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
  }

  function lockAdminPanel() {
    if (!adminGradeContent || !btnAdminExpand || !btnAdminCollapse) return;
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
})();
