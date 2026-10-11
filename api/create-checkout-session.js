const PLANS = Object.freeze({
  starter: { name: "CONCEPT Starter", amount: 4900, description: "Sito professionale fino a 1 pagina" },
  business: { name: "CONCEPT Business", amount: 11900, description: "Sito professionale fino a 8 pagine" },
  pro: { name: "CONCEPT Pro", amount: 24900, description: "Sito professionale fino a 20 pagine" }
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_TYPE_VALUES = new Set(["Landing page", "Sito aziendale", "Blog / magazine", "Portfolio / personal brand", "Startup / SaaS / Web3", "E-commerce", "Altro / da definire"]);
function send(res, status, body) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); }
function clean(value, max = 500) { return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }
function sameOrigin(req, siteUrl) { const origin = req.headers.origin; if (!origin) return true; try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; } }
module.exports = async function createCheckoutSession(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "Metodo non consentito." }); }
  const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, ""), stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!siteUrl || !/^https:\/\//i.test(siteUrl) || !stripeKey || process.env.STRIPE_AUTOMATIC_TAX !== "true" || process.env.LEGAL_TERMS_READY !== "true" || !process.env.TERMS_VERSION) return send(res, 503, { error: "Checkout non attivo: completare dominio, Stripe, imposte e revisione legale." });
  if (!sameOrigin(req, siteUrl)) return send(res, 403, { error: "Origine della richiesta non valida." });
  let input = req.body;
  if (typeof input === "string") { try { input = JSON.parse(input); } catch { return send(res, 400, { error: "Richiesta non valida." }); } }
  if (!input || typeof input !== "object" || Array.isArray(input)) return send(res, 400, { error: "Richiesta non valida." });
  const name = clean(input.name, 100), email = clean(input.email, 254).toLowerCase(), planId = clean(input.plan, 20), siteType = clean(input.siteType, 80), details = clean(input.details, 1800), website = clean(input.website, 200);
  if (website) return send(res, 200, { error: "Richiesta ricevuta." });
  if (name.length < 2 || !EMAIL_RE.test(email) || !Object.prototype.hasOwnProperty.call(PLANS, planId) || !SITE_TYPE_VALUES.has(siteType) || input.privacyAcknowledged !== true || input.termsAcknowledged !== true) return send(res, 400, { error: "Controlla nome, e-mail, tipologia, piano e consenso privacy." });
  const plan = PLANS[planId], form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("customer_email", email);
  form.set("billing_address_collection", "required");
  form.set("tax_id_collection[enabled]", "true");
  form.set("automatic_tax[enabled]", "true");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "eur");
  form.set("line_items[0][price_data][unit_amount]", String(plan.amount));
  form.set("line_items[0][price_data][recurring][interval]", "month");
  form.set("line_items[0][price_data][tax_behavior]", "exclusive");
  form.set("line_items[0][price_data][product_data][name]", plan.name);
  form.set("line_items[0][price_data][product_data][description]", plan.description);
  form.set("success_url", `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${siteUrl}/#pricing`);
  form.set("allow_promotion_codes", "false");
  form.set("metadata[plan]", planId);
  form.set("metadata[terms_acknowledged]", "yes");
  form.set("metadata[terms_version]", clean(process.env.TERMS_VERSION, 60));
  form.set("metadata[customer_name]", name);
  form.set("metadata[site_type]", siteType);
  form.set("metadata[project_brief]", details.slice(0, 450));
  form.set("subscription_data[metadata][plan]", planId);
  form.set("subscription_data[metadata][site_type]", siteType);
  form.set("subscription_data[metadata][customer_name]", name);
  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `concept-checkout-${crypto.randomUUID()}` }, body: form.toString() });
    const stripeResult = await stripeResponse.json();
    if (!stripeResponse.ok || !stripeResult.url || !/^https:\/\/checkout\.stripe\.com\//i.test(stripeResult.url)) {
      console.error("Stripe checkout creation failed", { status: stripeResponse.status, type: stripeResult?.error?.type, code: stripeResult?.error?.code });
      return send(res, 502, { error: "Non è stato possibile preparare il checkout. Nessun pagamento è stato avviato. Riprova o contattaci." });
    }
    return send(res, 200, { url: stripeResult.url, sessionId: stripeResult.id });
  } catch (error) { console.error("Stripe checkout network failure", error?.message || "unknown error"); return send(res, 502, { error: "Il servizio di pagamento non risponde. Nessun pagamento è stato avviato." }); }
};
