const API_BASE_URL = "https://api.beautydesk.app.br";

const app = document.getElementById("app");
const toast = document.getElementById("toast");

const state = {
  slug: getSlugFromUrl(),
  company: null,
  selectedService: null,
  selectedDate: "",
  selectedTime: "",
  slots: [],
  loadingSlots: false,
  client: {
    name: "",
    whatsapp: "",
    email: "",
    notes: "",
    confirmed: false,
  },
  lastResponse: null,
};

function getSlugFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "public") return parts[1] || "";
  return parts[0] || "";
}

function setDocumentTitle() {
  const studio = state.company?.name || "BeautyDesk";
  document.title = `${studio} — Agendamento Online`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function currency(cents = 0) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents || 0) / 100);
}

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatDateBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function formatDateTimeBR(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNextDays(count = 14) {
  const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const weekday = weekdayFmt.format(date).replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
    return {
      iso,
      weekday,
      date: dayFmt.format(date),
      label: `${weekday} • ${dayFmt.format(date)}`,
    };
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || "Erro na requisição.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function loadingView(text = "Carregando...") {
  app.innerHTML = `
    <section class="loading-screen">
      <div class="spinner"></div>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

function stateView({ title, message, actionLabel, onAction }) {
  app.innerHTML = `
    <section class="state-screen panel inner">
      <div class="brand-mark">B</div>
      <h1 class="title-gradient">${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(message)}</p>
      ${actionLabel ? `<button class="primary-button" id="state-action">${escapeHtml(actionLabel)}</button>` : ""}
    </section>
  `;
  const btn = document.getElementById("state-action");
  if (btn && onAction) btn.addEventListener("click", onAction);
}

async function init() {
  if (!state.slug) {
    stateView({
      title: "Link inválido",
      message: "Confira o link de agendamento enviado pela profissional.",
    });
    return;
  }

  loadingView("Carregando espaço BeautyDesk...");

  try {
    state.company = await request(`/public/company/${encodeURIComponent(state.slug)}`);
    setDocumentTitle();
    renderHome();
  } catch (error) {
    const message = error.status === 404
      ? "Esse link de agendamento não está disponível."
      : "Não foi possível carregar a página de agendamento agora.";

    stateView({
      title: "Ops",
      message,
      actionLabel: "Tentar novamente",
      onAction: init,
    });
  }
}

function getProfessionalName() {
  return state.company?.professional?.displayName || "Profissional BeautyDesk";
}

function getProfessionalSpecialty() {
  return state.company?.professional?.specialty || "Atendimento com cuidado, organização e sofisticação.";
}

function getWhatsappLink() {
  const raw = state.company?.professional?.whatsapp || state.company?.whatsapp || "";
  const digits = onlyDigits(raw);
  return digits ? `https://wa.me/55${digits}` : "";
}

function avatarHtml() {
  const avatar = state.company?.professional?.avatarUrl;
  const initial = (state.company?.name || "B").trim().charAt(0).toUpperCase();
  return `
    <div class="avatar-ring">
      ${avatar ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="Foto da profissional" />` : `<div class="avatar-fallback">${escapeHtml(initial)}</div>`}
      <span class="online-dot"></span>
    </div>
  `;
}

function renderHome() {
  const company = state.company;
  const services = (company.services || []).filter((service) => service.isActive !== false);
  const whatsapp = getWhatsappLink();
  const mapsUrl = company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}` : "";

  app.innerHTML = `
    <section class="panel">
      <div class="hero">
        <div class="logo-stack">
          ${avatarHtml()}
          <div>
            <p class="kicker">Agendamento online</p>
            <h1 class="title-gradient">${escapeHtml(company.name)}</h1>
            <p class="professional-name">${escapeHtml(getProfessionalName())}</p>
            <p class="subtitle">${escapeHtml(getProfessionalSpecialty())}</p>
          </div>
        </div>

        <div class="hero-actions">
          <button class="primary-button" id="start-booking">Escolher serviço</button>
          ${whatsapp ? `<a class="secondary-button" href="${whatsapp}" target="_blank" rel="noopener">Falar no WhatsApp</a>` : ""}
        </div>
      </div>

      <div class="inner">
        <div class="card info-grid">
          ${company.whatsapp ? `
            <div class="info-row">
              <div class="icon-badge">☎</div>
              <div>
                <span class="info-label">Contato</span>
                <p class="info-value">${escapeHtml(company.whatsapp)}</p>
              </div>
            </div>
          ` : ""}
          ${company.address ? `
            <div class="info-row">
              <div class="icon-badge">⌖</div>
              <div>
                <span class="info-label">Localização</span>
                <p class="info-value">${escapeHtml(company.address)}</p>
              </div>
            </div>
            ${mapsUrl ? `<a class="ghost-button" href="${mapsUrl}" target="_blank" rel="noopener">Abrir no mapa</a>` : ""}
          ` : ""}
          ${!company.whatsapp && !company.address ? `<p class="muted center">Escolha um serviço para ver os horários disponíveis.</p>` : ""}
        </div>

        <section class="section mt-14">
          <h2 class="section-title">Serviços disponíveis</h2>
          <div class="service-list">
            ${services.length ? services.slice(0, 4).map(serviceCardHtml).join("") : `<div class="status-box warning">Nenhum serviço disponível para agendamento online no momento.</div>`}
          </div>
        </section>
      </div>
    </section>
  `;

  document.getElementById("start-booking")?.addEventListener("click", renderServices);
  document.querySelectorAll("[data-service-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const service = services.find((item) => item.id === el.getAttribute("data-service-id"));
      if (service) selectService(service);
    });
  });
}

function serviceCardHtml(service) {
  const deposit = service.requiresDeposit && service.depositPercent
    ? `<p class="option-meta">Solicita sinal de ${Number(service.depositPercent)}%</p>`
    : "";
  return `
    <button class="service-option" data-service-id="${escapeHtml(service.id)}">
      <div class="option-main">
        <p class="option-title">${escapeHtml(service.name)}</p>
        <p class="option-meta">${Number(service.durationMin || 0)} min${service.category ? ` • ${escapeHtml(service.category)}` : ""}</p>
        ${service.description ? `<p class="option-description">${escapeHtml(service.description)}</p>` : ""}
        ${deposit}
      </div>
      <div class="option-side">
        <div class="price">${currency(service.priceCents)}</div>
        <div class="radio"><div class="radio-dot hidden"></div></div>
      </div>
    </button>
  `;
}

function renderStepHeader(step, title, onBack) {
  return `
    <div class="step-header">
      <button class="back-button" id="back-button" aria-label="Voltar">‹</button>
      <div class="step-center">
        <p class="step-label">Passo ${step} de 3</p>
        <p class="step-title">${escapeHtml(title)}</p>
      </div>
      <span style="width:44px"></span>
    </div>
  `;
}

function bindBack(onBack) {
  document.getElementById("back-button")?.addEventListener("click", onBack);
}

function renderServices() {
  const services = (state.company.services || []).filter((service) => service.isActive !== false);

  app.innerHTML = `
    <section class="panel inner">
      ${renderStepHeader(1, "Escolha seu serviço")}
      <div class="summary-card">
        <p class="summary-title">${escapeHtml(state.company.name)}</p>
        <p class="summary-meta">Selecione o atendimento desejado para ver os horários disponíveis.</p>
      </div>
      <div class="service-list">
        ${services.length ? services.map((service) => {
          const active = state.selectedService?.id === service.id;
          return `
            <button class="service-option ${active ? "active" : ""}" data-service-id="${escapeHtml(service.id)}">
              <div class="option-main">
                <p class="option-title">${escapeHtml(service.name)}</p>
                <p class="option-meta">${Number(service.durationMin || 0)} min${service.category ? ` • ${escapeHtml(service.category)}` : ""}</p>
                ${service.description ? `<p class="option-description">${escapeHtml(service.description)}</p>` : ""}
                ${service.requiresDeposit && service.depositPercent ? `<p class="option-meta">Sinal de ${Number(service.depositPercent)}% para reservar</p>` : ""}
              </div>
              <div class="option-side">
                <div class="price">${currency(service.priceCents)}</div>
                <div class="radio">${active ? `<div class="radio-dot"></div>` : ""}</div>
              </div>
            </button>
          `;
        }).join("") : `<div class="status-box warning">Nenhum serviço disponível no momento.</div>`}
      </div>
      <div class="footer-action">
        <button class="primary-button" id="continue-service" ${state.selectedService ? "" : "disabled"}>Continuar</button>
      </div>
    </section>
  `;

  bindBack(renderHome);
  document.querySelectorAll("[data-service-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const service = services.find((item) => item.id === el.getAttribute("data-service-id"));
      if (service) {
        state.selectedService = service;
        state.selectedTime = "";
        renderServices();
      }
    });
  });
  document.getElementById("continue-service")?.addEventListener("click", () => {
    if (state.selectedService) renderAgenda();
  });
}

function selectService(service) {
  state.selectedService = service;
  state.selectedTime = "";
  renderAgenda();
}

async function loadSlots(date) {
  if (!state.selectedService) return;
  state.loadingSlots = true;
  renderAgenda({ keepStatus: true });

  try {
    const query = new URLSearchParams({ serviceId: state.selectedService.id, date });
    const response = await request(`/public/company/${encodeURIComponent(state.slug)}/availability?${query.toString()}`);
    state.slots = response.slots || [];
    if (!state.slots.includes(state.selectedTime)) state.selectedTime = "";
  } catch (error) {
    state.slots = [];
    state.selectedTime = "";
    showToast(error.message || "Não foi possível carregar horários.");
  } finally {
    state.loadingSlots = false;
    renderAgenda({ keepStatus: true });
  }
}

function renderAgenda() {
  const days = getNextDays(14);
  if (!state.selectedDate) state.selectedDate = days[0]?.iso || "";
  const service = state.selectedService;

  if (!service) {
    renderServices();
    return;
  }

  app.innerHTML = `
    <section class="panel inner">
      ${renderStepHeader(2, "Escolha seu horário")}
      <div class="summary-card">
        <p class="summary-title">${escapeHtml(service.name)}</p>
        <p class="summary-meta">${Number(service.durationMin || 0)} min • ${currency(service.priceCents)}</p>
      </div>

      <section class="section">
        <h2 class="section-title">Selecione o dia</h2>
        <div class="horizontal-scroll">
          ${days.map((day) => `
            <button class="day-pill ${state.selectedDate === day.iso ? "active" : ""}" data-date="${day.iso}">
              <span class="day-week">${escapeHtml(day.weekday)}</span>
              <span class="day-date">${escapeHtml(day.date)}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="section mt-14">
        <h2 class="section-title">Horários disponíveis</h2>
        ${state.loadingSlots ? `<div class="status-box"><div class="spinner"></div><span> Atualizando horários...</span></div>` : slotsHtml()}
      </section>

      <div class="footer-action">
        <button class="primary-button" id="continue-time" ${state.selectedTime && !state.loadingSlots ? "" : "disabled"}>Continuar</button>
      </div>
    </section>
  `;

  bindBack(renderServices);
  document.querySelectorAll("[data-date]").forEach((el) => {
    el.addEventListener("click", () => {
      const nextDate = el.getAttribute("data-date");
      if (nextDate && nextDate !== state.selectedDate) {
        state.selectedDate = nextDate;
        state.selectedTime = "";
        loadSlots(nextDate);
      }
    });
  });
  document.querySelectorAll("[data-time]").forEach((el) => {
    el.addEventListener("click", () => {
      state.selectedTime = el.getAttribute("data-time") || "";
      renderAgenda();
    });
  });
  document.getElementById("continue-time")?.addEventListener("click", validateSelectedSlotAndContinue);

  if (!state.loadingSlots && state.slots.length === 0 && !renderAgenda.loadedForDate) {
    renderAgenda.loadedForDate = state.selectedDate;
    loadSlots(state.selectedDate);
  } else if (renderAgenda.loadedForDate !== state.selectedDate) {
    renderAgenda.loadedForDate = state.selectedDate;
    loadSlots(state.selectedDate);
  }
}

function slotsHtml() {
  if (!state.slots.length) {
    return `<div class="status-box warning">Nenhum horário disponível para esse dia. Escolha outra data.</div>`;
  }
  return `
    <div class="slots-grid">
      ${state.slots.map((slot) => `
        <button class="slot-button ${state.selectedTime === slot ? "active" : ""}" data-time="${escapeHtml(slot)}">${escapeHtml(slot)}</button>
      `).join("")}
    </div>
  `;
}

async function validateSelectedSlotAndContinue() {
  if (!state.selectedService || !state.selectedDate || !state.selectedTime) return;
  try {
    const query = new URLSearchParams({ serviceId: state.selectedService.id, date: state.selectedDate });
    const response = await request(`/public/company/${encodeURIComponent(state.slug)}/availability?${query.toString()}`);
    const freshSlots = response.slots || [];
    state.slots = freshSlots;
    if (!freshSlots.includes(state.selectedTime)) {
      state.selectedTime = "";
      renderAgenda();
      showToast("Esse horário acabou de ser reservado. Escolha outro horário.");
      return;
    }
    renderClientData();
  } catch (error) {
    showToast(error.message || "Não foi possível validar esse horário.");
  }
}

function renderClientData(errors = {}) {
  const service = state.selectedService;
  const depositAmount = service?.requiresDeposit && service?.depositPercent
    ? Math.round((Number(service.priceCents || 0) * Number(service.depositPercent)) / 100)
    : null;

  app.innerHTML = `
    <section class="panel inner">
      ${renderStepHeader(3, "Seus dados")}
      <div class="summary-card">
        <p class="summary-title">${escapeHtml(service.name)}</p>
        <p class="summary-meta">${formatDateBR(state.selectedDate)} • ${escapeHtml(state.selectedTime)} • ${Number(service.durationMin || 0)} min • ${currency(service.priceCents)}</p>
        ${depositAmount ? `<p class="deposit-hint">Este serviço pode solicitar sinal de ${currency(depositAmount)} para reservar.</p>` : ""}
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="label" for="client-name">Seu nome</label>
          <input class="input" id="client-name" autocomplete="name" placeholder="Digite seu nome completo" value="${escapeHtml(state.client.name)}" />
          ${errors.name ? `<span class="field-error">${escapeHtml(errors.name)}</span>` : ""}
        </div>
        <div class="field">
          <label class="label" for="client-whatsapp">Seu WhatsApp</label>
          <input class="input" id="client-whatsapp" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" value="${escapeHtml(formatPhone(state.client.whatsapp))}" />
          ${errors.whatsapp ? `<span class="field-error">${escapeHtml(errors.whatsapp)}</span>` : ""}
        </div>
        <div class="field">
          <label class="label" for="client-email">E-mail opcional</label>
          <input class="input" id="client-email" inputmode="email" autocomplete="email" placeholder="seuemail@email.com" value="${escapeHtml(state.client.email)}" />
        </div>
        <div class="field">
          <label class="label" for="client-notes">Observações opcionais</label>
          <textarea class="textarea" id="client-notes" placeholder="Alguma observação importante para a profissional?">${escapeHtml(state.client.notes)}</textarea>
        </div>

        <button class="check-row ${state.client.confirmed ? "checked" : ""}" id="confirm-data">
          <span class="checkbox">${state.client.confirmed ? "✓" : ""}</span>
          <span class="check-copy">Confirmo que meus dados estão corretos e que desejo reservar esse horário.</span>
        </button>

        ${errors.submit ? `<div class="submit-error">${escapeHtml(errors.submit)}</div>` : ""}
      </div>

      <div class="footer-action">
        <button class="primary-button" id="submit-booking">Confirmar agendamento</button>
      </div>
    </section>
  `;

  bindBack(renderAgenda);
  const name = document.getElementById("client-name");
  const whatsapp = document.getElementById("client-whatsapp");
  const email = document.getElementById("client-email");
  const notes = document.getElementById("client-notes");

  name.addEventListener("input", (e) => state.client.name = e.target.value);
  whatsapp.addEventListener("input", (e) => {
    state.client.whatsapp = onlyDigits(e.target.value).slice(0, 11);
    e.target.value = formatPhone(state.client.whatsapp);
  });
  email.addEventListener("input", (e) => state.client.email = e.target.value);
  notes.addEventListener("input", (e) => state.client.notes = e.target.value);
  document.getElementById("confirm-data")?.addEventListener("click", () => {
    state.client.confirmed = !state.client.confirmed;
    renderClientData(errors);
  });
  document.getElementById("submit-booking")?.addEventListener("click", submitBooking);
}

function validateClient() {
  const errors = {};
  if (state.client.name.trim().length < 3) errors.name = "Digite seu nome completo.";
  if (onlyDigits(state.client.whatsapp).length < 10) errors.whatsapp = "Digite um WhatsApp válido.";
  if (!state.client.confirmed) errors.submit = "Confirme seus dados para continuar.";
  return errors;
}

async function submitBooking() {
  const errors = validateClient();
  if (Object.keys(errors).length) {
    renderClientData(errors);
    return;
  }

  const button = document.getElementById("submit-booking");
  if (button) {
    button.disabled = true;
    button.textContent = "Confirmando...";
  }

  try {
    const payload = {
      serviceId: state.selectedService.id,
      date: state.selectedDate,
      time: state.selectedTime,
      clientName: state.client.name.trim(),
      clientWhatsapp: onlyDigits(state.client.whatsapp),
      clientPhone: onlyDigits(state.client.whatsapp),
      clientEmail: state.client.email.trim() || undefined,
      notes: state.client.notes.trim() || undefined,
    };

    state.lastResponse = await request(`/public/company/${encodeURIComponent(state.slug)}/appointments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    renderSuccess();
  } catch (error) {
    if (error.status === 409) {
      state.selectedTime = "";
      renderAgenda();
      showToast(error.message || "Esse horário acabou de ser reservado. Escolha outro horário.");
      return;
    }
    renderClientData({ submit: error.message || "Não foi possível concluir seu agendamento." });
  }
}

function renderSuccess() {
  const response = state.lastResponse || {};
  const payment = response.payment || null;
  const depositRequired = !!payment?.required;
  const service = state.selectedService;
  const title = depositRequired ? "Horário reservado" : "Agendamento solicitado";
  const subtitle = depositRequired
    ? `${state.client.name.trim()}, finalize o sinal para garantir seu atendimento.`
    : `${state.client.name.trim()}, seu horário foi solicitado com sucesso.`;

  app.innerHTML = `
    <section class="panel inner">
      <div class="state-screen" style="min-height:auto;padding:18px 0 4px;">
        <div class="brand-mark">${depositRequired ? "₿" : "✓"}</div>
        <h1 class="title-gradient">${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>

      <div class="summary-card">
        <p class="summary-title">${escapeHtml(service.name)}</p>
        <p class="summary-meta">${formatDateBR(state.selectedDate)} • ${escapeHtml(state.selectedTime)}</p>
      </div>

      ${depositRequired ? paymentHtml(payment) : `<div class="status-box success">A profissional receberá sua solicitação e poderá confirmar o atendimento.</div>`}

      <div class="hero-actions mt-14">
        ${getWhatsappLink() ? `<a class="secondary-button" href="${getWhatsappLink()}" target="_blank" rel="noopener">Falar com a profissional</a>` : ""}
        <button class="ghost-button" id="new-booking">Fazer outro agendamento</button>
      </div>
    </section>
  `;

  document.getElementById("new-booking")?.addEventListener("click", () => {
    state.selectedService = null;
    state.selectedDate = "";
    state.selectedTime = "";
    state.slots = [];
    state.client = { name: "", whatsapp: "", email: "", notes: "", confirmed: false };
    renderHome();
  });

  document.querySelectorAll("[data-copy]").forEach((el) => {
    el.addEventListener("click", () => copyText(el.getAttribute("data-copy") || ""));
  });
}

function pixKeyTypeLabel(type) {
  const map = {
    cpf: "CPF",
    cnpj: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    random: "Chave aleatória",
  };
  return map[type] || "Chave Pix";
}

function paymentHtml(payment) {
  return `
    <div class="payment-card">
      <span class="info-label">Pagamento do sinal</span>
      <div class="payment-amount">${currency(payment.amountCents)}</div>
      ${payment.expiresAt ? `<p class="summary-meta">Prazo do sinal: ${formatDateTimeBR(payment.expiresAt)}</p>` : ""}
      ${payment.receiverName ? `<p class="summary-meta">Recebedor: ${escapeHtml(payment.receiverName)}</p>` : ""}
      ${payment.city ? `<p class="summary-meta">Cidade: ${escapeHtml(payment.city)}</p>` : ""}

      ${payment.pixKeyValue ? `
        <div class="mt-14">
          <span class="info-label">${pixKeyTypeLabel(payment.pixKeyType)}</span>
          <div class="copy-box">${escapeHtml(payment.pixKeyValue)}</div>
          <button class="secondary-button mt-14" data-copy="${escapeHtml(payment.pixKeyValue)}">Copiar chave Pix</button>
        </div>
      ` : ""}

      ${payment.pixCopyPaste ? `
        <div class="mt-14">
          <span class="info-label">Código Pix copia e cola</span>
          <div class="copy-box">${escapeHtml(payment.pixCopyPaste)}</div>
          <button class="primary-button mt-14" data-copy="${escapeHtml(payment.pixCopyPaste)}">Copiar código Pix</button>
        </div>
      ` : ""}

      ${payment.instructions ? `
        <div class="mt-14">
          <span class="info-label">Instruções</span>
          <div class="copy-box">${escapeHtml(payment.instructions)}</div>
          <button class="ghost-button mt-14" data-copy="${escapeHtml(payment.instructions)}">Copiar instruções</button>
        </div>
      ` : ""}
    </div>
  `;
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copiado com sucesso.");
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    showToast("Copiado com sucesso.");
  }
}

window.addEventListener("popstate", () => init());
init();
