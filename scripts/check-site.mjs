import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = [
  'index.html', 'styles.css', 'app.js', 'site-config.js', 'success.html', 'success.js',
  'privacy.html', 'terms.html', '404.html', 'site.webmanifest', 'robots.txt', 'vercel.json',
  'api/create-checkout-session.js', 'api/contact.js', 'api/checkout-session.js', 'assets/favicon.svg', '.env.example', '.github/workflows/ci.yml'
];
const failures = [];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`File mancante: ${relative}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'site-config.js'), 'utf8');
const checkoutApi = fs.readFileSync(path.join(root, 'api/create-checkout-session.js'), 'utf8');
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
for (const match of html.matchAll(/href=["']#([^"']+)["']/g)) {
  const target = match[1];
  if (target && !ids.has(target) && target !== 'top') failures.push(`Anchor interno senza target: #${target}`);
}
const duplicateIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]).filter((id, index, all) => all.indexOf(id) !== index);
for (const id of new Set(duplicateIds)) failures.push(`ID HTML duplicato: ${id}`);
for (const expected of ['starter', 'business', 'pro']) {
  if (!html.includes(`data-select-plan="${expected}"`)) failures.push(`CTA piano mancante: ${expected}`);
  if (!app.includes(expected)) failures.push(`Gestione piano mancante in JavaScript: ${expected}`);
}
for (const [plan, price] of [['starter', 49], ['business', 119], ['pro', 249]]) {
  if (!config.includes(`${plan}: { name: "${plan[0].toUpperCase()}${plan.slice(1)}", price: ${price} }`)) failures.push(`Prezzo incoerente nella configurazione pubblica: ${plan}`);
  if (!checkoutApi.includes(`${plan}: { name: "CONCEPT ${plan[0].toUpperCase()}${plan.slice(1)}", amount: ${price * 100},`)) failures.push(`Prezzo server-side incoerente: ${plan}`);
}
for (const expected of ['traditional-cost', 'traditional-maintenance', 'calculator-plan', 'calculator-period', 'savings-value']) {
  if (!ids.has(expected)) failures.push(`Controllo calcolatore mancante: ${expected}`);
}
for (const asset of ['/styles.css', '/app.js', '/site-config.js', '/assets/favicon.svg', '/privacy.html', '/terms.html']) {
  if (!html.includes(`href="${asset}"`) && !html.includes(`src="${asset}"`)) failures.push(`Riferimento asset atteso non trovato: ${asset}`);
}
if (!css.includes('@media (max-width:520px)')) failures.push('Stili mobile stretti mancanti.');
if (!css.includes('prefers-reduced-motion')) failures.push('Manca il supporto a prefers-reduced-motion.');
if (!html.includes('aria-live="polite"')) failures.push('Feedback accessibile del form mancante.');
if (!html.includes('calcolatore')) failures.push('Contenuto relativo al calcolatore non trovato.');
try {
  JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest'), 'utf8'));
  JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
} catch (error) {
  failures.push(`JSON non valido: ${error.message}`);
}
if (failures.length) {
  console.error('CHECK SITE: FAIL');
  console.error(failures.map(f => `- ${f}`).join('\n'));
  process.exit(1);
}
console.log(`CHECK SITE: PASS — ${required.length} file essenziali presenti; ${ids.size} ID HTML unici; anchor interni e configurazioni JSON valide.`);
