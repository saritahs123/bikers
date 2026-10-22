const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      getFiles(fullPath, files);
    } else if (item.name === 'route.ts' || item.name === 'route.js') {
      files.push(fullPath);
    }
  }
  return files;
}

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const routes = getFiles(apiDir);

console.log(`Found ${routes.length} route files under src/app/api`);

const auditResults = [];

routes.forEach(filePath => {
  const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  // Check methods
  const methods = [];
  ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach(m => {
    const regex = new RegExp(`export\\s+async\\s+function\\s+${m}\\b`);
    if (regex.test(content)) methods.push(m);
  });

  // Check auth & permissions
  const hasWorkshopSession = content.includes('getWorkshopSession');
  const hasAuthHelper = content.includes('requireAuth') || content.includes('verifyAuth') || content.includes('auth');
  const hasScreenPerms = content.includes('getScreenPermissions');
  const hasModulePerms = content.includes('getModulePermissions');
  const hasSuperAdmin = content.includes('isSuperAdmin');
  const hasPermCheck = hasScreenPerms || hasModulePerms || content.includes('puede_') || content.includes('checkPermission');

  auditResults.push({
    file: relPath,
    methods,
    hasWorkshopSession,
    hasAuthHelper,
    hasPermCheck,
    hasScreenPerms,
    hasModulePerms,
    hasSuperAdmin
  });
});

console.log("\n=== ENDPOINTS WITHOUT ANY PERMISSION CHECK (ONLY SESSION OR UNPROTECTED) ===");
const unprotectedOrSessionOnly = auditResults.filter(r => !r.hasPermCheck && r.methods.length > 0);
unprotectedOrSessionOnly.forEach(r => {
  console.log(`- [${r.methods.join(', ')}] ${r.file} (Session: ${r.hasWorkshopSession})`);
});

console.log(`\nTotal routes: ${auditResults.length}`);
console.log(`Routes with permission check: ${auditResults.filter(r => r.hasPermCheck).length}`);
console.log(`Routes without permission check: ${unprotectedOrSessionOnly.length}`);
