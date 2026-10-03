/* Finds PHP for the tests and, on Windows (where a zip/winget PHP has no php.ini),
   switches on the extensions the backend needs. Returns [phpPath, extraArgs]. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function findPhp() {
  const finder = spawnSync(process.platform === "win32" ? "where" : "which", ["php"], { encoding: "utf8" });
  let php = (finder.stdout || "").split(/\r?\n/)[0].trim();
  if (!php && process.platform === "win32" && process.env.LOCALAPPDATA) {
    const pkgs = join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
    const hit = existsSync(pkgs) && readdirSync(pkgs).find((d) => d.startsWith("PHP.PHP"));
    if (hit) php = join(pkgs, hit, "php.exe");
  }
  if (!php) throw new Error("PHP 8.1+ is needed to run these tests.");
  return php;
}

export function phpCommand(extraIni = []) {
  const php = findPhp();
  const ini = ["display_errors=1", "error_reporting=E_ALL", "date.timezone=UTC", ...extraIni];
  if (process.platform === "win32") {
    ini.push(`extension_dir="${join(dirname(php), "ext")}"`);
    for (const e of ["mbstring", "openssl", "fileinfo", "gd", "pdo_sqlite", "sqlite3"]) ini.push(`extension=${e}`);
  }
  const iniPath = join(mkdtempSync(join(tmpdir(), "sotr-ini-")), "php.ini");
  writeFileSync(iniPath, ini.join("\n") + "\n");
  return [php, ["-c", iniPath]];
}
