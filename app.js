(() => {
  "use strict";
  const config = window.CONCEPT_CONFIG || {};
  const plans = config.plans || {
    starter: { name: "Starter", price: 49 },
    business: { name: "Business", price: 119 },
    pro: { name: "Pro", price: 249 }
  };
  const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
  const byId = id => document.getElementById(id);

  // Mobile navigation: close after choosing a section and keep aria-expanded in sync.
  const menuButton = document.querySelector(".menu-toggle");
  const mobileNav = byId("mobile-nav");
  if (menuButton && mobileNav) {
    menuButton.addEventListener("click", () => {
      const expanded = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!expanded));
      mobileNav.hidden = expanded;
    });
    mobileNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      menuButton.setAttribute("aria-expanded", "false");
      mobileNav.hidden = true;
    }));
  }

  // Accessible, real-time cost comparison based only on values chosen by the visitor.
  const traditionalCost = byId("traditional-cost");
  const traditionalMaintenance = byId("traditional-maintenance");
  const calculatorPlan = byId("calculator-plan");
  const calculatorPeriod = byId("calculator-period");
  const savingsValue = byId("savings-value");
  const savingsCaption = byId("savings-caption");
  const traditionalTotalEl = byId("traditional-total");
  const conceptTotalEl = byId("concept-total");
  const traditionalBar = byId("traditional-bar");
  const conceptBar = byId("concept-bar");
  const clampNumber = (value, max) => Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;

  function updateCalculator() {
    if (!traditionalCost || !traditionalMaintenance || !calculatorPlan || !calculatorPeriod) return;
    const initial = clampNumber(Number(traditionalCost.value), 500000);
    const maintenance = clampNumber(Number(traditionalMaintenance.value), 10000);
    const months = clampNumber(Number(calculatorPeriod.value), 36) || 12;
    const monthly = clampNumber(Number(calculatorPlan.value), 1000);
    const oldTotal = initial + maintenance * months;
    const newTotal = monthly * months;
    const difference = oldTotal - newTotal;
    const max = Math.max(oldTotal, newTotal, 1);
    savingsValue.textContent = `${difference < 0 ? "− " : ""}${money.format(Math.abs(difference))}`;
    savingsValue.classList.toggle("negative", difference < 0);
    traditionalTotalEl.textContent = money.format(oldTotal);
    conceptTotalEl.textContent = money.format(newTotal);
    traditionalBar.style.width = `${Math.max(2, (oldTotal / max) * 100)}%`;
    conceptBar.style.width = `${Math.max(2, (newTotal / max) * 100)}%`;
    const planName = Object.values(plans).find(plan => Number(plan.price) === monthly)?.name || "CONCEPT";
    if (difference > 0) {
      savingsCaption.textContent = `Con CONCEPT ${planName} la differenza stimata è ${money.format(difference)} in ${months} mesi, in base ai valori inseriti.`;
    } else if (difference < 0) {
      savingsCaption.textContent = `Con questi valori, CONCEPT costa ${money.format(Math.abs(difference))} in più in ${months} mesi. Valuta anche differenze di servizio e perimetro.`;
    } else {
      savingsCaption.textContent = `Con questi valori, il costo complessivo è uguale in ${months} mesi. Confronta anche il perimetro dei servizi.`;
    }
  }
  [traditionalCost, traditionalMaintenance, calculatorPlan, calculatorPeriod].filter(Boolean).forEach(el => {
    el.addEventListener("input", updateCalculator);
    el.addEventListener("change", updateCalculator);
  });
  const resetCalculator = byId("reset-calculator");
  if (resetCalculator) resetCalculator.addEventListener("click", () => {
    traditionalCost.value = "2400";
    traditionalMaintenance.value = "30";
    calculatorPlan.value = "119";
    calculatorPeriod.value = "12";
    updateCalculator();
  });
  updateCalculator();

  // Project enquiry / checkout modal.
  const dialog = byId("inquiry-dialog");
  const projectForm = byId("project-form");
  const formMessage = byId("form-message");
  const formPlan = byId("form-plan");
  const submitLabel = byId("submit-label");
  let lastFocused = null;
  let requestedAction = "checkout";

  function openInquiry(plan = "business", action = "checkout") {
    if (!dialog) return;
    lastFocused = document.activeElement;
    requestedAction = action;
    if (formPlan && ["starter", "business", "pro", "custom"].includes(plan)) formPlan.value = plan;
    if (formMessage) {
      formMessage.textContent = "";
      formMessage.classList.remove("error");
    }
    if (submitLabel) submitLabel.textContent = action === "inquiry" ? "Invia la richiesta" : "Continua al riepilogo";
    const termsRow = byId("checkout-terms-row");
    if (termsRow) termsRow.hidden = action !== "checkout";
    const termsInput = termsRow?.querySelector("input");
    if (termsInput) { termsInput.required = action === "checkout"; termsInput.checked = false; }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
    document.body.classList.add("dialog-open");
    window.setTimeout(() => dialog.querySelector("input[name=name]")?.focus(), 40);
  }
  function closeInquiry() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("dialog-open");
    lastFocused?.focus?.();
  }
  document.querySelectorAll("[data-select-plan]").forEach(button => {
    button.addEventListener("click", () => openInquiry(button.dataset.selectPlan, "checkout"));
  });
  document.querySelectorAll("[data-open-inquiry]").forEach(button => {
    button.addEventListener("click", () => openInquiry("custom", "inquiry"));
  });
  document.querySelectorAll("[data-email-link]").forEach(link => {
    const email = typeof config.salesEmail === "string" ? config.salesEmail.trim() : "";
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) link.href = `mailto:${email}`;
    else {
      link.href = "#pricing";
      link.addEventListener("click", event => { event.preventDefault(); openInquiry("custom", "inquiry"); });
    }
  });
  const closeButton = dialog?.querySelector(".dialog-close");
  closeButton?.addEventListener("click", closeInquiry);
  dialog?.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeInquiry();
  });
  dialog?.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && dialog?.open) closeInquiry();
  });

  function showFormMessage(message, kind = "success") {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.classList.toggle("error", kind === "error");
  }
  function getFormPayload() {
    const data = new FormData(projectForm);
    return {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      plan: String(data.get("plan") || "business"),
      siteType: String(data.get("siteType") || "").trim(),
      details: String(data.get("details") || "").trim(),
      privacyAcknowledged: data.get("privacyAcknowledged") === "on",
      termsAcknowledged: data.get("termsAcknowledged") === "on",
      website: String(data.get("website") || "").trim()
    };
  }
  function validatePayload(payload) {
    if (payload.name.length < 2 || payload.name.length > 100) return "Inserisci un nome valido (almeno 2 caratteri).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 254) return "Inserisci un indirizzo e-mail valido.";
    if (!Object.hasOwn(plans, payload.plan) && payload.plan !== "custom") return "Seleziona un piano valido.";
    if (!payload.siteType) return "Scegli la tipologia di sito.";
    if (!payload.privacyAcknowledged) return "Conferma di aver letto l'informativa privacy per proseguire.";
    if (requestedAction === "checkout" && !payload.termsAcknowledged) return "Per procedere al checkout devi confermare di aver letto le condizioni del servizio.";
    if (payload.details.length > 1800) return "La descrizione è troppo lunga.";
    return "";
  }
  function downloadProjectBrief(payload, reason) {
    const plan = payload.plan === "custom" ? "Da definire" : `${plans[payload.plan]?.name || payload.plan} — ${money.format(plans[payload.plan]?.price || 0)}/mese`;
    const content = [
      "CONCEPT — RIEPILOGO RICHIESTA PROGETTO",
      "======================================",
      `Nome: ${payload.name}`,
      `E-mail: ${payload.email}`,
      `Piano: ${plan}`,
      `Tipologia: ${payload.siteType}`,
      `Descrizione: ${payload.details || "Non specificata"}`,
      `Data: ${new Date().toLocaleString("it-IT")}`,
      "",
      "ATTENZIONE: questo riepilogo è stato generato localmente. Non è stato inviato al venditore.",
      `Motivo: ${reason}`,
      "Prima di inviare questo documento, verifica l'indirizzo di contatto ufficiale del servizio."
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "concept-richiesta-progetto.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || "Servizio momentaneamente non disponibile.");
      error.status = response.status;
      throw error;
    }
    return body;
  }
  if (projectForm) projectForm.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = getFormPayload();
    const validationError = validatePayload(payload);
    if (validationError) {
      showFormMessage(validationError, "error");
      projectForm.querySelector(":invalid")?.focus();
      return;
    }
    const submit = projectForm.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    if (submitLabel) submitLabel.textContent = requestedAction === "inquiry" ? "Invio in corso…" : "Preparazione…";
    showFormMessage("Un momento: stiamo preparando la richiesta…");
    try {
      const endpoint = requestedAction === "inquiry" ? config.inquiryEndpoint : config.checkoutEndpoint;
      if (!endpoint || typeof endpoint !== "string") throw new Error("Il servizio non è ancora configurato.");
      const result = await postJson(endpoint, payload);
      if (requestedAction === "checkout" && result.url && /^https:\/\//i.test(result.url)) {
        window.location.assign(result.url);
        return;
      }
      if (result.success) {
        showFormMessage(result.message || "Richiesta inviata correttamente. Ti ricontatteremo.");
        projectForm.reset();
        if (formPlan) formPlan.value = "business";
        if (submitLabel) submitLabel.textContent = "Richiesta inviata ✓";
        return;
      }
      throw new Error("La risposta del servizio non è valida.");
    } catch (error) {
      const configMissing = error.status === 503 || /non è ancora configurato|non configurato|momentaneamente non disponibile/i.test(error.message);
      const message = configMissing
        ? "Il sistema di invio/pagamento non è ancora collegato. Per non perdere i dettagli, puoi scaricare il brief: nessun dato è stato inviato e nessun pagamento è partito."
        : `Non siamo riusciti a completare l'operazione. Nessun pagamento è stato avviato. ${error.message}`;
      showFormMessage(message, "error");
      if (configMissing || !navigator.onLine) downloadProjectBrief(payload, error.message);
    } finally {
      if (submit) submit.disabled = false;
      if (submitLabel) submitLabel.textContent = requestedAction === "inquiry" ? "Invia la richiesta" : "Continua al riepilogo";
    }
  });

  // Footer year and lightweight reveal effects with a no-motion fallback.
  const year = byId("current-year");
  if (year) year.textContent = String(new Date().getFullYear());
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", event => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;
      const target = document.querySelector(targetId);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", targetId);
    });
  });
})();
