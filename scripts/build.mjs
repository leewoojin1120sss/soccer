import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const name of ["index.html", "styles.css", "src", "data", "favicon.svg"])
  await cp(name, `dist/${name}`, { recursive: true });
console.log(
  "Static build ready in dist/ — no network or runtime dependencies.",
);
