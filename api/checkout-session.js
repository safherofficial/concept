function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
module.exports = async function checkoutSession(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Metodo non consentito." });
  }

  const siteUrl = String(process.env.SITE_URL || "").replace(/\/$/, "");
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  // The success page may live on a Vercel Preview host rather than SITE_URL.
  // The Stripe key is required; the request host is used to validate the return URL.
  if (!stripeKey) return send(res, 503, { error: "Verifica ordine non configurata: chiave Stripe assente." });

  const sessionId = String(req.query?.session_id || "");
  if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return send(res, 400, { error: "Identificativo ordine non valido." });
  }

  const allowedHosts = new Set();
  try {
    if (siteUrl) {
      const configured = new URL(siteUrl);
      if (configured.protocol === "https:") allowedHosts.add(configured.host.toLowerCase());
    }
  } catch {
    // A malformed optional SITE_URL must not block Preview verification when the request host is valid.
  }
  const requestHost = String(req.headers.host || "").trim().toLowerCase();
  if (requestHost) allowedHosts.add(requestHost);

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=subscription`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const result = await response.json();
    if (!response.ok) return send(res, 502, { error: "Non è stato possibile verificare l'ordine." });

    if (result.success_url) {
      let successUrl;
      try {
        successUrl = new URL(result.success_url.replace("{CHECKOUT_SESSION_ID}", sessionId));
      } catch {
        return send(res, 400, { error: "Ordine non valido per questo sito." });
      }
      if (
        successUrl.protocol !== "https:" ||
        successUrl.username ||
        successUrl.password ||
        successUrl.pathname !== "/success.html" ||
        !allowedHosts.has(successUrl.host.toLowerCase())
      ) {
        return send(res, 400, { error: "Ordine non valido per questo sito." });
      }
    } else {
      return send(res, 400, { error: "Ordine privo di URL di conferma valido." });
    }

    const paid = result.status === "complete" &&
      (result.payment_status === "paid" || result.payment_status === "no_payment_required");
    if (!paid) {
      return send(res, 200, {
        paid: false,
        message: "Il pagamento non risulta ancora completato. Controlla lo stato su Stripe o riprova tra qualche istante."
      });
    }
    const plan = String(result.metadata?.plan || "");
    const plans = { starter: "Starter", business: "Business", pro: "Pro" };
    return send(res, 200, {
      paid: true,
      plan: plans[plan] || "Abbonamento CONCEPT",
      email: result.customer_details?.email || result.customer_email || "",
      subscriptionStatus: typeof result.subscription === "object" ? result.subscription.status : "active"
    });
  } catch (error) {
    console.error("Checkout session verification failed", error?.message || "unknown error");
    return send(res, 502, { error: "Errore temporaneo nella verifica dell'ordine." });
  }
};
