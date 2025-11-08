import fs from "fs";
import path from "path";
import Module from "module";

const tsModule = await import("typescript");
const ts =
  typeof tsModule.default === "undefined" ? tsModule : tsModule.default;

const entryPath = path.resolve(process.cwd(), "scripts/checkEnv.ts");

try {
  const source = fs.readFileSync(entryPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: entryPath,
  });

  const checkModule = new Module(entryPath);
  checkModule.filename = entryPath;
  checkModule.paths = Module._nodeModulePaths(path.dirname(entryPath));
  checkModule._compile(transpiled.outputText, entryPath);
} catch (error) {
  console.error("[env:check] Unable to execute scripts/checkEnv.ts");
  console.error(error);
  process.exitCode = 0;
}
