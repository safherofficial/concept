const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAN_LABELS = Object.freeze({ starter: "Starter — 49 €/mese", business: "Business — 119 €/mese", pro: "Pro — 249 €/mese", custom: "Progetto su misura / da definire" });
const SITE_TYPES = new Set(["Landing page", "Sito aziendale", "Blog / magazine", "Portfolio / personal brand", "Startup / SaaS / Web3", "E-commerce", "Altro / da definire"]);
function send(res, status, body) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); }
function clean(value, max = 500) { return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }
function sameOrigin(req, siteUrl) { const origin = req.headers.origin; if (!origin) return true; try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; } }
module.exports = async function contact(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Metodo non consentito." }); }
  const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
  const apiKey = process.env.RESEND_API_KEY, to = process.env.SALES_EMAIL, from = process.env.MAIL_FROM;
  if (!siteUrl || !/^https:\/\//i.test(siteUrl) || !apiKey || !to || !from || !EMAIL_RE.test(to) || process.env.PRIVACY_NOTICE_READY !== "true") return send(res, 503, { error: "Invio richieste non configurato: verificare dominio, casella di vendita e servizio e-mail." });
  if (!sameOrigin(req, siteUrl)) return send(res, 403, { error: "Origine della richiesta non valida." });
  let input = req.body;
  if (typeof input === "string") { try { input = JSON.parse(input); } catch { return send(res, 400, { error: "Richiesta non valida." }); } }
  if (!input || typeof input !== "object" || Array.isArray(input)) return send(res, 400, { error: "Richiesta non valida." });
  const name = clean(input.name, 100), email = clean(input.email, 254).toLowerCase(), planId = clean(input.plan, 20), siteType = clean(input.siteType, 80), details = clean(input.details, 1800), website = clean(input.website, 200);
  if (website) return send(res, 200, { success: true, message: "Richiesta ricevuta." });
  if (name.length < 2 || !EMAIL_RE.test(email) || !Object.prototype.hasOwnProperty.call(PLAN_LABELS, planId) || !SITE_TYPES.has(siteType) || input.privacyAcknowledged !== true) return send(res, 400, { error: "Controlla nome, e-mail, tipologia, piano e informativa privacy." });
  const message = ["Nuova richiesta CONCEPT", "", `Nome: ${name}`, `E-mail: ${email}`, `Piano: ${PLAN_LABELS[planId]}`, `Tipologia: ${siteType}`, "", "Descrizione del progetto:", details || "Non specificata", "", `Ricevuta dal sito ${siteUrl}`].join("\n");
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], reply_to: email, subject: `Nuova richiesta CONCEPT — ${name} / ${PLAN_LABELS[planId]}`, text: message }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { console.error("Resend inquiry failed", { status: response.status, name: result?.name }); return send(res, 502, { error: "Non è stato possibile inviare la richiesta. Nessun dato è stato registrato." }); }
    return send(res, 200, { success: true, message: "Richiesta inviata. Grazie: ti ricontatteremo usando l'e-mail indicata." });
  } catch (error) { console.error("Inquiry email network failure", error?.message || "unknown error"); return send(res, 502, { error: "Il servizio e-mail non risponde. Nessun dato è stato registrato." }); }
};
