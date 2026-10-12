function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(body));
}

module.exports = function health(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed." });
  }
  const stripeKey = String(process.env.STRIPE_SECRET_KEY || "");
  const testKey = /^(sk|rk)_test_/.test(stripeKey);
  const liveKey = /^(sk|rk)_live_/.test(stripeKey);
  const siteUrl = String(process.env.SITE_URL || "");
  const prices = {
    starter: /^price_[A-Za-z0-9]+$/.test(String(process.env.STRIPE_PRICE_STARTER || "")),
    business: /^price_[A-Za-z0-9]+$/.test(String(process.env.STRIPE_PRICE_BUSINESS || "")),
    pro: /^price_[A-Za-z0-9]+$/.test(String(process.env.STRIPE_PRICE_PRO || ""))
  };
  const taxReady = process.env.STRIPE_AUTOMATIC_TAX === "true";
  const legalReady = process.env.LEGAL_TERMS_READY === "true" && Boolean(process.env.TERMS_VERSION);
  const sandboxEnabled = testKey && process.env.STRIPE_TEST_CHECKOUT_ENABLED === "true";
  const siteUrlReady = /^https:\/\//i.test(siteUrl);
  const keyReady = testKey || liveKey;
  const modeEligible = (taxReady && legalReady) || sandboxEnabled;
  return send(res, 200, {
    ok: true,
    appVersion: "20261012-4",
    runtime: process.env.VERCEL_ENV || "unknown",
    config: {
      siteUrlConfigured: siteUrlReady,
      stripeSecretConfigured: keyReady,
      stripeMode: testKey ? "test" : liveKey ? "live" : "unknown",
      sandboxCheckoutEnabled: sandboxEnabled,
      automaticTaxEnabled: taxReady,
      legalReadinessConfigured: legalReady,
      priceConfigured: prices
    },
    checkoutEnvironmentReady: siteUrlReady && keyReady && modeEligible && prices.starter && prices.business && prices.pro
  });
};
