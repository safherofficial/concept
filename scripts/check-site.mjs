import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = [
  'index.html', 'styles.css', 'app.js', 'i18n.js', 'site-config.js', 'success.html', 'success.js',
  'privacy.html', 'terms.html', '404.html', 'site.webmanifest', 'robots.txt', 'vercel.json',
  'api/create-checkout-session.js', 'api/contact.js', 'api/checkout-session.js', 'api/health.js', 'assets/favicon.svg', '.env.example', '.github/workflows/ci.yml'
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
const i18n = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');
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
  const exactReference = html.includes(`href="${asset}"`) || html.includes(`src="${asset}"`);
  const versionedReference = html.includes(`href="${asset}?v=`) || html.includes(`src="${asset}?v=`);
  if (!exactReference && !versionedReference) failures.push(`Riferimento asset atteso non trovato: ${asset}`);
}
if (!html.includes('/app.js?v=20261012-4') || !html.includes('/i18n.js?v=20261012-4') || !html.includes('/site-config.js?v=20261012-4')) failures.push('Gli script principali devono usare la versione cache-busted corrente.');
if (app.includes('downloadProjectBrief') || app.includes('navigator.onLine')) failures.push('Il modulo non deve scaricare un brief di fallback né dipendere dallo stato offline del browser.');
if (!app.includes('20261012-4')) failures.push('Versione interfaccia checkout non aggiornata.');
if (!css.includes('@media (max-width:520px)')) failures.push('Stili mobile stretti mancanti.');
if (!css.includes('prefers-reduced-motion')) failures.push('Manca il supporto a prefers-reduced-motion.');
if (!html.includes('aria-live="polite"')) failures.push('Feedback accessibile del form mancante.');
if (!html.includes('calcolatore')) failures.push('Contenuto relativo al calcolatore non trovato.');

const sectionTags = [...html.matchAll(/<section\b[^>]*>/g)].map(match => match[0]);
const sectionOrder = sectionTags.map(tag => tag.match(/\bid=["']([^"']+)["']/)?.[1]).filter(Boolean);
const requiredDecisionOrder = ['pricing', 'risparmio', 'servizi', 'come-funziona', 'faq'];
if (sectionTags.length !== 7) failures.push(`Il percorso UX deve mantenere 7 sezioni principali, trovate: ${sectionTags.length}.`);
if (JSON.stringify(sectionOrder) !== JSON.stringify(requiredDecisionOrder)) failures.push(`Ordine delle sezioni non conforme al percorso decisionale: ${sectionOrder.join(' → ')}.`);
for (const obsolete of ['id="perche-concept"', 'id="standard"', 'class="fit-section"', 'class="final-cta-section"']) {
  if (html.includes(obsolete)) failures.push(`Sezione ripetitiva da rimuovere ancora presente: ${obsolete}.`);
}
if (!html.includes('class="faq-choose-card"') || !css.includes('.faq-choose-card{')) failures.push('CTA di supporto alla scelta del piano mancante.');
if (!html.includes('Senza maxi anticipo.') || !html.includes('49 €/mese')) failures.push('La promessa principale e il prezzo di partenza devono essere visibili subito.');
if (!i18n.includes('Continua al checkout') || !app.includes('tr("Continua al checkout")')) failures.push('Il pulsante del modulo deve descrivere il vero passo successivo: checkout Stripe.');
if (!css.includes('.mobile-nav{position:absolute;top:100%') || !css.includes('.mobile-nav[hidden]{display:none!important}')) failures.push('Il menu mobile deve aprirsi come dropdown e restare nascosto alla chiusura.');

if (!css.includes('.mobile-nav[hidden]{display:none!important}')) failures.push('La navigazione mobile deve rispettare l\'attributo hidden per non coprire la homepage.');
if (!i18n.includes('data-set-language') || !i18n.includes('concept-language') || !i18n.includes('document.documentElement.lang = next')) failures.push('Selettore IT/EN o persistenza della lingua mancanti.');
for (const page of ['privacy.html', 'terms.html', 'success.html', '404.html']) {
  if (!/src="\/i18n\.js(?:\?[^"]*)?"/.test(fs.readFileSync(path.join(root, page), 'utf8'))) failures.push(`Selettore lingua non caricato su ${page}.`);
}
if (!/src="\/i18n\.js(?:\?[^"]*)?"/.test(html)) failures.push('Il selettore IT/EN non è caricato sulla homepage.');
if (!i18n.includes('Find your plan') || !i18n.includes('CONCEPT Business') || !i18n.includes('Data controller')) failures.push('Traduzioni inglesi fondamentali mancanti.');
for (const value of ['Landing page', 'Sito aziendale', 'Blog / magazine', 'Portfolio / personal brand', 'Startup / SaaS / Web3', 'E-commerce', 'Altro / da definire']) {
  if (!html.includes(`<option value="${value}">`)) failures.push(`Il valore API del tipo sito deve restare stabile anche traducendo la label: ${value}`);
}

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
