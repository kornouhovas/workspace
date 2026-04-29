import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { createRevealResponse } from "./src/localOpen.js";
import {
  createFileResponse,
  createListEntriesResponse,
  createPropertiesResponse,
  createRootResponse,
  createScanResponse,
  createSelectRootResponse,
  defaultWorkspaceSettingsPath,
  readWorkspaceSettings,
} from "./src/workspaceBackend.js";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApiRequest(request, response, url);
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, pathname));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
});

async function handleApiRequest(request, response, url) {
  try {
    if (url.pathname === "/api/root" && request.method === "GET") {
      sendApiResponse(response, await createRootResponse());
      return;
    }

    if (url.pathname === "/api/select-root" && request.method === "POST") {
      sendApiResponse(response, await createSelectRootResponse());
      return;
    }

    if (url.pathname === "/api/scan" && request.method === "POST") {
      const body = await readJsonBody(request);
      const workspaceRoot = await getStoredWorkspaceRoot();
      sendApiResponse(response, await createScanResponse({ root: workspaceRoot, rules: body.rules }));
      return;
    }

    if (url.pathname === "/api/list-entries" && request.method === "POST") {
      const body = await readJsonBody(request);
      const workspaceRoot = await getStoredWorkspaceRoot();
      sendApiResponse(response, await createListEntriesResponse({ root: workspaceRoot, body }));
      return;
    }

    if (url.pathname === "/api/properties" && request.method === "POST") {
      const body = await readJsonBody(request);
      const workspaceRoot = await getStoredWorkspaceRoot();
      sendApiResponse(response, await createPropertiesResponse({ root: workspaceRoot, body }));
      return;
    }

    if (url.pathname === "/api/file" && request.method === "GET") {
      const workspaceRoot = await getStoredWorkspaceRoot();
      sendFileResponse(response, await createFileResponse({ root: workspaceRoot, path: url.searchParams.get("path") }));
      return;
    }

    if (url.pathname === "/api/reveal" && request.method === "POST") {
      const body = await readJsonBody(request);
      const workspaceRoot = await getStoredWorkspaceRoot();
      sendApiResponse(response, await createRevealResponse({ body, root: workspaceRoot }));
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 400, { error: "Invalid request body." });
  }
}

async function getStoredWorkspaceRoot() {
  const settings = await readWorkspaceSettings(defaultWorkspaceSettingsPath);
  return settings.rootPath || null;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendApiResponse(response, result) {
  sendJson(response, result.status, result.payload);
}

function sendFileResponse(response, result) {
  if (result.stream) {
    response.writeHead(result.status, {
      "content-disposition": "inline",
      "content-type": result.contentType,
    });
    result.stream.pipe(response);
    return;
  }

  sendApiResponse(response, result);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Folder Kanban running at http://127.0.0.1:${port}`);
});
