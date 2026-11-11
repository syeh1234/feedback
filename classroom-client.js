(() => {
  const classroomInput = document.getElementById("classroomId");
  const sessionInput = document.getElementById("sessionId");
  const classroomStatus = document.getElementById("classroomStatus");
  const sessionIdError = document.getElementById("sessionIdError");
  const joinButton = document.getElementById("joinClassroom");
  const submitButton = document.getElementById("submit");
  const closeButton = document.getElementById("closeClassroom");
  const spreadsheetStatus = document.getElementById("spreadsheetStatus");
  const submissionCount = document.getElementById("submissionCount");
  const submissionsEmpty = document.getElementById("submissionsEmpty");
  const submissionsBody = document.getElementById("submissionsBody");
  const assignedReview = document.getElementById("assignedReview");
  const assignedReviewerId = document.getElementById("assignedReviewerId");
  const assignedReviewDetails = document.getElementById("assignedReviewDetails");

  if (!classroomInput || !sessionInput || !joinButton || !submitButton) return;

  let joined = false;
  let classroomState = null;
  let pollTimer = null;
  let busy = false;

  const storageKeys = {
    classroomId: "ap-statistics-current-classroom",
    sessionId: "ap-statistics-current-session",
    accessToken: "ap-statistics-current-access-token"
  };

  classroomInput.value = sessionStorage.getItem(storageKeys.classroomId) || "";
  sessionInput.value = sessionStorage.getItem(storageKeys.sessionId) || "";
  sessionInput.readOnly = true;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {})
      }
    });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(result.error || `Request failed (${response.status}).`);
    }

    return result;
  }

  function currentIdentity() {
    const classroomId = classroomInput.value.trim().toUpperCase();
    const sessionId = sessionInput.value.trim();

    if (!/^[A-Z0-9_-]{3,32}$/.test(classroomId)) {
      throw new Error("Classroom ID must be 3 to 32 letters, numbers, hyphens, or underscores.");
    }
    if (!/^\d{1,20}$/.test(sessionId) || /^0+$/.test(sessionId)) {
      throw new Error("Enter a positive whole-number session ID.");
    }

    return { classroomId, sessionId };
  }

  function setBusy(value) {
    busy = value;
    joinButton.disabled = value;
    submitButton.disabled = value || !joined || Boolean(classroomState?.submitted) || classroomState?.status === "closed";
    submitButton.textContent = classroomState?.submitted ? "Sent!" : "Send to Reviewer";
    closeButton.disabled = value || !joined || classroomState?.status === "closed" || (classroomState?.submissionCount || 0) < 2 || (classroomState?.submissionCount || 0) < (classroomState?.participantCount || 0);
  }

  function renderAssignedSubmission(submission) {
    if (!assignedReview || !submission) return;

    assignedReviewDetails.replaceChildren();
    const fields = [
      ["Claim", submission.claim],
      ["Graph type", submission.chartType],
      ["Graph title", submission.graphTitle],
      ["Categories", submission.categories],
      ["Series", submission.series],
      ["X-axis label", submission.xAxisLabel],
      ["Y-axis label", submission.yAxisLabel],
      ["Additional questions", submission.additionalQuestions]
    ];

    let graphData = submission.graphData;
    if (typeof graphData === "string") {
      try {
        graphData = JSON.parse(graphData);
      } catch {
        graphData = null;
      }
    }
    if (graphData) fields.push(["Graph data", JSON.stringify(graphData, null, 2)]);

    fields.forEach(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value || "(not provided)";
      assignedReviewDetails.append(term, description);
    });

    assignedReviewerId.textContent = `Assigned session ID: ${submission.sessionId}`;
    assignedReview.hidden = false;
  }

  function renderState(state) {
    classroomState = state;
    joined = true;
    sessionInput.value = state.sessionId;
    sessionStorage.setItem(storageKeys.sessionId, state.sessionId);
    sessionStorage.setItem(storageKeys.classroomId, state.classroomId);
    classroomInput.readOnly = true;
    sessionInput.readOnly = true;
    classroomInput.closest(".student-bar")?.classList.add("classroom-joined");

    if (state.status === "closed" && window.location.pathname !== "/peer-review.html") {
      window.location.assign("/peer-review.html");
      return;
    }

    if (submissionCount) {
      submissionCount.textContent = `${state.submissionCount} submitted of ${state.participantCount} joined in classroom ${state.classroomId}`;
    }
    if (submissionsEmpty) {
      submissionsEmpty.hidden = true;
      submissionsEmpty.textContent = state.status === "closed"
        ? "Your assigned peer submission appears below."
        : "Peer submissions are hidden until the classroom closes.";
    }
    if (submissionsBody) submissionsBody.replaceChildren();

    if (state.status === "closed") {
      classroomStatus.textContent = `Classroom ${state.classroomId} is closed. Peer assignments are ready.`;
      if (spreadsheetStatus) spreadsheetStatus.textContent = "Peer review is underway. Class responses will be available after everyone finishes.";
      if (state.assignedSubmission) renderAssignedSubmission(state.assignedSubmission);
      else if (assignedReview) assignedReview.hidden = true;
    } else {
      classroomStatus.textContent = `Joined classroom ${state.classroomId}. ${state.submissionCount} of ${state.participantCount} students have submitted.`;
      if (spreadsheetStatus) {
        spreadsheetStatus.textContent = state.submitted
          ? "Your submission is saved. Waiting for the classroom to close."
          : "Submit your graph when you are ready. Peer work stays hidden until everyone has submitted.";
      }
      if (assignedReview) assignedReview.hidden = true;
    }

    if (sessionIdError) sessionIdError.textContent = "";
    setBusy(false);
  }

  async function refreshStatus() {
    if (!joined || busy) return;
    const { classroomId, sessionId } = currentIdentity();
    const accessToken = sessionStorage.getItem(storageKeys.accessToken) || "";
    const state = await api(`/api/classrooms/${encodeURIComponent(classroomId)}/status?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { "x-classroom-token": accessToken }
    });
    renderState(state);
  }

  async function joinClassroom() {
    if (busy) return;

    try {
      const classroomId = classroomInput.value.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(classroomId)) {
        throw new Error("Classroom ID must be 3 to 32 letters, numbers, hyphens, or underscores.");
      }

      const previousClassroomId = sessionStorage.getItem(storageKeys.classroomId) || "";
      const accessToken = previousClassroomId === classroomId
        ? sessionStorage.getItem(storageKeys.accessToken) || ""
        : "";

      setBusy(true);
      classroomStatus.textContent = "Joining classroom…";
      const state = await api(`/api/classrooms/${encodeURIComponent(classroomId)}/join`, {
        method: "POST",
        body: JSON.stringify({ accessToken })
      });
      sessionStorage.setItem(storageKeys.classroomId, classroomId);
      sessionStorage.setItem(storageKeys.sessionId, state.sessionId);
      sessionStorage.setItem(storageKeys.accessToken, state.accessToken);
      renderState(state);
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => refreshStatus().catch(error => {
        classroomStatus.textContent = error.message;
      }), 3000);
    } catch (error) {
      joined = false;
      setBusy(false);
      classroomStatus.textContent = error.message;
      if (/session ID/i.test(error.message) && sessionIdError) sessionIdError.textContent = error.message;
    }
  }

  joinButton.addEventListener("click", joinClassroom);

  classroomInput.addEventListener("input", () => {
    if (joined) return;
    classroomInput.value = classroomInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  });

  submitButton.addEventListener("click", async event => {
    event.preventDefault();
    if (!joined || busy || classroomState?.submitted || classroomState?.status === "closed") return;

    try {
      const { classroomId, sessionId } = currentIdentity();
      setBusy(true);
      const selectedSeries = [...document.querySelectorAll(".graph-field-chip")]
        .map(chip => chip.textContent.replace(/^Series:\s*/, "").replace(/\s*×$/, ""));
      const graphData = window.getGraphSubmissionData?.() || {
        categories: [],
        series: selectedSeries.map(name => ({ name, values: [] }))
      };
      const categoryFieldChip = [...document.querySelectorAll(".graph-field-chip")]
        .find(chip => chip.textContent.startsWith("Categories:"));
      graphData.categoriesField = categoryFieldChip?.textContent
        .replace(/^Categories:\s*/, "")
        .replace(/\s*×$/, "") || "";

      const submission = {
        claim: document.getElementById("claimText")?.value.trim() || "",
        chartType: document.querySelector("[data-chart-type].active")?.dataset.chartType || "bar",
        graphTitle: document.getElementById("graphTitle")?.value.trim() || "",
        categories: graphData.categoriesField || "(none)",
        series: selectedSeries.join(", ") || "(none)",
        xAxisLabel: document.getElementById("xAxisLabel")?.value.trim() || "",
        yAxisLabel: document.getElementById("yAxisLabel")?.value.trim() || "",
        additionalQuestions: document.getElementById("questionText")?.value.trim() || "",
        graphData
      };

      const state = await api(`/api/classrooms/${encodeURIComponent(classroomId)}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          accessToken: sessionStorage.getItem(storageKeys.accessToken),
          submission
        })
      });
      const latestState = await api(`/api/classrooms/${encodeURIComponent(classroomId)}/status?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { "x-classroom-token": sessionStorage.getItem(storageKeys.accessToken) || "" }
      });
      renderState(latestState || state);
    } catch (error) {
      classroomStatus.textContent = error.message;
      if (/session ID/i.test(error.message) && sessionIdError) sessionIdError.textContent = error.message;
      setBusy(false);
    }
  });

  closeButton.addEventListener("click", async () => {
    if (!joined || busy) return;
    try {
      const { classroomId, sessionId } = currentIdentity();
      setBusy(true);
      classroomStatus.textContent = "Closing classroom and assigning peer reviews…";
      const state = await api(`/api/classrooms/${encodeURIComponent(classroomId)}/close`, {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          accessToken: sessionStorage.getItem(storageKeys.accessToken)
        })
      });
      renderState(state);
    } catch (error) {
      classroomStatus.textContent = error.message;
      setBusy(false);
    }
  });

  submitButton.disabled = true;
  closeButton.disabled = true;

  if (classroomInput.value && sessionInput.value) joinClassroom();
})();
