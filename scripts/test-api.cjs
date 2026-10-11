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
  details: 'Sito professionale per una piccola attività.', privacyAcknowledged: true, termsAcknowledged: true, website: ""
};
const priorEnv = { ...process.env };
const priorFetch = global.fetch;
(async () => {
  try {
    delete process.env.SITE_URL;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_AUTOMATIC_TAX;
    delete process.env.LEGAL_TERMS_READY;
    delete process.env.TERMS_VERSION;
    let result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 503, 'Checkout deve rimanere disattivato se non è configurato.');

    process.env.SITE_URL = 'https://concept.example';
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_AUTOMATIC_TAX = 'true';
    process.env.LEGAL_TERMS_READY = 'true';
    process.env.TERMS_VERSION = 'test-v1';
    let stripePayload;
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
      stripePayload = new URLSearchParams(options.body);
      return { ok: true, status: 200, json: async () => ({ id: 'cs_test_123abc', url: 'https://checkout.stripe.com/c/pay/cs_test_123abc' }) };
    };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: valid });
    assert.equal(result.status, 200);
    assert.match(result.body.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(stripePayload.get('line_items[0][price_data][unit_amount]'), '11900', 'Il prezzo Business deve essere deciso dal server.');
    assert.equal(stripePayload.get('automatic_tax[enabled]'), 'true');
    assert.equal(stripePayload.get('line_items[0][price_data][recurring][interval]'), 'month');

    let fetched = false;
    global.fetch = async () => { fetched = true; throw new Error('Non deve chiamare Stripe per un piano invalido'); };
    result = await call(checkout, { method: 'POST', headers: { origin: 'https://concept.example' }, body: { ...valid, plan: 'custom' } });
    assert.equal(result.status, 400);
    assert.equal(fetched, false, 'Un piano personalizzato non deve passare al checkout standard.');
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
    assert.equal(result.body.success, true, "L honeypot deve ignorare silenziosamente i bot.");

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

    console.log('API TESTS: PASS — checkout config/price validation, origin checks, inquiry delivery/validation and server-side payment verification.');
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
