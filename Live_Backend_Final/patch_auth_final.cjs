const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

const oldSyntaxStart = content.indexOf(`if (user.password.startsWith('$2a// Change Password - Public (Requires Old Password)`);
if (oldSyntaxStart !== -1) {
    const endPart = content.substring(oldSyntaxStart + 43); // skip past the bad part
    content = content.substring(0, oldSyntaxStart) + `if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {` + endPart;
}

// Clean any module.exports = router; at the middle
content = content.replace(/module\.exports = router;\s*module\.exports = router;/g, 'module.exports = router;');

// ensure only one module.exports at the end
const parts = content.split('module.exports = router;');
if (parts.length > 2) {
    content = parts[0] + parts[1] + '\nmodule.exports = router;\n';
}

fs.writeFileSync(file, content);
