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

const actionCounts = {
  puede_ver: 0,
  puede_crear: 0,
  puede_editar: 0,
  puede_inactivar: 0,
  puede_exportar: 0,
  puede_importar: 0,
  puede_aprobar: 0,
  puede_asignar: 0,
  puede_mover: 0,
  puede_cerrar: 0,
  puede_reabrir: 0,
  puede_eliminar: 0
};

const routePrivileges = [];

routes.forEach(filePath => {
  const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  const found = [];
  for (const [action, count] of Object.entries(actionCounts)) {
    if (content.includes(action)) {
      found.push(action);
      actionCounts[action]++;
    }
  }

  if (found.length > 0) {
    routePrivileges.push({ file: relPath, found });
  }
});

console.log("=== PRIVILEGE CHECKS OCCURRENCES IN API ===");
console.table(actionCounts);

console.log("\nRoutes checking specific operations beyond ver/crear/editar/eliminar:");
const specialized = routePrivileges.filter(r => 
  r.found.some(f => !['puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar'].includes(f))
);
specialized.forEach(s => console.log(`- ${s.file}: ${s.found.join(', ')}`));
