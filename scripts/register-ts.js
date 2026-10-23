const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// Allow require without .ts extension:
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  try {
    return origResolve.call(this, request, parent, isMain, options);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      try {
        return origResolve.call(this, request + '.ts', parent, isMain, options);
      } catch {}
      try {
        return origResolve.call(this, request + '.tsx', parent, isMain, options);
      } catch {}
    }
    throw err;
  }
};

require.extensions['.ts'] = function(module, filename) {
  let content = fs.readFileSync(filename, 'utf8');
  // Handle @/ imports to point to absolute src path
  const srcPath = path.resolve(__dirname, '..', 'src').replace(/\\/g, '/');
  content = content.replace(/from\s+["']@\/([^"']+)["']/g, (m, p1) => `from "${srcPath}/${p1}"`);
  content = content.replace(/require\(["']@\/([^"']+)["']\)/g, (m, p1) => `require("${srcPath}/${p1}")`);
  content = content.replace(/import\s+["']next\/headers["']/g, 'const { cookies } = { cookies: async () => ({ get: () => undefined }) }');

  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  });
  module._compile(compiled.outputText, filename);
};
