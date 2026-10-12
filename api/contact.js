const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAN_LABELS = Object.freeze({ starter: "Starter — 49 €/mese", business: "Business — 119 €/mese", pro: "Pro — 249 €/mese", custom: "Progetto su misura / da definire" });
const SITE_TYPES = new Set(["Landing page", "Sito aziendale", "Blog / magazine", "Portfolio / personal brand", "Startup / SaaS / Web3", "E-commerce", "Altro / da definire"]);
function send(res, status, body) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); }
function clean(value, max = 500) { return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }
function sameOrigin(req, siteUrl) {
  const rawOrigin = req.headers.origin;
  if (!rawOrigin) return true;
  try {
    const origin = new URL(rawOrigin);
    if (origin.protocol !== "https:" || origin.username || origin.password) return false;
    if (origin.origin === new URL(siteUrl).origin) return true;
    const requestHost = String(req.headers.host || "").trim().toLowerCase();
    return Boolean(requestHost && origin.host.toLowerCase() === requestHost);
  } catch { return false; }
};
