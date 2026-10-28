const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const files = {
  "/": { path: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { path: "index.html", type: "text/html; charset=utf-8" },
  "/products.html": { path: "products.html", type: "text/html; charset=utf-8" },
  "/client.js": {
    path: "client.js",
    type: "text/javascript; charset=utf-8",
  },
  "/products.js": {
    path: "products.js",
    type: "text/javascript; charset=utf-8",
  },
};

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  const file = files[new URL(request.url, "http://localhost").pathname];
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const filePath = path.join(__dirname, file.path);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      console.error(`Could not read ${file.path}:`, error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server error");
      return;
    }

    response.writeHead(200, {
      "Content-Type": file.type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
});

server.listen(PORT, () => {
  console.log(`Sari-Sari Store Debt List running at http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Could not start the server on port ${PORT}:`, error.message);
  process.exitCode = 1;
});
