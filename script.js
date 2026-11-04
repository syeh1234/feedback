
(() => {
  const canvas = document.getElementById("chart");
  const emptyState = document.getElementById("emptyState");
  const chartWrap = document.getElementById("chartWrap");
  const chartNote = document.getElementById("chartNote");
  const selectedField = document.getElementById("selectedField");

  if (!canvas || !emptyState || !chartWrap || !chartNote) {
    console.error(
      "Graph builder setup error: check chart, emptyState, chartWrap, and chartNote in index.html."
    );
    return;
  }

  const ctx = canvas.getContext("2d");

  const dataset = {
    school: {
      label: "School",
      kind: "text",
      values: [
        "Dawn High School",
        "Fog Crest Academy",
        "Nova Learning Institute",
        "Talons High School"
      ]
    },
    ap: {
      label: "AP Statistics enrollment",
      kind: "number",
      values: [102, 84, 10, 92]
    },
    total: {
      label: "Total student enrollment",
      kind: "number",
      values: [921, 233, 401, 1240]
    }
  };

  // One categorical field and any number of numeric series.
  let categoryField = null;
  let seriesFields = [];
  let chartType = "bar";

  const palette = [
    "#3478b8",
    "#e28b35",
    "#32936f",
    "#9b70b5",
    "#d45d79",
    "#7b8491"
  ];

  const labelFor = field => dataset[field]?.label || field;

  const chartTypes = [
    "bar",
    "scatter",
    "line",
    "pie",
    "histogram"
  ];

  function getCategories() {
    if (categoryField && dataset[categoryField]?.kind === "text") {
      return dataset[categoryField].values;
    }

    const firstSeries = seriesFields[0];
    return firstSeries ? dataset[firstSeries].values.map((_, i) => `Item ${i + 1}`) : [];
  }

  function getNumericFields() {
    return seriesFields.filter(
      field => dataset[field]?.kind === "number"
    );
  }

  function getValues(field) {
    return dataset[field].values.map(Number);
  }

  window.getGraphSubmissionData = () => ({
    categories: categoryField ? dataset[categoryField].values : getCategories(),
    series: getNumericFields().map(field => ({
      name: labelFor(field),
      values: getValues(field)
    }))
  });


  // Create-new-variable popup and formula builder.
  const createVariableTab = document.getElementById("createVariableTab");
  const variablePopup = document.getElementById("variablePopup");
  const closeVariablePopup = document.getElementById("closeVariablePopup");
  const newVariableName = document.getElementById("newVariableName");
  const variableTiles = document.getElementById("variableTiles");
  const variableNumber = document.getElementById("variableNumber");
  const addVariableNumber = document.getElementById("addVariableNumber");
  const variableExpression = document.getElementById("variableExpression");
  const clearVariableExpression = document.getElementById("clearVariableExpression");
  const variablePreview = document.getElementById("variablePreview");
  const variableError = document.getElementById("variableError");
  const saveVariable = document.getElementById("saveVariable");
  const dataPanel = document.querySelector(".data-panel");
  const variableCreator = document.querySelector(".variable-creator");

  // Portal the editor to <body> so scroll containers and transformed
  // workspace ancestors cannot clip the popup.
  if (variablePopup && variablePopup.parentElement !== document.body) {
    document.body.appendChild(variablePopup);
  }

  let expressionTokens = [];
  const expressionOperators = ["+", "-", "*", "/"];

  function showVariableError(message) {
    variableError.textContent = message;
    variablePreview.textContent = `Preview: ${message}`;
    variablePreview.classList.add("has-error");
  }

  function clearVariableError() {
    variableError.textContent = "";
    variablePreview.classList.remove("has-error");
  }

  function openVariableEditor(open) {
    if (!variablePopup || !createVariableTab) return;

    variablePopup.hidden = !open;
    createVariableTab.setAttribute("aria-expanded", String(open));

    if (open) {
      renderVariableTiles();
      renderExpression();
      newVariableName?.focus();
    }
  }

  createVariableTab?.addEventListener("click", () => {
    openVariableEditor(variablePopup.hidden);
  });

  closeVariablePopup?.addEventListener("click", () => {
    openVariableEditor(false);
  });

  function renderVariableTiles() {
    if (!variableTiles) return;

    variableTiles.replaceChildren();

    const variableRow = document.createElement("div");
    variableRow.className = "variable-tile-row";
    const operatorRow = document.createElement("div");
    operatorRow.className = "variable-tile-row";

    Object.entries(dataset)
      .filter(([, item]) => item.kind === "number")
      .forEach(([field, item]) => {
        const tile = document.createElement("div");
        tile.className = "variable-drag-tile";
        tile.textContent = item.label;
        tile.draggable = true;
        tile.dataset.kind = "variable";
        tile.dataset.value = field;
        tile.tabIndex = 0;
        tile.title = "Drag into the formula";

        tile.addEventListener("dragstart", event => {
          event.dataTransfer?.setData(
            "application/x-variable-token",
            JSON.stringify({ type: "variable", value: field })
          );
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "copy";
          }
        });

        tile.addEventListener("click", () => {
          expressionTokens.push({ type: "variable", value: field });
          renderExpression();
        });

        variableRow.appendChild(tile);
      });

    expressionOperators.forEach(operator => {
      const tile = document.createElement("div");
      tile.className = "variable-drag-tile";
      tile.textContent = operator;
      tile.draggable = true;
      tile.dataset.kind = "operator";
      tile.tabIndex = 0;
      tile.title = "Drag into the formula";

      tile.addEventListener("dragstart", event => {
        event.dataTransfer?.setData(
          "application/x-variable-token",
          JSON.stringify({ type: "operator", value: operator })
        );
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "copy";
        }
      });

      tile.addEventListener("click", () => {
        expressionTokens.push({ type: "operator", value: operator });
        renderExpression();
      });

      operatorRow.appendChild(tile);
    });

    variableTiles.append(variableRow, operatorRow);
  }

  function renderExpression() {
    if (!variableExpression) return;

    variableExpression.replaceChildren();

    if (expressionTokens.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "expression-placeholder";
      placeholder.textContent = "Drop items here to build a formula";
      variableExpression.appendChild(placeholder);
    }

    expressionTokens.forEach((token, index) => {
      const chip = document.createElement("span");
      chip.className = "expression-token";
      chip.dataset.kind = token.type;

      if (token.type === "variable") {
        chip.textContent = dataset[token.value]?.label || token.value;
      } else {
        chip.textContent = String(token.value);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove item");
      remove.addEventListener("click", () => {
        expressionTokens.splice(index, 1);
        renderExpression();
      });

      chip.appendChild(remove);
      variableExpression.appendChild(chip);
    });

    updateVariablePreview();
  }

  variableExpression?.addEventListener("dragover", event => {
    event.preventDefault();
    variableExpression.classList.add("drag-over");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });

  variableExpression?.addEventListener("dragleave", event => {
    if (!variableExpression.contains(event.relatedTarget)) {
      variableExpression.classList.remove("drag-over");
    }
  });

  variableExpression?.addEventListener("drop", event => {
    event.preventDefault();
    variableExpression.classList.remove("drag-over");

    const transfer = event.dataTransfer;
    if (!transfer) return;

    const customToken = transfer.getData("application/x-variable-token");

    if (customToken) {
      try {
        const token = JSON.parse(customToken);

        if (
          token.type === "variable" &&
          dataset[token.value]?.kind === "number"
        ) {
          expressionTokens.push(token);
        } else if (
          token.type === "operator" &&
          expressionOperators.includes(token.value)
        ) {
          expressionTokens.push(token);
        }

        renderExpression();
      } catch {
        showVariableError("That item could not be added.");
      }

      return;
    }

    // Also allow dragging a numeric field tile from the Data panel.
    const field = transfer.getData("text/plain");

    if (dataset[field]?.kind === "number") {
      expressionTokens.push({ type: "variable", value: field });
      renderExpression();
    }
  });

  addVariableNumber?.addEventListener("click", () => {
    const value = variableNumber.value.trim();

    if (value === "" || !Number.isFinite(Number(value))) {
      showVariableError("Enter a valid number first.");
      return;
    }

    expressionTokens.push({ type: "number", value: Number(value) });
    variableNumber.value = "";
    clearVariableError();
    renderExpression();
  });

  variableNumber?.addEventListener("keydown", event => {
    if (event.key === "Enter") addVariableNumber?.click();
  });

  clearVariableExpression?.addEventListener("click", () => {
    expressionTokens = [];
    clearVariableError();
    renderExpression();
  });

  // Evaluate the formula without using eval().
  function calculateNewVariable() {
    if (expressionTokens.length === 0) {
      throw new Error("Add variables, numbers, and operators to the formula.");
    }

    const expectsValue = expressionTokens.length % 2 === 1;

    if (!expectsValue) {
      throw new Error("The formula cannot end with an operator.");
    }

    for (let i = 0; i < expressionTokens.length; i++) {
      const token = expressionTokens[i];
      const shouldBeValue = i % 2 === 0;

      if (shouldBeValue && !["variable", "number"].includes(token.type)) {
        throw new Error("Place an operator between each value.");
      }

      if (!shouldBeValue && token.type !== "operator") {
        throw new Error("Place an operator between each value.");
      }

      if (
        token.type === "operator" &&
        !expressionOperators.includes(token.value)
      ) {
        throw new Error("Unsupported operator.");
      }
    }

    const numericFields = Object.values(dataset)
      .filter(item => item.kind === "number")
      .map(item => item.values.length);

    const rowCount = Math.max(...numericFields);

    return Array.from({ length: rowCount }, (_, row) => {
      const values = [];
      const operators = [];

      expressionTokens.forEach(token => {
        if (token.type === "number") {
          values.push(token.value);
        } else if (token.type === "variable") {
          const item = dataset[token.value];

          if (!item || item.kind !== "number" || row >= item.values.length) {
            throw new Error("A variable does not have a value for every row.");
          }

          values.push(Number(item.values[row]));
        } else if (token.type === "operator") {
          const precedence = operator =>
            operator === "*" || operator === "/" ? 2 : 1;

          while (
            operators.length &&
            precedence(operators[operators.length - 1]) >= precedence(token.value)
          ) {
            applyOperator();
          }

          operators.push(token.value);
        }
      });

      while (operators.length) applyOperator();

      if (values.length !== 1 || !Number.isFinite(values[0])) {
        throw new Error("The formula produced an invalid value.");
      }

      return values[0];

      function applyOperator() {
        const operator = operators.pop();
        const right = values.pop();
        const left = values.pop();

        if (left === undefined || right === undefined) {
          throw new Error("Check the order of your formula.");
        }

        let result;

        switch (operator) {
          case "+": result = left + right; break;
          case "-": result = left - right; break;
          case "*": result = left * right; break;
          case "/":
            if (right === 0) throw new Error("Cannot divide by zero.");
            result = left / right;
            break;
        }

        values.push(result);
      }
    });
  }

  function updateVariablePreview() {
    if (!variablePreview || !variableError) return;

    clearVariableError();

    try {
      const values = calculateNewVariable();
      variablePreview.textContent =
        "Preview: " + values.map(value => Number(value.toFixed(4))).join(", ");
    } catch (error) {
      if (expressionTokens.length > 0) {
        showVariableError(error.message);
      } else {
        variablePreview.textContent = "Your calculated values will appear here.";
      }
    }
  }

  function attachNewFieldTile(tile, field) {
    tile.addEventListener("click", () => addField(field));

    tile.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        addField(field);
      }
    });

    tile.addEventListener("dragstart", event => {
      if (!event.dataTransfer) return;

      event.dataTransfer.setData("text/plain", field);
      event.dataTransfer.effectAllowed = "copy";
      chartWrap.classList.add("ready-to-drop");
    });

    tile.addEventListener("dragend", () => {
      chartWrap.classList.remove("ready-to-drop", "drag-over");
    });
  }

  saveVariable?.addEventListener("click", () => {
    const name = newVariableName.value.trim();

    if (!name) {
      showVariableError("Enter a name for the new variable.");
      newVariableName.focus();
      return;
    }

    const existingName = Object.values(dataset).some(
      item => item.label.toLowerCase() === name.toLowerCase()
    );

    if (existingName) {
      showVariableError("A variable with that name already exists.");
      return;
    }

    let values;

    try {
      values = calculateNewVariable();
    } catch (error) {
      showVariableError(error.message);
      return;
    }

    const field = "custom_" + Date.now();

    dataset[field] = {
      label: name,
      kind: "number",
      values
    };

    const tile = document.createElement("div");
    tile.className = "field-tile";
    tile.draggable = true;
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.dataset.field = field;

    const icon = document.createElement("span");
    icon.className = "field-icon number-field";
    icon.textContent = "123";

    const label = document.createElement("span");
    label.textContent = name;

    const kind = document.createElement("span");
    kind.className = "field-kind";

    tile.append(icon, label, kind);

    if (dataPanel && variableCreator) {
      dataPanel.insertBefore(tile, variableCreator);
    }

    attachNewFieldTile(tile, field);

    expressionTokens = [];
    newVariableName.value = "";
    clearVariableError();
    renderExpression();
    renderVariableTiles();
    openVariableEditor(false);

    addField(field);
  });


  function addField(field) {
    if (!dataset[field]) {
      console.warn("Unknown graph field:", field);
      return;
    }

    // Avoid adding the same field more than once.
    if (field === categoryField || seriesFields.includes(field)) {
      return;
    }

    if (dataset[field].kind === "text") {
      // A text field supplies category labels, not a numeric series.
      if (categoryField) {
        categoryField = field;
      } else {
        categoryField = field;
      }
    } else {
      seriesFields.push(field);
    }

    drawChart();
  }

  function removeField(field) {
    if (field === categoryField) {
      categoryField = null;
    }

    seriesFields = seriesFields.filter(item => item !== field);
    drawChart();
  }

  // Field tiles: click, keyboard, or drag-and-drop.
  document.querySelectorAll(".field-tile").forEach(tile => {
    tile.draggable = true;

    tile.addEventListener("click", () => {
      addField(tile.dataset.field);
    });

    tile.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        addField(tile.dataset.field);
      }
    });

    tile.addEventListener("dragstart", event => {
      if (!event.dataTransfer) return;

      event.dataTransfer.setData("text/plain", tile.dataset.field);
      event.dataTransfer.effectAllowed = "copy";
      chartWrap.classList.add("ready-to-drop");
    });

    tile.addEventListener("dragend", () => {
      chartWrap.classList.remove("ready-to-drop", "drag-over");
    });
  });

  chartWrap.addEventListener("dragenter", event => {
    event.preventDefault();
    chartWrap.classList.add("drag-over");
  });

  chartWrap.addEventListener("dragover", event => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    chartWrap.classList.add("drag-over");
  });

  chartWrap.addEventListener("dragleave", event => {
    if (!chartWrap.contains(event.relatedTarget)) {
      chartWrap.classList.remove("drag-over");
    }
  });

  chartWrap.addEventListener("drop", event => {
    event.preventDefault();
    chartWrap.classList.remove("drag-over", "ready-to-drop");

    const field = event.dataTransfer?.getData("text/plain");
    if (field) addField(field);
  });

  
  function prepareCanvas(contentHeight = null) {
    canvas.hidden = false;

    const styles = window.getComputedStyle(chartWrap);

    // Measure the space inside the preview window.
    const width = Math.max(
      1,
      chartWrap.clientWidth -
        parseFloat(styles.paddingLeft) -
        parseFloat(styles.paddingRight)
    );

    const height = Math.max(
      1,
      chartWrap.clientHeight -
        parseFloat(styles.paddingTop) -
        parseFloat(styles.paddingBottom)
    );
    const canvasHeight = Math.max(height, contentHeight || height);

    const dpr = window.devicePixelRatio || 1;

    // Make the canvas fill the preview window.
    canvas.style.width = `${width}px`;
    canvas.style.height = `${canvasHeight}px`;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(canvasHeight * dpr);

    // Draw using CSS pixels while keeping the graph sharp.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { width, height: canvasHeight, viewportHeight: height };
  }

  function positionAxisLabels(width, height, hasData) {
    const wrapRect = chartWrap.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const canvasLeft = canvasRect.left - wrapRect.left;
    const canvasTop = canvasRect.top - wrapRect.top;
    const legendRows = legendUsesTwoRows(getNumericFields(), width) ? 2 : 1;
    const plot = {
      left: 58,
      right: 24,
      top: hasData ? (legendRows === 2 ? 52 : 40) : 40,
      bottom: 65
    };

    const xAxisEditor = chartWrap.querySelector(".x-axis-editor");
    const yAxisEditor = chartWrap.querySelector(".y-axis-editor");

    if (xAxisEditor) {
      xAxisEditor.style.left = `${canvasLeft + (plot.left + width - plot.right) / 2}px`;
      xAxisEditor.style.top = `${canvasTop + height - plot.bottom + 42}px`;
    }

    if (yAxisEditor) {
      yAxisEditor.style.top = `${canvasTop + (plot.top + height - plot.bottom) / 2}px`;
    }
  }


  function clearChart(w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.textBaseline = "alphabetic";
  }

  function drawAxes(w, h, maxValue, options = {}) {
    const pad = {
      left: options.left ?? 58,
      right: options.right ?? 24,
      top: options.top ?? 35,
      bottom: options.bottom ?? 65
    };

    const plotW = Math.max(1, w - pad.left - pad.right);
    const plotH = Math.max(1, h - pad.top - pad.bottom);
    const max = Math.max(1, maxValue);

    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const y = pad.top + plotH - (plotH * i) / 4;
      const value = (max * i) / 4;

      ctx.strokeStyle = "#e1e5e9";
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = "#59616c";
      ctx.fillText(String(Math.round(value)), pad.left - 8, y);
    }

    ctx.strokeStyle = "#9299a3";
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.stroke();

    return { ...pad, plotW, plotH, max };
  }


  function drawCategoryLabels(categories, plot, options = {}) {
    const count = categories.length;
    if (!count) return;

    const step = plot.plotW / count;
    const lineHeight = 13;
    const maxLabelWidth = Math.max(30, step - 8);

    ctx.fillStyle = "#3e4650";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Split each label into lines that fit within its category's space.
    function wrapLabel(text, maxWidth) {
      const words = String(text).split(/\s+/);
      const lines = [];
      let line = "";

      words.forEach(word => {
        // Split unusually long words if necessary.
        if (ctx.measureText(word).width > maxWidth) {
          if (line) {
            lines.push(line);
            line = "";
          }

          let part = "";
          for (const char of word) {
            if (
              part &&
              ctx.measureText(part + char).width > maxWidth
            ) {
              lines.push(part);
              part = char;
            } else {
              part += char;
            }
          }
          line = part;
          return;
        }

        const testLine = line ? `${line} ${word}` : word;

        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      });

      if (line) lines.push(line);
      return lines;
    }

    categories.forEach((category, i) => {
      const x = plot.left + step * (i + 0.5);
      const lines = wrapLabel(category, maxLabelWidth);

      lines.forEach((line, lineIndex) => {
        ctx.fillText(
          line,
          x,
          plot.top + plot.plotH + 10 + lineIndex * lineHeight
        );
      });
    });
  }


  function legendUsesTwoRows(fields, width) {
    if (!fields.length) return false;

    ctx.font = "12px Arial";
    const itemGap = 18;
    const itemWidths = fields.map(field =>
      16 + ctx.measureText(labelFor(field)).width + itemGap
    );
    const totalWidth = itemWidths.reduce((sum, itemWidth) => sum + itemWidth, 0) - itemGap;

    return totalWidth > width - 16;
  }

  function truncateLegendLabel(label, maxWidth) {
    if (ctx.measureText(label).width <= maxWidth) return label;

    let truncated = label;
    while (truncated && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }

    return truncated ? `${truncated}…` : "";
  }

  function drawLegend(fields, x, y) {
    if (!fields.length) return;

    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const availableWidth = Math.max(1, canvas.clientWidth - 16);
    const swatchSize = 10;
    const textGap = 6;
    const itemGap = 18;
    const twoRows = legendUsesTwoRows(fields, canvas.clientWidth);
    const rowCapacity = twoRows ? Math.ceil(fields.length / 2) : fields.length;
    const slotWidth = (availableWidth - itemGap * (rowCapacity - 1)) / rowCapacity;
    const rows = twoRows
      ? [fields.slice(0, rowCapacity), fields.slice(rowCapacity)]
      : [fields];

    rows.forEach((rowFields, rowIndex) => {
      const items = rowFields.map(field => {
        const maxItemWidth = twoRows
          ? slotWidth
          : availableWidth - (rowFields.length - 1) * itemGap;
        const label = truncateLegendLabel(
          labelFor(field),
          Math.max(0, maxItemWidth - swatchSize - textGap)
        );
        const textWidth = ctx.measureText(label).width;

        return { field, label, width: swatchSize + textGap + textWidth };
      });
      const rowWidth = items.reduce((sum, item) => sum + item.width, 0)
        + itemGap * Math.max(0, items.length - 1);
      let currentX = Math.max(8, (canvas.clientWidth - rowWidth) / 2);
      const rowY = y + rowIndex * 17;

      items.forEach(({ field, label, width: itemWidth }, index) => {
        ctx.fillStyle = palette[fields.indexOf(field) % palette.length];
        ctx.fillRect(currentX, rowY - swatchSize / 2, swatchSize, swatchSize);

        ctx.fillStyle = "#343b44";
        ctx.fillText(label, currentX + swatchSize + textGap, rowY);

        currentX += itemWidth;
        if (index < items.length - 1) currentX += itemGap;
      });
    });
  }

  function drawTemplate(w, h) {
    clearChart(w, h);

    ctx.strokeStyle = "#c1c7cf";
    ctx.fillStyle = "#858e9a";
    ctx.lineWidth = 1.5;

    const left = 58;
    const right = w - 24;
    const top = 40;
    const bottom = h - 65;
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;

    if (chartType === "pie") {
      const headerHeight = 64;
      const rowHeight = h - headerHeight;
      const contentTop = 28;
      const radius = Math.max(
        24,
        Math.min(w * 0.42, (rowHeight - contentTop) * 0.42, 140)
      );
      const centerY = headerHeight + contentTop + (rowHeight - contentTop) / 2;

      ctx.beginPath();
      ctx.arc(w / 2, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    for (let i = 1; i <= 4; i++) {
      const y = bottom - ((bottom - top) * i) / 4;
      ctx.strokeStyle = "#e1e5e9";
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    if (chartType === "bar") {
      const count = 4;
      const step = (right - left) / count;

      for (let i = 0; i < count; i++) {
        ctx.strokeStyle = "#c1c7cf";
        ctx.strokeRect(
          left + step * (i + 0.25),
          bottom - 35,
          step * 0.5,
          35
        );
      }
    }

    if (chartType === "histogram") {
      const bins = 6;
      const binW = (right - left) / bins;

      for (let i = 0; i < bins; i++) {
        ctx.strokeStyle = "#c1c7cf";
        ctx.strokeRect(left + i * binW + 1, bottom - 38, binW - 2, 38);
      }
    }

    if (chartType === "line" || chartType === "scatter") {
      ctx.strokeStyle = "#c1c7cf";
      ctx.setLineDash([4, 4]);

      if (chartType === "line") {
        ctx.beginPath();
        ctx.moveTo(left + 10, bottom - 35);
        ctx.lineTo(left + (right - left) * 0.35, top + 100);
        ctx.lineTo(left + (right - left) * 0.62, bottom - 100);
        ctx.lineTo(right - 10, top + 35);
        ctx.stroke();
      } else {
        [
          [0.18, 0.72],
          [0.38, 0.42],
          [0.63, 0.62],
          [0.84, 0.25]
        ].forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(
            left + (right - left) * x,
            top + (bottom - top) * y,
            4,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        });
      }

      ctx.setLineDash([]);
    }
  }

  function drawBarChart(w, h, fields, categories) {
    const values = fields.flatMap(getValues);
    const legendRows = legendUsesTwoRows(fields, w) ? 2 : 1;
    const plot = drawAxes(w, h, Math.max(1, ...values) * 1.1, {
      top: legendRows === 2 ? 52 : 40,
      bottom: 65
    });
    const categoryCount = Math.max(1, categories.length);
    const seriesCount = Math.max(1, fields.length);
    const groupW = plot.plotW / categoryCount;
    const barW = Math.min(48, (groupW * 0.78) / seriesCount);

    fields.forEach((field, seriesIndex) => {
      const vals = getValues(field);

      vals.forEach((value, i) => {
        const groupCenter = plot.left + groupW * (i + 0.5);
        const x = groupCenter
          - (seriesCount * barW) / 2
          + seriesIndex * barW;
        const barH = (Math.max(0, value) / plot.max) * plot.plotH;
        const y = plot.top + plot.plotH - barH;

        ctx.fillStyle = palette[seriesIndex % palette.length];
        ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
      });
    });

    drawCategoryLabels(categories, plot, { rotate: true });
    drawLegend(fields, plot.left, 16);
  }

  function drawLineOrScatter(w, h, fields, categories) {
    const allValues = fields.flatMap(getValues);
    const legendRows = legendUsesTwoRows(fields, w) ? 2 : 1;
    const plot = drawAxes(w, h, Math.max(1, ...allValues) * 1.1, {
      top: legendRows === 2 ? 52 : 40,
      bottom: 65
    });
    const count = Math.max(1, categories.length);
    const step = plot.plotW / count;

    fields.forEach((field, seriesIndex) => {
      const vals = getValues(field);
      const color = palette[seriesIndex % palette.length];

      const points = vals.map((value, i) => ({
        x: plot.left + step * (i + 0.5),
        y: plot.top + plot.plotH - (value / plot.max) * plot.plotH
      }));

      if (chartType === "line") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        points.forEach((point, i) => {
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });

        ctx.stroke();
      }

      points.forEach(point => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, chartType === "scatter" ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    drawCategoryLabels(categories, plot, { rotate: true });
    drawLegend(fields, plot.left, 16);
  }

  function drawPieCharts(w, h, fields, categories) {
    if (!fields.length) return;

    const columns = fields.length === 1 ? 1 : 2;
    const rowCount = Math.ceil(fields.length / columns);
    const headerHeight = 64;
    const rowHeight = (h - headerHeight) / rowCount;
    const panelW = w / columns;
    const contentTop = 28;
    const radius = Math.max(
      24,
      Math.min(panelW * 0.42, (rowHeight - contentTop) * 0.42, 140)
    );

    drawPieLegend(categories, w, 58);

    fields.forEach((field, seriesIndex) => {
      const row = Math.floor(seriesIndex / columns);
      const column = seriesIndex % columns;
      const vals = getValues(field).map(v => Math.max(0, v));
      const total = vals.reduce((sum, value) => sum + value, 0);
      const rowTop = headerHeight + row * rowHeight;
      const centerX = panelW * (column + 0.5);
      const centerY = rowTop + contentTop + (rowHeight - contentTop) / 2;
      let angle = -Math.PI / 2;

      ctx.fillStyle = "#343b44";
      ctx.font = "13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        truncateLegendLabel(labelFor(field), panelW - 24),
        centerX,
        centerY - radius - 6
      );

      vals.forEach((value, i) => {
        const next = angle + (value / (total || 1)) * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angle, next);
        ctx.closePath();
        ctx.fillStyle = palette[i % palette.length];
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        angle = next;
      });
    });
  }

  function drawPieLegend(categories, width, y) {
    if (!categories.length) return;

    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const availableWidth = Math.max(1, width - 24);
    const swatchSize = 9;
    const textGap = 5;
    const itemGap = 16;
    const measuredItems = categories.map(category => ({
      category,
      label: String(category),
      width: swatchSize + textGap + ctx.measureText(String(category)).width
    }));
    const totalWidth = measuredItems.reduce((sum, item) => sum + item.width, 0)
      + itemGap * Math.max(0, measuredItems.length - 1);
    const rowCount = totalWidth > availableWidth ? 2 : 1;
    const rowCapacity = rowCount === 2 ? Math.ceil(categories.length / 2) : categories.length;
    const slotWidth = (availableWidth - itemGap * (rowCapacity - 1)) / rowCapacity;
    const rows = rowCount === 2
      ? [categories.slice(0, rowCapacity), categories.slice(rowCapacity)]
      : [categories];

    rows.forEach((rowCategories, rowIndex) => {
      const items = rowCategories.map((category, index) => {
        const maxItemWidth = rowCount === 2
          ? slotWidth
          : availableWidth - itemGap * (rowCategories.length - 1);
        const label = truncateLegendLabel(
          String(category),
          Math.max(0, maxItemWidth - swatchSize - textGap)
        );

        return {
          category,
          label,
          width: swatchSize + textGap + ctx.measureText(label).width
        };
      });
      const rowWidth = items.reduce((sum, item) => sum + item.width, 0)
        + itemGap * Math.max(0, items.length - 1);
      let currentX = Math.max(12, (width - rowWidth) / 2);
      const rowY = y + rowIndex * 15;

      items.forEach(({ category, label, width: itemWidth }, index) => {
        ctx.fillStyle = palette[categories.indexOf(category) % palette.length];
        ctx.fillRect(currentX, rowY - swatchSize / 2, swatchSize, swatchSize);

        ctx.fillStyle = "#343b44";
        ctx.fillText(label, currentX + swatchSize + textGap, rowY);

        currentX += itemWidth;
        if (index < items.length - 1) currentX += itemGap;
      });
    });
  }

  function drawHistogram(w, h, fields) {
    const allValues = fields.flatMap(getValues);
    if (!allValues.length) return;

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const bins = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(allValues.length))));
    const countsByField = fields.map(field => {
      const counts = Array(bins).fill(0);

      getValues(field).forEach(value => {
        const index = Math.min(
          bins - 1,
          Math.floor(((value - min) / range) * bins)
        );
        counts[index]++;
      });

      return counts;
    });

    const highest = Math.max(1, ...countsByField.flat());
    const legendRows = legendUsesTwoRows(fields, w) ? 2 : 1;
    const plot = drawAxes(w, h, highest * 1.15, {
      left: 58,
      right: 24,
      top: legendRows === 2 ? 52 : 40,
      bottom: 65
    });
    const binW = plot.plotW / bins;

    // Overlay all histograms using transparency.
    fields.forEach((field, seriesIndex) => {
      countsByField[seriesIndex].forEach((count, binIndex) => {
        const barH = (count / plot.max) * plot.plotH;
        const x = plot.left + binIndex * binW + 1;
        const y = plot.top + plot.plotH - barH;

        ctx.globalAlpha = 0.38;
        ctx.fillStyle = palette[seriesIndex % palette.length];
        ctx.fillRect(x, y, Math.max(1, binW - 2), barH);
      });
    });

    ctx.globalAlpha = 1;

    ctx.fillStyle = "#343b44";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let i = 0; i <= bins; i++) {
      const value = min + (range * i) / bins;
      const x = plot.left + (plot.plotW * i) / bins;
      ctx.fillText(String(Number(value.toFixed(1))), x, plot.top + plot.plotH + 8);
    }

    drawLegend(fields, plot.left, 16);
  }

  function updateFieldChips() {
    let chips = chartWrap.querySelector(".graph-fields");

    if (!chips) {
      chips = document.createElement("div");
      chips.className = "graph-fields";
      chartWrap.appendChild(chips);
    }

    chips.replaceChildren();

    const assigned = [];

    if (categoryField) {
      assigned.push({
        field: categoryField,
        prefix: "Categories"
      });
    }

    seriesFields.forEach(field => {
      assigned.push({
        field,
        prefix: "Series"
      });
    });

    assigned.forEach(({ field, prefix }) => {
      const chip = document.createElement("span");
      chip.className = "graph-field-chip";

      chip.append(
        document.createTextNode(`${prefix}: ${labelFor(field)} `)
      );

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${labelFor(field)}`);

      remove.addEventListener("click", event => {
        event.stopPropagation();
        removeField(field);
      });

      chip.appendChild(remove);
      chips.appendChild(chip);
    });

  }

  function drawChart() {
    emptyState.hidden = true;
    canvas.hidden = false;
    chartWrap.classList.add("has-chart");

    const fields = getNumericFields();
    const categories = getCategories();
    const pieScroll = chartType === "pie" && fields.length > 2;
    chartWrap.classList.toggle("pie-scroll", pieScroll);
    chartWrap.classList.toggle("pie-chart", chartType === "pie");

    const { width, height: canvasHeight } = prepareCanvas(
      pieScroll ? 64 + Math.ceil(fields.length / 2) * 360 : null
    );
    positionAxisLabels(width, canvasHeight, fields.length > 0);
    clearChart(width, canvasHeight);
    updateFieldChips();


    if (!fields.length) {
      drawTemplate(width, canvasHeight);
      return;
    }

    switch (chartType) {
      case "bar":
        drawBarChart(width, canvasHeight, fields, categories);
        break;

      case "line":
      case "scatter":
        drawLineOrScatter(width, canvasHeight, fields, categories);
        break;

      case "pie":
        drawPieCharts(width, canvasHeight, fields, categories);
        break;

      case "histogram":
        drawHistogram(width, canvasHeight, fields);
        break;

      default:
        drawTemplate(width, canvasHeight);
    }
  }

  // Chart-type buttons.
  document.querySelectorAll("[data-chart-type]").forEach(button => {
    button.addEventListener("click", () => {
      const requestedType = button.dataset.chartType;
      chartType = chartTypes.includes(requestedType) ? requestedType : "bar";

      document.querySelectorAll("[data-chart-type]").forEach(option => {
        const active = option.dataset.chartType === chartType;
        option.classList.toggle("active", active);
        option.setAttribute("aria-pressed", String(active));
      });

      drawChart();
    });
  });

  // Reset graph.
  const resetButton = document.getElementById("resetGraph");

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      categoryField = null;
      seriesFields = [];
      drawChart();
    });
  }

  // Worksheet navigation.
  document.querySelectorAll("[data-jump]").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.jump);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });

  // Initialize the selected chart button and render its template.
  document.querySelectorAll("[data-chart-type]").forEach(button => {
    const active = button.dataset.chartType === chartType;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  drawChart();

  let resizeFrame = null;

  window.addEventListener("resize", () => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      drawChart();
    });
  });
})();
