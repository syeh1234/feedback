const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const databasePath = path.resolve(process.env.CLASSROOM_DATABASE_PATH || path.join(root, "classroom-data.json"));
const csvPath = path.resolve(process.env.CLASSROOM_CSV_PATH || path.join(root, "peer-review-submissions.csv"));
const columns = [
  "classroomId",
  "submittedAt",
  "sessionId",
  "claim",
  "chartType",
  "graphTitle",
  "categories",
  "series",
  "xAxisLabel",
  "yAxisLabel",
  "additionalQuestions",
  "graphData"
];

let database = { classrooms: {} };
let writeQueue = Promise.resolve();

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

function makeCsv() {
  const rows = [columns.map(csvEscape).join(",")];

  for (const [classroomId, classroom] of Object.entries(database.classrooms)) {
    for (const submission of Object.values(classroom.submissions)) {
      rows.push(columns.map(column => csvEscape(
          column === "classroomId"
            ? classroomId
            : column === "graphData"
              ? JSON.stringify(submission.graphData)
              : submission[column]
      )).join(","));
    }
  }

  return `${rows.join("\r\n")}\r\n`;
}

function persistDatabase() {
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    const serialized = JSON.stringify(database, null, 2);
    const temporaryPath = `${databasePath}.tmp`;
    await fs.writeFile(temporaryPath, serialized, "utf8");
    await fs.rename(temporaryPath, databasePath);
    await fs.writeFile(csvPath, makeCsv(), "utf8");
  });
  return writeQueue;
}

async function loadDatabase() {
  try {
    const content = await fs.readFile(databasePath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && parsed.classrooms && typeof parsed.classrooms === "object") {
      database = parsed;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await persistDatabase();
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function validateClassroomId(value) {
  const classroomId = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(classroomId)) {
    throw Object.assign(new Error("Classroom ID must be 3 to 32 letters, numbers, hyphens, or underscores."), { status: 400 });
  }
  return classroomId;
}

function validateSessionId(value) {
  const sessionId = String(value || "").trim();
  if (!/^\d{1,20}$/.test(sessionId) || /^0+$/.test(sessionId)) {
    throw Object.assign(new Error("Session ID must be a positive whole number."), { status: 400 });
  }
  return sessionId;
}

function generateSessionId() {
  const assignedIds = new Set(
    Object.values(database.classrooms).flatMap(classroom => Object.keys(classroom.participants))
  );

  let sessionId;
  do {
    sessionId = String(crypto.randomInt(100_000_000_000, 1_000_000_000_000));
  } while (assignedIds.has(sessionId));

  return sessionId;
}

function requiredText(value, maxLength, fieldName) {
  const text = String(value || "").trim();
  if (text.length > maxLength) {
    throw Object.assign(new Error(`${fieldName} must be ${maxLength} characters or fewer.`), { status: 400 });
  }
  return text;
}

function getClassroom(classroomId) {
  return database.classrooms[classroomId];
}

function requireParticipant(classroom, sessionId, accessToken) {
  const participant = classroom?.participants[sessionId];
  if (!participant || !accessToken || participant.accessToken !== accessToken) {
    throw Object.assign(new Error("Join this classroom before continuing."), { status: 403 });
  }
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = crypto.randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function assignReviews(classroom) {
  const submitterIds = Object.keys(classroom.submissions);
  if (submitterIds.length < 2) {
    throw Object.assign(new Error("At least two students must submit before the classroom can close."), { status: 409 });
  }

  const orderedIds = shuffle(submitterIds);
  classroom.assignments = Object.fromEntries(orderedIds.map((sessionId, index) => [
    sessionId,
    orderedIds[(index + 1) % orderedIds.length]
  ]));
  classroom.status = "closed";
  classroom.closedAt = new Date().toISOString();
}

function classroomStatus(classroom, sessionId) {
  const assignedId = classroom.assignments?.[sessionId];
  return {
    classroomId: classroom.id,
    sessionId,
    status: classroom.status,
    participantCount: Object.keys(classroom.participants).length,
    submissionCount: Object.keys(classroom.submissions).length,
    submitted: Boolean(classroom.submissions[sessionId]),
    closedAt: classroom.closedAt || null,
    assignedSubmission: assignedId ? classroom.submissions[assignedId] : null
  };
}

async function handleApi(request, response, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && parts.length === 2 && parts[0] === "api" && parts[1] === "health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (parts[0] !== "api" || parts[1] !== "classrooms" || !parts[2]) {
    sendJson(response, 404, { error: "API route not found." });
    return;
  }

  const classroomId = validateClassroomId(decodeURIComponent(parts[2]));
  const action = parts[3];

  if (request.method === "POST" && action === "join") {
    const body = await readJson(request);
    let classroom = getClassroom(classroomId);

    if (!classroom) {
      classroom = {
        id: classroomId,
        createdAt: new Date().toISOString(),
        status: "open",
        participants: {},
        submissions: {},
        assignments: {}
      };
      database.classrooms[classroomId] = classroom;
    }

    let sessionId = null;
    let participant = null;

    if (body.accessToken) {
      const matchedParticipant = Object.entries(classroom.participants).find(
        ([, value]) => value.accessToken === body.accessToken
      );
      if (matchedParticipant) {
        [sessionId, participant] = matchedParticipant;
      }
    }

    if (classroom.status !== "open" && !participant) {
      sendJson(response, 409, { error: "This classroom is closed." });
      return;
    }

    if (!participant) {
      sessionId = generateSessionId();
      participant = {
        joinedAt: new Date().toISOString(),
        accessToken: crypto.randomBytes(32).toString("hex")
      };
      classroom.participants[sessionId] = participant;
    }

    await persistDatabase();
    sendJson(response, 200, {
      ...classroomStatus(classroom, sessionId),
      sessionId,
      accessToken: classroom.participants[sessionId].accessToken
    });
    return;
  }

  const classroom = getClassroom(classroomId);
  if (!classroom) {
    sendJson(response, 404, { error: "Classroom not found. Join to create it." });
    return;
  }

  if (request.method === "GET" && action === "status") {
    const sessionId = validateSessionId(url.searchParams.get("sessionId"));
    requireParticipant(classroom, sessionId, request.headers["x-classroom-token"]);
    sendJson(response, 200, classroomStatus(classroom, sessionId));
    return;
  }

  if (request.method === "POST" && action === "submissions") {
    const body = await readJson(request);
    const sessionId = validateSessionId(body.sessionId);
    requireParticipant(classroom, sessionId, body.accessToken);

    if (classroom.status !== "open") {
      sendJson(response, 409, { error: "This classroom is closed to submissions." });
      return;
    }
    if (classroom.submissions[sessionId]) {
      sendJson(response, 409, { error: "This session ID has already submitted." });
      return;
    }

    const source = body.submission || {};
    const submission = {
      submittedAt: new Date().toISOString(),
      sessionId,
      claim: requiredText(source.claim, 10000, "Claim"),
      chartType: requiredText(source.chartType, 40, "Graph type"),
      graphTitle: requiredText(source.graphTitle, 300, "Graph title"),
      categories: requiredText(source.categories, 1000, "Categories"),
      series: requiredText(source.series, 2000, "Series"),
      xAxisLabel: requiredText(source.xAxisLabel, 300, "X-axis label"),
      yAxisLabel: requiredText(source.yAxisLabel, 300, "Y-axis label"),
      additionalQuestions: requiredText(source.additionalQuestions, 10000, "Additional questions"),
      graphData: source.graphData && typeof source.graphData === "object" ? source.graphData : {}
    };

    classroom.submissions[sessionId] = submission;
    try {
      await persistDatabase();
    } catch (error) {
      delete classroom.submissions[sessionId];
      throw error;
    }

    sendJson(response, 201, classroomStatus(classroom, sessionId));
    return;
  }

  if (request.method === "POST" && action === "close") {
    const body = await readJson(request);
    const sessionId = validateSessionId(body.sessionId);
    requireParticipant(classroom, sessionId, body.accessToken);

    if (classroom.status === "open") assignReviews(classroom);
    await persistDatabase();
    sendJson(response, 200, classroomStatus(classroom, sessionId));
    return;
  }

  sendJson(response, 404, { error: "Classroom action not found." });
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

async function serveStatic(response, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const resolvedPath = path.resolve(root, `.${requestedPath}`);
  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if ([databasePath, csvPath].includes(resolvedPath) || resolvedPath.endsWith(".tmp")) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const content = await fs.readFile(resolvedPath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(resolvedPath)] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else {
      await serveStatic(response, url);
    }
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, error.status || 500, { error: error.message || "Server error." });
    } else {
      response.destroy(error);
    }
  }
});

loadDatabase().then(() => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`AP Statistics classroom server listening on http://localhost:${port}`);
  });
}).catch(error => {
  console.error("Could not load classroom database:", error);
  process.exitCode = 1;
});
