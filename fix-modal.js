const fs = require('fs');
const path = 'c:/ProyectoE/bikers/src/app/(dashboard)/settings/security/components/RolesSecurityView.jsx';
let code = fs.readFileSync(path, 'utf8');

// The issue is that Tailwind v4 might not be respecting `max-w-sm` correctly, causing the modal to collapse to 0 width.
// We will replace `w-full max-w-sm` with a fixed width `w-[400px]` to guarantee it renders correctly.
// We will also remove the `border border-slate-200 dark:border-slate-800` which was causing the white vertical line when collapsed.
code = code.replace(/w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800/g, 'w-[400px] overflow-hidden');
code = code.replace(/w-full max-w-sm overflow-hidden p-8 text-center border border-slate-100/g, 'w-[400px] overflow-hidden p-8 text-center');

fs.writeFileSync(path, code);
console.log('Successfully fixed modal widths!');
