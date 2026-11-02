import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const args = process.argv.slice(2),
  i = args.indexOf("--port"),
  port = Number(i >= 0 ? args[i + 1] : (process.env.PORT ?? 3000));
const root = resolve(".");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (name === "/") name = "/index.html";
    const path = resolve(root, "." + name);
    if (!path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!(await stat(path)).isFile()) throw Error();
    const b = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Touchline ready on port ${port}`),
);
