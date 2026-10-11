# CONCEPT — Websites as a Service

Premium Italian-language marketing site for a website-subscription service. Includes a responsive landing page, a live comparison calculator, an enquiry modal, Vercel serverless endpoints for Stripe Checkout and Resend email, and draft legal pages.

## Current plans

- Starter — €49/month, up to 1 page
- Business — €119/month, up to 8 pages
- Pro — €249/month, up to 20 pages

The price is determined server-side in `api/create-checkout-session.js`. Do not accept a price supplied by the browser. Current examples in the savings calculator are explicitly editable estimates, not market-price claims or a guaranteed saving.

## Local checks

No front-end dependencies are required.

```bash
npm run check
```

For local preview, serve the directory over HTTP, for example:

```bash
npx serve .
```

The serverless endpoints require Vercel-compatible hosting; a plain static server cannot execute `/api/*`.

## Required Vercel environment variables

Configure these in the Vercel project before taking orders:

- `SITE_URL` — canonical HTTPS URL of this deployment, without a trailing slash.
- `STRIPE_SECRET_KEY` — secret key stored only as a server-side environment variable.
- `STRIPE_AUTOMATIC_TAX=true` — activate Stripe Tax for the Stripe account and confirm your tax setup before enabling checkout. Checkout intentionally returns 503 when this is not configured.
- `LEGAL_TERMS_READY=true` — only after every placeholder in `terms.html` has been replaced and the final subscription/recesso terms have been reviewed. Until then, checkout stays disabled.
- `PRIVACY_NOTICE_READY=true` — only after `privacy.html` reflects the actual controller, providers and retention policy. Until then, contact requests are not sent.
- `TERMS_VERSION` — non-empty version ID written into Stripe checkout metadata for later audit. Checkout remains disabled if it is absent.
- `RESEND_API_KEY` — API key for sending enquiries.
- `SALES_EMAIL` — verified inbox that receives project enquiries.
- `MAIL_FROM` — sender address on a domain verified with Resend, e.g. `CONCEPT <hello@your-verified-domain.example>`.

Stripe Checkout creates a real monthly subscription at the fixed server-side plan price and collects billing address/tax details. It does **not** implement a full client dashboard, subscription-cancellation portal, automatic suspension of customer sites, or automated deletion/retention jobs. Those require a persistent database, a webhook-driven subscription state machine, and the actual hosting/deployment integration for each customer project. Do not claim those automations are live until implemented and tested.

After changing a live Stripe price, update the server-side plan catalogue and all displayed pricing together, then rerun checks.

## Important pre-launch checklist

1. Replace the draft legal placeholders in `privacy.html` and `terms.html` with the actual legal entity, registered address, VAT/tax details, privacy contact, retention periods, cancellation/withdrawal rules, project export policy, and the final subscription contract. Have the final terms checked by an appropriate professional.
2. Decide and clearly disclose the initial commitment, cancellation rules, and handling of any applicable consumer withdrawal rights before checkout. The current code does not enforce a six-month minimum term.
3. Set the final domain and `SITE_URL`, configure DNS/HTTPS and Vercel deployment.
4. Activate Stripe Tax only after confirming the correct setup for the seller's tax position and markets served.
5. Verify the sender domain in Resend and test enquiry delivery, Stripe success/cancel flows, tax calculation, and the final subscription receipt.
6. Test keyboard navigation, mobile layouts, privacy information, and a full failed-payment / support process.
7. Google Fonts are currently loaded from Google's servers. If desired, self-host fonts and remove the external requests, or ensure the privacy notice accurately reflects the actual font setup and any associated data transfers.

## Safety / architecture notes

- Stripe secret keys and Resend keys must never be put in `site-config.js` or any other browser-delivered file.
- Checkout amounts are server-defined and user input is validated server-side.
- The order success page checks the Checkout Session against Stripe on the server; a client-side redirect alone is not treated as proof of payment.
- Contact requests are sent to the configured inbox via Resend. If provider configuration is absent, the site tells the visitor that no request was sent and offers a local text brief as a fallback.
- `privacy.html` and `terms.html` are intentionally marked as drafts until the owner's legal details and final commercial terms are known.
- No testimonials, customer logos, traffic figures, or industry-average savings are fabricated. Demo artwork is identified as conceptual.