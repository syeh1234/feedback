(() => {
  const page = document.getElementById("peerReviewPage");
  const classroomInput = document.getElementById("classroomId");
  const status = document.getElementById("classroomStatus");
  const graphCanvas = document.getElementById("peerGraph");
  const graphTitle = document.getElementById("peerGraphTitle");
  const studentClaim = document.getElementById("peerStudentClaim");
  const studentQuestion = document.getElementById("peerStudentQuestion");
  const onToFeedback = document.getElementById("onToFeedback");
  const feedbackRevealNote = document.getElementById("feedbackRevealNote");
  const clarifySection = document.getElementById("clarify");
  const onToValue = document.getElementById("onToValue");
  const valueSection = document.getElementById("value");
  const onToStateConcerns = document.getElementById("onToStateConcerns");
  const stateConcernsSection = document.getElementById("stateConcerns");
  const onToSuggest = document.getElementById("onToSuggest");
  const suggestSection = document.getElementById("suggest");
  const sendToStudent = document.getElementById("sendToStudent");
  const completionPanel = document.getElementById("reviewCompletePanel");
  const completionStatus = document.getElementById("reviewCompletionStatus");
  const downloadButton = document.getElementById("downloadAllResponses");
  let reviewState = null;
  let sending = false;
  let statusTimer = null;
  const palette = ["#3478b8", "#e28b35", "#32936f", "#9b70b5", "#d45d79", "#7b8491"];
  let assignedSubmission = null;
  const storageKeys = {
    classroomId: "ap-statistics-current-classroom",
    sessionId: "ap-statistics-current-session",
    accessToken: "ap-statistics-current-access-token"
  };

  onToFeedback?.addEventListener("click", () => {
    if (assignedSubmission) {
      studentClaim.textContent = assignedSubmission.claim || "(No claim provided)";
      studentQuestion.textContent = assignedSubmission.additionalQuestions || "(No questions provided)";
    }
    if (feedbackRevealNote) feedbackRevealNote.hidden = false;
    if (!clarifySection) return;
    clarifySection.hidden = false;
    clarifySection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  onToValue?.addEventListener("click", () => {
    if (!valueSection) return;
    valueSection.hidden = false;
    valueSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  onToStateConcerns?.addEventListener("click", () => {
    if (!stateConcernsSection) return;
    stateConcernsSection.hidden = false;
    stateConcernsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  onToSuggest?.addEventListener("click", () => {
    if (!suggestSection) return;
    suggestSection.hidden = false;
    suggestSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function drawAssignedGraph(submission) {
    if (!graphCanvas || !submission) return;

    let graphData = submission.graphData || {};
    if (typeof graphData === "string") {
      try { graphData = JSON.parse(graphData); } catch { graphData = {}; }
    }

    const categories = Array.isArray(graphData.categories) ? graphData.categories.map(String) : [];
    const series = Array.isArray(graphData.series) ? graphData.series.map(item => ({
      name: String(item.name || "Series"),
      values: Array.isArray(item.values) ? item.values.map(Number) : []
    })) : [];
    const chartType = submission.chartType || "bar";
    const canvas = graphCanvas;
    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.globalAlpha = 1;
    context.textBaseline = "alphabetic";

    graphTitle.textContent = submission.graphTitle || "";
    assignedSubmission = submission;

    const plot = { left: 58, right: 24, top: 42, bottom: 70 };
    plot.width = Math.max(1, width - plot.left - plot.right);
    plot.height = Math.max(1, height - plot.top - plot.bottom);
    const allValues = series.flatMap(item => item.values.filter(Number.isFinite));

    const drawAxes = maxValue => {
      const maximum = Math.max(1, maxValue);
      context.font = "11px Arial";
      context.textAlign = "right";
      context.textBaseline = "middle";

      for (let index = 0; index <= 4; index++) {
        const y = plot.top + plot.height - plot.height * index / 4;
        context.strokeStyle = "#e1e5e9";
        context.beginPath();
        context.moveTo(plot.left, y);
        context.lineTo(plot.left + plot.width, y);
        context.stroke();
        context.fillStyle = "#59616c";
        context.fillText(String(Math.round(maximum * index / 4)), plot.left - 8, y);
      }

      context.strokeStyle = "#9299a3";
      context.beginPath();
      context.moveTo(plot.left, plot.top);
      context.lineTo(plot.left, plot.top + plot.height);
      context.lineTo(plot.left + plot.width, plot.top + plot.height);
      context.stroke();
      return maximum;
    };

    const drawLegend = () => {
      if (!series.length) return;
      context.font = "12px Arial";
      context.textAlign = "left";
      context.textBaseline = "middle";
      const widths = series.map(item => 16 + context.measureText(item.name).width + 18);
      const allWidth = widths.reduce((sum, value) => sum + value, 0) - 18;
      const twoRows = allWidth > width - 16;
      const capacity = twoRows ? Math.ceil(series.length / 2) : series.length;
      const rows = twoRows ? [series.slice(0, capacity), series.slice(capacity)] : [series];

      rows.forEach((items, rowIndex) => {
        const rowWidth = items.reduce((sum, item) => sum + 16 + context.measureText(item.name).width, 0) + Math.max(0, items.length - 1) * 18;
        let x = Math.max(8, (width - rowWidth) / 2);
        const y = 16 + rowIndex * 17;
        items.forEach(item => {
          const index = series.indexOf(item);
          context.fillStyle = palette[index % palette.length];
          context.fillRect(x, y - 5, 10, 10);
          context.fillStyle = "#343b44";
          context.fillText(item.name, x + 16, y);
          x += 16 + context.measureText(item.name).width + 18;
        });
      });
    };

    const drawCategoryTicks = labels => {
      if (!labels.length) return;
      const step = plot.width / labels.length;
      const lineHeight = 13;
      const maxWidth = Math.max(30, step - 8);
      context.font = "11px Arial";
      context.fillStyle = "#3e4650";
      context.textAlign = "center";
      context.textBaseline = "top";

      const wrapLabel = text => {
        const words = String(text).split(/\s+/);
        const lines = [];
        let line = "";

        words.forEach(word => {
          if (context.measureText(word).width > maxWidth) {
            if (line) {
              lines.push(line);
              line = "";
            }

            let part = "";
            for (const character of word) {
              if (part && context.measureText(part + character).width > maxWidth) {
                lines.push(part);
                part = character;
              } else {
                part += character;
              }
            }
            line = part;
            return;
          }

          const candidate = line ? `${line} ${word}` : word;
          if (line && context.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });

        if (line) lines.push(line);
        return lines;
      };

      labels.forEach((label, index) => {
        const x = plot.left + step * (index + 0.5);
        wrapLabel(label).forEach((line, lineIndex) => {
          context.fillText(line, x, plot.top + plot.height + 8 + lineIndex * lineHeight);
        });
      });
    };

    if (chartType === "pie") {
      if (categories.length) {
        context.font = "11px Arial";
        context.textBaseline = "middle";
        const columns = Math.min(4, categories.length);
        const rows = Math.ceil(categories.length / columns);
        categories.forEach((category, index) => {
          const row = Math.floor(index / columns);
          const column = index % columns;
          const cellWidth = (width - 24) / columns;
          const x = 12 + column * cellWidth;
          const y = height - rows * 15 + row * 15;
          context.fillStyle = palette[index % palette.length];
          context.fillRect(x, y - 4, 8, 8);
          context.fillStyle = "#343b44";
          context.fillText(String(category), x + 13, y);
        });
      }

      const columns = series.length === 1 ? 1 : 2;
      const rows = Math.ceil(series.length / columns);
      const cellWidth = width / columns;
      const contentBottom = height - (categories.length ? 38 : 12);
      const rowHeight = contentBottom / Math.max(1, rows);
      const radius = Math.max(24, Math.min(cellWidth * 0.42, (rowHeight - 24) * 0.42, 140));

      series.forEach((item, seriesIndex) => {
        const row = Math.floor(seriesIndex / columns);
        const column = seriesIndex % columns;
        const centerX = cellWidth * (column + 0.5);
        const centerY = row * rowHeight + rowHeight / 2;
        context.fillStyle = "#343b44";
        context.font = "13px Arial";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.fillText(item.name, centerX, centerY - radius - 6);
        const total = item.values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
        let angle = -Math.PI / 2;
        item.values.forEach((value, valueIndex) => {
          const next = angle + Math.max(0, value) / total * Math.PI * 2;
          context.beginPath();
          context.moveTo(centerX, centerY);
          context.arc(centerX, centerY, radius, angle, next);
          context.closePath();
          context.fillStyle = palette[valueIndex % palette.length];
          context.fill();
          context.strokeStyle = "#fff";
          context.lineWidth = 1.5;
          context.stroke();
          angle = next;
        });
      });
      return;
    }

    if (chartType === "histogram") {
      if (!allValues.length) return;
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      const range = max - min || 1;
      const bins = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(allValues.length))));
      const counts = series.map(item => {
        const values = Array(bins).fill(0);
        item.values.forEach(value => values[Math.min(bins - 1, Math.floor((value - min) / range * bins))]++);
        return values;
      });
      const maximum = drawAxes(Math.max(1, ...counts.flat()) * 1.15);
      const binWidth = plot.width / bins;
      counts.forEach((values, seriesIndex) => values.forEach((count, binIndex) => {
        const barHeight = count / maximum * plot.height;
        context.globalAlpha = 0.42;
        context.fillStyle = palette[seriesIndex % palette.length];
        context.fillRect(plot.left + binIndex * binWidth + 1, plot.top + plot.height - barHeight, Math.max(1, binWidth - 2), barHeight);
      }));
      context.globalAlpha = 1;
      context.font = "11px Arial";
      context.textAlign = "center";
      context.textBaseline = "top";
      for (let index = 0; index <= bins; index++) {
        context.fillStyle = "#343b44";
        context.fillText(String(Number((min + range * index / bins).toFixed(1))), plot.left + plot.width * index / bins, plot.top + plot.height + 8);
      }
      drawLegend();
    } else if (chartType === "boxplot") {
      if (!allValues.length) return;
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      const range = max - min || 1;
      const x = value => plot.left + (value - min) / range * plot.width;
      const centerY = plot.top + plot.height / 2;
      context.strokeStyle = "#9299a3";
      context.beginPath();
      context.moveTo(plot.left, centerY);
      context.lineTo(plot.left + plot.width, centerY);
      context.stroke();
      const spacing = Math.min(36, plot.height / Math.max(1, series.length));
      const boxHeight = Math.min(28, spacing * 0.8);
      series.forEach((item, seriesIndex) => {
        const values = item.values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!values.length) return;
        const quantile = p => values[Math.floor((values.length - 1) * p)];
        const y = centerY + (seriesIndex - (series.length - 1) / 2) * spacing;
        const color = palette[seriesIndex % palette.length];
        context.strokeStyle = color;
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(x(values[0]), y);
        context.lineTo(x(values[values.length - 1]), y);
        context.moveTo(x(values[0]), y - boxHeight * 0.35);
        context.lineTo(x(values[0]), y + boxHeight * 0.35);
        context.moveTo(x(values[values.length - 1]), y - boxHeight * 0.35);
        context.lineTo(x(values[values.length - 1]), y + boxHeight * 0.35);
        context.stroke();
        const q1 = x(quantile(0.25));
        const q3 = x(quantile(0.75));
        context.globalAlpha = 0.35;
        context.fillRect(q1, y - boxHeight / 2, Math.max(2, q3 - q1), boxHeight);
        context.globalAlpha = 1;
        context.strokeRect(q1, y - boxHeight / 2, Math.max(2, q3 - q1), boxHeight);
        context.beginPath();
        context.moveTo(x(quantile(0.5)), y - boxHeight / 2);
        context.lineTo(x(quantile(0.5)), y + boxHeight / 2);
        context.stroke();
      });
      context.font = "11px Arial";
      context.textAlign = "center";
      context.textBaseline = "top";
      for (let index = 0; index <= 4; index++) {
        context.fillStyle = "#343b44";
        context.fillText(String(Number((min + range * index / 4).toFixed(1))), plot.left + plot.width * index / 4, plot.top + plot.height + 8);
      }
      drawLegend();
    } else {
      const maximum = drawAxes(Math.max(1, ...allValues) * 1.1);
      const fallbackCount = Math.max(1, ...series.map(item => item.values.length));
      const count = Math.max(1, categories.length || fallbackCount);
      const step = plot.width / count;

      series.forEach((item, seriesIndex) => {
        const color = palette[seriesIndex % palette.length];
        if (chartType === "bar") {
          const barWidth = Math.min(48, step * 0.78 / Math.max(1, series.length));
          item.values.forEach((value, index) => {
            const center = plot.left + step * (index + 0.5);
            const x = center - series.length * barWidth / 2 + seriesIndex * barWidth;
            const barHeight = Math.max(0, value) / maximum * plot.height;
            context.fillStyle = color;
            context.fillRect(x + 1, plot.top + plot.height - barHeight, Math.max(1, barWidth - 2), barHeight);
          });
        } else {
          const points = item.values.map((value, index) => ({
            x: plot.left + step * (index + 0.5),
            y: plot.top + plot.height - value / maximum * plot.height
          }));
          if (chartType === "line") {
            context.strokeStyle = color;
            context.lineWidth = 2;
            context.beginPath();
            points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
            context.stroke();
          }
          points.forEach(point => {
            context.fillStyle = color;
            context.beginPath();
            context.arc(point.x, point.y, chartType === "scatter" ? 5 : 4, 0, Math.PI * 2);
            context.fill();
          });
        }
      });
      drawCategoryTicks(categories.length ? categories : Array.from({ length: count }, (_, index) => `Item ${index + 1}`));
      drawLegend();
    }

    if (submission.xAxisLabel) {
      context.font = "13px Arial";
      context.fillStyle = "#343b44";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(submission.xAxisLabel, plot.left + plot.width / 2, height - 4);
    }
    if (submission.yAxisLabel) {
      context.save();
      context.translate(14, plot.top + plot.height / 2);
      context.rotate(-Math.PI / 2);
      context.font = "13px Arial";
      context.fillStyle = "#343b44";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(submission.yAxisLabel, 0, 0);
      context.restore();
    }
  }

  function setReviewComplete(state) {
    reviewState = state;
    if (!state.reviewSubmitted) return;
    document.getElementById("claim").hidden = true;
    clarifySection.hidden = true;
    valueSection.hidden = true;
    stateConcernsSection.hidden = true;
    suggestSection.hidden = true;
    completionPanel.hidden = false;
    const remaining = Math.max(0, state.reviewTargetCount - state.reviewCount);
    completionStatus.textContent = state.allReviewsSubmitted
      ? `Everyone in classroom ${state.classroomId} has submitted peer feedback. You can now download all classroom responses.`
      : `Your feedback has been saved. Waiting for ${remaining} more ${remaining === 1 ? "student" : "students"} to finish (${state.reviewCount} of ${state.reviewTargetCount} submitted).`;
    downloadButton.hidden = !state.allReviewsSubmitted;
  }

  async function fetchStatus() {
    const classroomId = sessionStorage.getItem(storageKeys.classroomId);
    const sessionId = sessionStorage.getItem(storageKeys.sessionId);
    const accessToken = sessionStorage.getItem(storageKeys.accessToken);
    const response = await fetch(
      `/api/classrooms/${encodeURIComponent(classroomId)}/status?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { "x-classroom-token": accessToken } }
    );
    const state = await response.json();
    if (!response.ok) throw new Error(state.error || "Could not refresh classroom status.");
    reviewState = state;
    if (state.reviewSubmitted) setReviewComplete(state);
    else status.textContent = `Classroom ${classroomId} is closed. Peer review is ready. ${state.reviewCount} of ${state.reviewTargetCount} reviews submitted.`;
    return state;
  }

  sendToStudent?.addEventListener("click", async () => {
    if (sending || reviewState?.reviewSubmitted || !assignedSubmission) return;
    const classroomId = sessionStorage.getItem(storageKeys.classroomId);
    const sessionId = sessionStorage.getItem(storageKeys.sessionId);
    const accessToken = sessionStorage.getItem(storageKeys.accessToken);
    sending = true;
    sendToStudent.disabled = true;
    sendToStudent.textContent = "Sending…";
    status.textContent = "Saving your peer review…";
    try {
      const response = await fetch(`/api/classrooms/${encodeURIComponent(classroomId)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          accessToken,
          review: {
            preFeedback: document.getElementById("claimText").value,
            clarify: document.getElementById("clarifyText").value,
            value: document.getElementById("valueText").value,
            concerns: document.getElementById("concernsText").value,
            suggestions: document.getElementById("suggestionsText").value
          }
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your peer review could not be saved.");
      setReviewComplete(result);
      await fetchStatus();
    } catch (error) {
      status.textContent = error.message;
      sendToStudent.disabled = false;
      sendToStudent.textContent = "Send to Student";
    } finally {
      sending = false;
    }
  });

  downloadButton?.addEventListener("click", async () => {
    if (!reviewState?.allReviewsSubmitted) return;
    const classroomId = sessionStorage.getItem(storageKeys.classroomId);
    const sessionId = sessionStorage.getItem(storageKeys.sessionId);
    const accessToken = sessionStorage.getItem(storageKeys.accessToken);
    downloadButton.disabled = true;
    downloadButton.textContent = "Preparing download…";
    try {
      const response = await fetch(
        `/api/classrooms/${encodeURIComponent(classroomId)}/reviews/download?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: { "x-classroom-token": accessToken } }
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "The classroom responses could not be downloaded.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `classroom-${classroomId}-all-responses.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      // The server clears the classroom once the complete CSV has been prepared.
      // Clear this browser's old identity too, so it can join the same code afresh.
      Object.values(storageKeys).forEach(key => sessionStorage.removeItem(key));
      if (statusTimer) clearInterval(statusTimer);
      status.textContent = `Classroom ${classroomId} has been cleared and is ready to reuse.`;
      completionStatus.textContent = `Download complete. Classroom ${classroomId} is now available for a new activity.`;
      downloadButton.hidden = true;
    } catch (error) {
      completionStatus.textContent = error.message;
      downloadButton.textContent = "Download All Responses";
    } finally {
      downloadButton.disabled = false;
    }
  });

  async function verifyClosedClassroom() {
    const classroomId = sessionStorage.getItem(storageKeys.classroomId);
    const sessionId = sessionStorage.getItem(storageKeys.sessionId);
    const accessToken = sessionStorage.getItem(storageKeys.accessToken);

    if (!classroomId || !sessionId || !accessToken) {
      window.location.replace("/");
      return;
    }

    try {
      const state = await fetchStatus();
      if (state.status !== "closed") {
        window.location.replace("/");
        return;
      }
      classroomInput.value = classroomId;
      classroomInput.closest(".student-bar")?.classList.add("classroom-joined");
      const submission = state.assignedSubmission;
      if (submission) {
        assignedSubmission = submission;
        drawAssignedGraph(submission);
      }
      page.hidden = false;
      if (state.reviewSubmitted) setReviewComplete(state);
      requestAnimationFrame(() => {
        if (submission) drawAssignedGraph(submission);
      });
      window.addEventListener("resize", () => {
        if (submission) drawAssignedGraph(submission);
      });
      statusTimer = setInterval(() => {
        if (!sending) fetchStatus().catch(error => {
          if (error.message.includes("Classroom not found")) {
            Object.values(storageKeys).forEach(key => sessionStorage.removeItem(key));
            clearInterval(statusTimer);
            status.textContent = "This classroom session is no longer active.";
            completionStatus.textContent = "The classroom session has ended."
            downloadButton.hidden = true;
          } else {
            status.textContent = error.message;
          }
        });
      }, 3000);
    } catch (error) {
      // Clear stale browser identity when the server has deleted this classroom.
      if (/Classroom not found|Join this classroom before continuing/i.test(error.message)) {
        Object.values(storageKeys).forEach(key => sessionStorage.removeItem(key));
        window.location.replace("/");
        return;
      }

      status.textContent = "Could not verify the classroom. Check your connection and return to the worksheet to rejoin.";
      page.hidden = false;
    }
  }

  verifyClosedClassroom();
})();
