const PLANS = Object.freeze({
  starter: { name: "CONCEPT Starter", amount: 4900, priceEnv: "STRIPE_PRICE_STARTER" },
  business: { name: "CONCEPT Business", amount: 11900, priceEnv: "STRIPE_PRICE_BUSINESS" },
  pro: { name: "CONCEPT Pro", amount: 24900, priceEnv: "STRIPE_PRICE_PRO" }
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_TYPE_VALUES = new Set(["Landing page", "Sito aziendale", "Blog / magazine", "Portfolio / personal brand", "Startup / SaaS / Web3", "E-commerce", "Altro / da definire"]);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
function clean(value, max = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function sameOrigin(req, siteUrl) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(siteUrl).origin; } catch { return false; }
}
function isExpectedPrice(price, plan, expectedLiveMode) {
  return Boolean(
    price &&
    price.active === true &&
    price.currency === "eur" &&
    price.unit_amount === plan.amount &&
    price.type === "recurring" &&
    price.recurring?.interval === "month" &&
    (price.recurring?.interval_count ?? 1) === 1 &&
    price.livemode === expectedLiveMode &&
    price.product &&
    typeof price.product === "object" &&
    price.product.active === true &&
    price.product.name === plan.name
  );
}
module.exports = async function createCheckoutSession(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Metodo non consentito." });
  }
  const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!siteUrl || !/^https:\/\//i.test(siteUrl) || !stripeKey ||
      process.env.STRIPE_AUTOMATIC_TAX !== "true" ||
      process.env.LEGAL_TERMS_READY !== "true" || !process.env.TERMS_VERSION) {
    return send(res, 503, { error: "Checkout non attivo: completare dominio, Stripe, imposte e revisione legale." });
  }
  if (!sameOrigin(req, siteUrl)) return send(res, 403, { error: "Origine della richiesta non valida." });

  let input = req.body;
  if (typeof input === "string") {
    try { input = JSON.parse(input); } catch { return send(res, 400, { error: "Richiesta non valida." }); }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return send(res, 400, { error: "Richiesta non valida." });

  const name = clean(input.name, 100);
  const email = clean(input.email, 254).toLowerCase();
  const planId = clean(input.plan, 20);
  const siteType = clean(input.siteType, 80);
  const details = clean(input.details, 1800);
  const website = clean(input.website, 200);
  if (website) return send(res, 200, { error: "Richiesta ricevuta." });
  if (name.length < 2 || !EMAIL_RE.test(email) ||
      !Object.prototype.hasOwnProperty.call(PLANS, planId) ||
      !SITE_TYPE_VALUES.has(siteType) || input.privacyAcknowledged !== true ||
      input.termsAcknowledged !== true) {
    return send(res, 400, { error: "Controlla nome, e-mail, tipologia, piano e consenso privacy." });
  }

  const plan = PLANS[planId];
  const priceId = clean(process.env[plan.priceEnv], 100);
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) {
    return send(res, 503, { error: "Questo piano non è ancora configurato nel catalogo Stripe. Nessun pagamento è stato avviato." });
  }

  try {
    // Resolve and verify the catalog Price on every checkout: never trust a client-supplied price.
    const priceResponse = await fetch(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}?expand%5B%5D=product`,
      { method: "GET", headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const price = await priceResponse.json();
    if (!priceResponse.ok || !isExpectedPrice(price, plan, /^(sk|rk)_live_/.test(stripeKey))) {
      console.error("Stripe catalog price validation failed", {
        status: priceResponse.status,
        plan: planId,
        code: price?.error?.code || null
      });
      return send(res, 503, { error: "Il prezzo di questo piano non è configurato correttamente su Stripe. Nessun pagamento è stato avviato." });
    }

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("customer_email", email);
    form.set("billing_address_collection", "required");
    form.set("tax_id_collection[enabled]", "true");
    form.set("automatic_tax[enabled]", "true");
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price]", priceId);
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

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `concept-checkout-${crypto.randomUUID()}`
      },
      body: form.toString()
    });
    const stripeResult = await stripeResponse.json();
    if (!stripeResponse.ok || !stripeResult.url || !/^https:\/\/checkout\.stripe\.com\//i.test(stripeResult.url)) {
      console.error("Stripe checkout creation failed", {
        status: stripeResponse.status,
        type: stripeResult?.error?.type,
        code: stripeResult?.error?.code
      });
      return send(res, 502, { error: "Non è stato possibile preparare il checkout. Nessun pagamento è stato avviato. Riprova o contattaci." });
    }
    return send(res, 200, { url: stripeResult.url, sessionId: stripeResult.id });
  } catch (error) {
    console.error("Stripe checkout network failure", error?.message || "unknown error");
    return send(res, 502, { error: "Il servizio di pagamento non risponde. Nessun pagamento è stato avviato." });
  }
};
