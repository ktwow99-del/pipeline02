(function () {
  const form = document.getElementById("rating-form");
  const gradeSummary = document.getElementById("grade-summary");
  const btnReset = document.getElementById("btn-reset");
  const btnPdf = document.getElementById("btn-pdf");

  const gradeFields = [
    { key: "floorArea", title: "연면적" },
    { key: "location", title: "입지" },
    { key: "strategyDirection", title: "상품 종류" },
    { key: "strategyFit", title: "전략방향 정합성" },
  ];

  const SCORE_MAX = 40;
  const PASS_THRESHOLD = 25;

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

  function allGradeFieldsSelected() {
    return gradeFields.every(({ key }) => {
      const sel = form.querySelector(`[data-grade-key="${key}"]`);
      return selectedOptionMeta(sel).grade !== null;
    });
  }

  function renderGrades() {
    const metas = gradeFields.map(({ key }) => {
      const sel = form.querySelector(`[data-grade-key="${key}"]`);
      return selectedOptionMeta(sel);
    });
    const choiceLabels = metas.map(({ label }) => label || "미선택");
    const allSelected = metas.every(({ grade }) => grade !== null);

    const totalPoints = computeTotalPoints();
    const [a, b, c, d] = choiceLabels;
    const scoreLine = `${a}/${b}/${c}/${d} = <strong>${totalPoints}</strong>/${SCORE_MAX}`;

    let verdictHtml = "";
    if (allSelected) {
      const pass = totalPoints >= PASS_THRESHOLD;
      const verdictClass = pass ? "verdict verdict-pass" : "verdict verdict-fail";
      const verdictText = pass ? "적합" : "부적합";
      verdictHtml = `<span class="${verdictClass}">${verdictText}</span>`;
    }

    gradeSummary.innerHTML = `<div class="score-line"><span class="score-line-main">${scoreLine}</span>${verdictHtml}</div>`;
  }

  form.addEventListener("submit", (e) => e.preventDefault());

  form.addEventListener("change", renderGrades);
  form.addEventListener("input", () => {
    /* no-op: grades from selects only */
  });

  btnReset.addEventListener("click", () => {
    form.reset();
    renderGrades();
  });

  btnPdf.addEventListener("click", () => {
    renderGrades();
    window.print();
  });

  renderGrades();
})();
