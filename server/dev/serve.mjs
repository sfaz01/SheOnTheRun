/* Local dev server for the website + admin API:   node server/dev/serve.mjs [port]
   Needs PHP 8.1+ on the PATH. Uses a throw-away SQLite database in server/storage/dev.sqlite. */
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const port = process.argv[2] || "8092";

const finder = spawnSync(process.platform === "win32" ? "where" : "which", ["php"], { encoding: "utf8" });
let phpPath = finder.stdout.split(/\r?\n/)[0].trim();
if (!phpPath && process.platform === "win32" && process.env.LOCALAPPDATA) {
  // winget installs PHP here; a freshly started app may not have the updated PATH yet.
  const pkgs = join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
  const hit = existsSync(pkgs) && readdirSync(pkgs).find((d) => d.startsWith("PHP.PHP"));
  if (hit) phpPath = join(pkgs, hit, "php.exe");
}
if (!phpPath) {
  console.error("PHP was not found on the PATH. Install PHP 8.1+ (Windows: winget install PHP.PHP.8.3).");
  process.exit(1);
}

// A winget/zip PHP ships without a php.ini, so switch on what we need.
const ini = ["display_errors=1", "error_reporting=E_ALL", "date.timezone=UTC", "upload_max_filesize=16M", "post_max_size=20M"];
if (process.platform === "win32") {
  ini.push(`extension_dir="${join(dirname(phpPath), "ext")}"`);
  for (const e of ["mbstring", "openssl", "curl", "fileinfo", "gd", "exif", "pdo_sqlite", "sqlite3", "pdo_mysql", "zip"]) ini.push(`extension=${e}`);
}
const iniPath = join(tmpdir(), "sotr-dev-php.ini");
writeFileSync(iniPath, ini.join("\n") + "\n");
mkdirSync(join(root, "server", "storage", "dev-site", "data"), { recursive: true });

const child = spawn(
  phpPath,
  ["-c", iniPath, "-S", `localhost:${port}`, "-t", root, join(root, "server", "dev", "router.php")],
  { stdio: "inherit", env: { ...process.env, SOTR_CONFIG: join(root, "server", "dev", "config.dev.php") } }
);
console.log(`Site + admin on http://localhost:${port}   (admin: /admin/, setup token: dev-setup-token)`);
child.on("exit", (code) => process.exit(code ?? 0));
