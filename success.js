(() => {
  const byId = id => document.getElementById(id);
  const tr = value => window.CONCEPT_I18N?.t(value) || value;
  const moneySafeText = value => String(value || "").replace(/[<>]/g, "");
  if (byId("success-year")) byId("success-year").textContent = String(new Date().getFullYear());
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") || "";
  const title = byId("success-title");
  const copy = byId("success-copy");
  const icon = byId("success-icon");
  const details = byId("success-details");
  const idOkay = /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId);
  async function verify() {
    if (!idOkay) {
      icon.textContent = "!";
      title.textContent = tr("Non troviamo questo ordine.");
      copy.textContent = tr("Manca un identificativo di checkout valido. Non è stata fatta alcuna nuova transazione da questa pagina.");
      return;
    }
    try {
      const response = await fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Verifica non disponibile.");
      if (!result.paid) {
        icon.textContent = "…";
        title.textContent = tr("Pagamento non ancora confermato.");
        copy.textContent = result.message || tr("Controlla il tuo metodo di pagamento o riprova tra poco.");
        return;
      }
      icon.textContent = "✓";
      icon.classList.add("success-icon-good");
      title.textContent = tr("Perfetto. Si comincia.");
      copy.textContent = tr("Il pagamento risulta confermato. Conserva la ricevuta inviata dal processore di pagamento.");
      details.hidden = false;
      const rows = [{ label: tr("Piano"), value: result.plan }, { label: tr("E-mail"), value: result.email }, { label: tr("Stato abbonamento"), value: result.subscriptionStatus }];
      rows.forEach(row => {
        if (!row.value) return;
        const line = document.createElement("div");
        const label = document.createElement("span"); label.textContent = row.label;
        const value = document.createElement("strong"); value.textContent = moneySafeText(row.value);
        line.append(label, value); details.append(line);
      });
    } catch (error) {
      icon.textContent = "!";
      title.textContent = tr("Non riusciamo a verificare ora.");
      copy.textContent = `${tr(error.message || "Servizio momentaneamente non disponibile.")} ${tr("Non ripetere il pagamento prima di aver controllato la conferma con Stripe.")}`;
    }
  }
  verify();
})();
