/* Public configuration only. Never place API keys or secrets in this file. */
window.CONCEPT_CONFIG = Object.freeze({
  brandName: "CONCEPT",
  salesEmail: "",
  siteUrl: "",
  checkoutEndpoint: "/api/create-checkout-session",
  inquiryEndpoint: "/api/contact",
  plans: {
    starter: { name: "Starter", price: 49 },
    business: { name: "Business", price: 119 },
    pro: { name: "Pro", price: 249 }
  }
});
