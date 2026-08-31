import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const root = process.cwd();
const execute = promisify(execFile);
const allowedEnvironmentFiles = new Set(['.env.example', '.env.server.example']);
const inspectedExtensions = new Set(['.html', '.js', '.json', '.md', '.ps1', '.sql', '.svg', '.yml', '.yaml']);
const findings = [];

const patterns = [
  ['clave privada de Supabase', /sb_secret_[A-Za-z0-9_-]{12,}/g],
  ['token de GitHub', /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/g],
  ['clave privada PEM', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['clave de acceso AWS', /AKIA[0-9A-Z]{16}/g],
];

async function inspectFiles() {
  const { stdout } = await execute('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root });
  for (const relative of stdout.split(/\r?\n/).filter(Boolean)) {
    const name = path.basename(relative);
    if (name.startsWith('.env') && !allowedEnvironmentFiles.has(name)) {
      findings.push(`${relative}: archivo de entorno local no publicable`);
      continue;
    }
    if (!inspectedExtensions.has(path.extname(name).toLowerCase())) continue;
    const content = await readFile(path.join(root, relative), 'utf8');
    for (const [label, pattern] of patterns) if (pattern.test(content)) findings.push(`${relative}: posible ${label}`);
    for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      try {
        const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
        if (payload.role === 'service_role') findings.push(`${relative}: JWT service_role`);
      } catch { /* An arbitrary JWT-looking test value is not treated as a secret without a decodable payload. */ }
    }
  }
}

await inspectFiles();
if (findings.length) {
  console.error('Publicación bloqueada:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log('Publicación segura: no se detectaron archivos de entorno ni patrones de claves privadas.');
}
