(() => {
  "use strict";
  const APP_VERSION = "20261012-4";
  const config = window.CONCEPT_CONFIG || {};
  const plans = config.plans || {
    starter: { name: "Starter", price: 49 },
    business: { name: "Business", price: 119 },
    pro: { name: "Pro", price: 249 }
  };
  const byId = id => document.getElementById(id);
  const tr = value => window.CONCEPT_I18N?.t(value) || value;
  const money = value => new Intl.NumberFormat(window.CONCEPT_I18N?.getLanguage() === "en" ? "en-IE" : "it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

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
    savingsValue.textContent = `${difference < 0 ? "− " : ""}${money(Math.abs(difference))}`;
    savingsValue.classList.toggle("negative", difference < 0);
    traditionalTotalEl.textContent = money(oldTotal);
    conceptTotalEl.textContent = money(newTotal);
    traditionalBar.style.width = `${Math.max(2, (oldTotal / max) * 100)}%`;
    conceptBar.style.width = `${Math.max(2, (newTotal / max) * 100)}%`;
    const planName = Object.values(plans).find(plan => Number(plan.price) === monthly)?.name || "CONCEPT";
    const english = window.CONCEPT_I18N?.getLanguage() === "en";
    if (difference > 0) {
      savingsCaption.textContent = english
        ? `With CONCEPT ${planName}, your estimated difference is ${money(difference)} over ${months} months, based on your inputs.`
        : `Con CONCEPT ${planName} la differenza stimata è ${money(difference)} in ${months} mesi, in base ai valori inseriti.`;
    } else if (difference < 0) {
      savingsCaption.textContent = english
        ? `With these figures, CONCEPT costs ${money(Math.abs(difference))} more over ${months} months. Compare the service scope too.`
        : `Con questi valori, CONCEPT costa ${money(Math.abs(difference))} in più in ${months} mesi. Valuta anche differenze di servizio e perimetro.`;
    } else {
      savingsCaption.textContent = english
        ? `With these figures, the total cost is the same over ${months} months. Compare the service scope too.`
        : `Con questi valori, il costo complessivo è uguale in ${months} mesi. Confronta anche il perimetro dei servizi.`;
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
    if (submitLabel) submitLabel.textContent = action === "inquiry" ? tr("Invia la richiesta") : tr("Continua al checkout");
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
    if (payload.name.length < 2 || payload.name.length > 100) return tr("Inserisci un nome valido (almeno 2 caratteri).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 254) return tr("Inserisci un indirizzo e-mail valido.");
    if (!Object.hasOwn(plans, payload.plan) && payload.plan !== "custom") return tr("Seleziona un piano valido.");
    if (!payload.siteType) return tr("Scegli la tipologia di sito.");
    if (!payload.privacyAcknowledged) return tr("Conferma di aver letto l'informativa privacy per proseguire.");
    if (requestedAction === "checkout" && !payload.termsAcknowledged) return tr("Per procedere al checkout devi confermare di aver letto le condizioni del servizio.");
    if (payload.details.length > 1800) return tr("La descrizione è troppo lunga.");
    return "";
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
      const error = new Error(tr(body.error || "Servizio momentaneamente non disponibile."));
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
    if (submitLabel) submitLabel.textContent = requestedAction === "inquiry" ? tr("Invio in corso…") : tr("Preparazione…");
    showFormMessage(tr("Un momento: stiamo preparando la richiesta…"));
    try {
      const endpoint = requestedAction === "inquiry" ? config.inquiryEndpoint : config.checkoutEndpoint;
      if (!endpoint || typeof endpoint !== "string") throw new Error(tr("Il servizio non è ancora configurato."));
      const result = await postJson(endpoint, payload);
      if (requestedAction === "checkout" && result.url && /^https:\/\//i.test(result.url)) {
        window.location.assign(result.url);
        return;
      }
      if (result.success) {
        showFormMessage(tr(result.message || "Richiesta inviata. Grazie: ti ricontatteremo usando l'e-mail indicata."));
        projectForm.reset();
        if (formPlan) formPlan.value = "business";
        if (submitLabel) submitLabel.textContent = tr("Richiesta inviata ✓");
        return;
      }
      throw new Error(tr("La risposta del servizio non è valida."));
    } catch (error) {
      const endpoint = requestedAction === "inquiry" ? config.inquiryEndpoint : config.checkoutEndpoint;
      const noAction = requestedAction === "checkout"
        ? tr("Nessun pagamento è stato avviato.")
        : tr("Nessun dato è stato registrato.");
      const messageText = String(error?.message || "");
      const networkFailure = !Number.isInteger(error?.status) &&
        /failed to fetch|networkerror|load failed|fetch failed/i.test(messageText);
      let message;
      if (networkFailure) {
        message = `${tr("Il browser non riesce a raggiungere l'API del sito.")} ${String(endpoint || "endpoint non configurato")}. ${noAction} ${tr("Versione interfaccia:")} ${APP_VERSION}.`;
      } else if (error?.status === 503) {
        message = `${tr(messageText)} ${noAction} ${tr("Versione interfaccia:")} ${APP_VERSION}.`;
      } else {
        const status = Number.isInteger(error?.status) ? `HTTP ${error.status}. ` : "";
        message = `${tr("Non siamo riusciti a completare l'operazione.")} ${status}${tr(messageText || "Errore sconosciuto.")} ${noAction} ${tr("Versione interfaccia:")} ${APP_VERSION}.`;
      }
      showFormMessage(message, "error");
    } finally {
      if (submit) submit.disabled = false;
      if (submitLabel) submitLabel.textContent = requestedAction === "inquiry" ? tr("Invia la richiesta") : tr("Continua al checkout");
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
