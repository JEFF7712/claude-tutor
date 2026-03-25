#!/usr/bin/env node
// tutor-server.js — file-watching HTTP server for the visual teaching companion
// Zero npm dependencies: uses only Node.js built-ins.

const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------
const screenDir = process.argv[2];
if (!screenDir) {
  console.error("Usage: tutor-server.js <screen_dir> [host] [port]");
  process.exit(1);
}
const host = process.argv[3] || "127.0.0.1";
const port = parseInt(process.argv[4] || "0", 10);

const resolvedScreenDir = path.resolve(screenDir);
if (!fs.existsSync(resolvedScreenDir)) {
  fs.mkdirSync(resolvedScreenDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Load frame template and helper script (relative to this script's location)
// ---------------------------------------------------------------------------
const scriptRoot = __dirname;

function loadAsset(name) {
  const p = path.join(scriptRoot, name);
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

let frameTemplate = loadAsset("tutor-frame.html");
let helperScript = loadAsset("tutor-helper.js");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let currentFile = null; // path of the newest .html file being served
let lastActivity = Date.now();
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const serverInfoPath = path.join(resolvedScreenDir, ".server-info");
const serverStoppedPath = path.join(resolvedScreenDir, ".server-stopped");
const eventsPath = path.join(resolvedScreenDir, ".events");

// ---------------------------------------------------------------------------
// File watching — poll for newest .html by mtime every 500ms
// ---------------------------------------------------------------------------
function findNewestHtml() {
  let newest = null;
  let newestMtime = 0;
  let newestBirthtime = 0;
  try {
    const entries = fs.readdirSync(resolvedScreenDir);
    for (const entry of entries) {
      if (!entry.endsWith(".html") || entry.startsWith(".")) continue;
      const full = path.join(resolvedScreenDir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
          newestBirthtime = stat.birthtimeMs || 0;
          newest = full;
        } else if (stat.mtimeMs === newestMtime) {
          const birth = stat.birthtimeMs || 0;
          if (birth > newestBirthtime || (birth === newestBirthtime && entry > path.basename(newest))) {
            newestBirthtime = birth;
            newest = full;
          }
        }
      } catch {
        // file may have been removed between readdir and stat
      }
    }
  } catch {
    // screen dir may not be readable yet
  }
  return newest;
}

const pollTimer = setInterval(() => {
  const newest = findNewestHtml();
  if (newest && newest !== currentFile) {
    currentFile = newest;
    // Clear events log when a new screen file is detected
    try {
      fs.writeFileSync(eventsPath, "");
    } catch {
      // ignore
    }
  }
  // Inactivity shutdown
  if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
    shutdown("inactivity");
  }
}, 500);

// ---------------------------------------------------------------------------
// Waiting page (shown when no HTML files exist yet)
// ---------------------------------------------------------------------------
const WAITING_PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Tutor — Waiting</title>
<meta http-equiv="refresh" content="2">
<style>
  body { font-family: system-ui, sans-serif; display: flex;
         align-items: center; justify-content: center;
         height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0; }
  .msg { text-align: center; opacity: 0.7; }
</style></head>
<body><div class="msg"><h2>Waiting for content&hellip;</h2>
<p>The tutor will display lessons here automatically.</p></div></body></html>`;

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------
function getHelperJs() {
  // Re-read helper at serve time so live edits are picked up during dev
  return loadAsset("tutor-helper.js") || helperScript || "";
}

function buildHelperTag() {
  const js = getHelperJs();
  if (!js) return "";
  return `<script>\n${js}\n</script>`;
}

function renderContent() {
  if (!currentFile) return WAITING_PAGE;

  let raw;
  try {
    raw = fs.readFileSync(currentFile, "utf-8");
  } catch {
    return WAITING_PAGE;
  }

  const trimmed = raw.trimStart();
  const isFullDoc =
    trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");

  if (isFullDoc) {
    // Inject helper script before </body>
    const tag = buildHelperTag();
    if (tag && raw.includes("</body>")) {
      return raw.replace("</body>", `${tag}\n</body>`);
    }
    return raw;
  }

  // Wrap in frame template
  const tpl = loadAsset("tutor-frame.html") || frameTemplate;
  if (tpl) {
    return tpl
      .replace("{{CONTENT}}", raw)
      .replace("{{HELPER_SCRIPT}}", getHelperJs());
  }
  // Fallback: minimal wrapper
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Tutor</title></head><body>${raw}${buildHelperTag()}</body></html>`;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  lastActivity = Date.now();

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // POST /events — record interaction events
  if (req.method === "POST" && req.url === "/events") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const line = JSON.stringify(parsed) + "\n";
        fs.appendFileSync(eventsPath, line);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end('{"ok":true}');
      } catch (err) {
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET * — serve current screen content
  const html = renderContent();
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
server.listen(port, host, () => {
  const addr = server.address();
  const info = {
    type: "tutor-server",
    port: addr.port,
    url: `http://${addr.address}:${addr.port}`,
    screen_dir: resolvedScreenDir,
  };

  fs.writeFileSync(serverInfoPath, JSON.stringify(info, null, 2) + "\n");
  // Remove stale stopped marker
  try {
    fs.unlinkSync(serverStoppedPath);
  } catch {
    // ignore
  }

  console.log(JSON.stringify(info));
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(reason) {
  clearInterval(pollTimer);
  try {
    fs.writeFileSync(
      serverStoppedPath,
      JSON.stringify({ reason, timestamp: new Date().toISOString() }) + "\n"
    );
  } catch {
    // ignore
  }
  try {
    fs.unlinkSync(serverInfoPath);
  } catch {
    // ignore
  }
  server.close(() => process.exit(0));
  // Force exit after 2 s if server.close hangs
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
