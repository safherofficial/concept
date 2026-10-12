const assert = require('node:assert/strict');
const checkout = require('../api/create-checkout-session.js');
const contact = require('../api/contact.js');
const checkoutSession = require('../api/checkout-session.js');

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = value || ''; },
    json() { return JSON.parse(this.body || '{}'); }
  };
}
async function call(handler, req) {
  const res = mockResponse();
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, body: res.json() };
}
const valid = {
  name: 'Test Cliente', email: 'test@example.com', plan: 'business', siteType: 'Sito aziendale',
  details: 'Sito professionale per una piccola attività.', privacyAcknowledged: true,
  termsAcknowledged: true, website: ''
};
const priorEnv = { ...process.env };
const priorFetch = global.fetch;
(async () => {
  try {
    for (const key of [
      'SITE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_BUSINESS',
      'STRIPE_PRICE_PRO', 'STRIPE_AUTOMATIC_TAX', 'STRIPE_TEST_CHECKOUT_ENABLED', 'LEGAL_TERMS_READY', 'TERMS_VERSION'
    ]) delete process.env[key];

    let result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 503, 'Checkout deve rimanere disattivato se non è configurato.');

    process.env.SITE_URL = 'https://concept.example';
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_PRICE_BUSINESS = 'price_businesstest';
    const validBusinessPrice = {
      id: 'price_businesstest', active: true, currency: 'eur', unit_amount: 11900,
      type: 'recurring', recurring: { interval: 'month', interval_count: 1 }, livemode: false,
      product: { id: 'prod_business_test', name: 'CONCEPT Business', active: true }
    };

    // Sandbox-only mode must allow end-to-end checkout without pretending legal copy is ready.
    process.env.STRIPE_TEST_CHECKOUT_ENABLED = 'true';
    let sandboxPayload;
    global.fetch = async (url, options) => {
      if (url === 'https://api.stripe.com/v1/prices/price_businesstest?expand%5B%5D=product') {
        return { ok: true, status: 200, json: async () => ({ ...validBusinessPrice }) };
      }
      assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
      sandboxPayload = new URLSearchParams(options.body);
      return { ok: true, status: 200, json: async () => ({ id: 'cs_test_sandbox', url: 'https://checkout.stripe.com/c/pay/cs_test_sandbox' }) };
    };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 200, 'Il flag esplicito deve consentire il checkout Sandbox con una chiave test.');
    assert.equal(sandboxPayload.get('automatic_tax[enabled]'), 'false', 'Sandbox può essere testato senza attivare prima le imposte automatiche.');
    assert.equal(sandboxPayload.get('metadata[terms_version]'), 'sandbox-test');

    process.env.STRIPE_SECRET_KEY = 'sk_live_placeholder';
    global.fetch = async () => { throw new Error('La modalità Sandbox non deve usare Stripe live'); };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 503, 'Il flag Sandbox non deve bypassare i requisiti con una chiave live.');
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    delete process.env.STRIPE_TEST_CHECKOUT_ENABLED;
    process.env.STRIPE_AUTOMATIC_TAX = 'true';
    process.env.LEGAL_TERMS_READY = 'true';
    process.env.TERMS_VERSION = 'test-v1';
    let stripePayload;
    let priceFetchCount = 0;
    global.fetch = async (url, options) => {
      if (url === 'https://api.stripe.com/v1/prices/price_businesstest?expand%5B%5D=product') {
        priceFetchCount++;
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Authorization, 'Bearer sk_test_placeholder');
        return { ok: true, status: 200, json: async () => ({ ...validBusinessPrice }) };
      }
      assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
      assert.equal(options.method, 'POST');
      stripePayload = new URLSearchParams(options.body);
      return { ok: true, status: 200, json: async () => ({ id: 'cs_test_123abc', url: 'https://checkout.stripe.com/c/pay/cs_test_123abc' }) };
    };

    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 200);
    assert.match(result.body.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(priceFetchCount, 1, 'Il prezzo del catalogo deve essere verificato prima di creare la sessione.');
    assert.equal(stripePayload.get('mode'), 'subscription');
    assert.equal(stripePayload.get('line_items[0][price]'), 'price_businesstest', 'Il checkout deve usare il Price ID del catalogo.');
    assert.equal(stripePayload.get('line_items[0][quantity]'), '1');
    assert.equal(stripePayload.get('line_items[0][price_data][unit_amount]'), null, 'Il checkout non deve più creare prezzi inline.');
    assert.equal(stripePayload.get('automatic_tax[enabled]'), 'true');

    let fetched = false;
    delete process.env.STRIPE_PRICE_BUSINESS;
    global.fetch = async () => { fetched = true; throw new Error('Non deve chiamare Stripe senza un Price ID'); };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 503);
    assert.equal(fetched, false, 'Un piano senza Price ID non deve arrivare a Stripe.');
    process.env.STRIPE_PRICE_BUSINESS = 'price_businesstest';

    global.fetch = async (url) => {
      assert.equal(url, 'https://api.stripe.com/v1/prices/price_businesstest?expand%5B%5D=product');
      return { ok: true, status: 200, json: async () => ({ ...validBusinessPrice, unit_amount: 4900 }) };
    };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 503, 'Prezzo, valuta, modalità o prodotto non corrispondenti devono bloccare il checkout.');

    global.fetch = async () => { fetched = true; throw new Error('Non deve chiamare Stripe per un piano invalido'); };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: { ...valid, plan: 'custom' } });
    assert.equal(result.status, 400);
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://other.example' }, body: valid });
    assert.equal(result.status, 403, 'Origini non autorizzate devono essere rifiutate.');

    delete process.env.RESEND_API_KEY;
    delete process.env.SALES_EMAIL;
    delete process.env.MAIL_FROM;
    delete process.env.PRIVACY_NOTICE_READY;
    result = await call(contact, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 503, 'Richieste non devono essere dichiarate inviate se Resend non è configurato.');
    process.env.RESEND_API_KEY = 're_placeholder';
    process.env.SALES_EMAIL = 'sales@example.com';
    process.env.MAIL_FROM = 'CONCEPT <hello@example.com>';
    process.env.PRIVACY_NOTICE_READY = 'true';
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      const payload = JSON.parse(options.body);
      assert.equal(payload.reply_to, valid.email);
      assert.match(payload.text, /Sito professionale per una piccola attività/);
      return { ok: true, status: 200, json: async () => ({ id: 'mail_test_01' }) };
    };
    result = await call(contact, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    result = await call(contact, { method: 'POST', headers: { origin: 'https://concept.example' }, body: { ...valid, email: 'not-an-email' } });
    assert.equal(result.status, 400);
    result = await call(contact, { method: 'POST', headers: { origin: 'https://concept.example' }, body: { ...valid, website: 'https://spam.example' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true, 'L honeypot deve ignorare silenziosamente i bot.');

    global.fetch = async (url, options) => {
      assert.match(url, /^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\/cs_test_123abc/);
      return { ok: true, status: 200, json: async () => ({
        id: 'cs_test_123abc', status: 'complete', payment_status: 'paid',
        success_url: 'https://concept.example/success.html?session_id={CHECKOUT_SESSION_ID}',
        metadata: { plan: 'business' }, customer_details: { email: valid.email }, subscription: { status: 'active' }
      }) };
    };
    result = await call(checkoutSession, { method: 'GET', headers: {}, query: { session_id: 'cs_test_123abc' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.paid, true);
    assert.equal(result.body.plan, 'Business');
    result = await call(checkoutSession, { method: 'GET', headers: {}, query: { session_id: 'fake' } });
    assert.equal(result.status, 400);

    console.log('API TESTS: PASS — catalog Price ID validation, sandbox-only gate, test/live mode matching, checkout creation, origin checks, inquiry delivery/validation and server-side payment verification.');
  } catch (error) {
    console.error('API TESTS: FAIL');
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in priorEnv)) delete process.env[key];
    }
    Object.assign(process.env, priorEnv);
    global.fetch = priorFetch;
  }
})();
