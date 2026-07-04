/* =========================================================
   FOYER — shared components & helpers
   Call renderTopNav() / renderSidebar() / renderChatWidget()
   from each page after DOMContentLoaded.
   ========================================================= */

/* ---------------- formatters ---------------- */
function fmtDate(iso){ return new Date(iso).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); }
function fmtTime(iso){ return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}); }
function fmtDateTime(iso){ return `${fmtDate(iso)} · ${fmtTime(iso)}`; }
function fmtMoney(v){ return `$${Number(v).toFixed(2)}`; }
function initials(name){ return (name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(); }
function esc(s){ const d=document.createElement("div"); d.textContent=s==null?"":String(s); return d.innerHTML; }

const STATUS_LABEL = {
  confirmed:"Confirmed", waitlisted:"Waitlisted", cancelled:"Cancelled", attended:"Attended",
  pending:"Pending", no_show:"No Show", paid:"Paid", draft:"Draft", published:"Published",
};
function pillHtml(status){
  const label = STATUS_LABEL[status] || status;
  return `<span class="pill pill-${esc(status)}"><span class="d"></span>${esc(label)}</span>`;
}

/* ---------------- toast ---------------- */
function showToast(message, type="ok"){
  const el = document.createElement("div");
  el.className = "toast-foyer" + (type === "error" ? " err" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ---------------- top navbar (attendee-facing pages) ---------------- */
function renderTopNav(activePage){
  const user = getUser();
  const mount = document.getElementById("topnav");
  if (!mount || !user) return;

  mount.outerHTML = `
  <nav class="navbar navbar-foyer navbar-expand-lg sticky-top">
    <div class="container-fluid px-3 px-lg-4" style="max-width:1180px;margin:0 auto;">
      <a class="navbar-brand" href="index.html"><i class="bi bi-ticket-perforated"></i> FOYER<span class="dot">.</span></a>
      <div class="navbar-search d-none d-md-flex mx-3 flex-grow-1">
        <i class="bi bi-search" style="color:#a59c80;font-size:13px;"></i>
        <input id="navSearch" type="text" placeholder="Search events, cities, categories…">
      </div>
      <div class="d-flex align-items-center gap-1 ms-auto position-relative">
        <a class="nav-link ${activePage==='home'?'active':''}" href="index.html">Browse</a>
        <a class="nav-link ${activePage==='bookings'?'active':''}" href="my-bookings.html">My Bookings</a>
        <a class="nav-link ${activePage==='payments'?'active':''}" href="payments.html">Payments</a>
        ${user.is_seller ? `<a class="nav-link text-accent" href="dashboard.html"><i class="bi bi-building"></i> Organizer dashboard</a>` : ``}
        <button class="icon-btn" id="notifBtn"><i class="bi bi-bell"></i><span class="badge-dot" id="notifDot" style="display:none;"></span></button>
        <div class="notif-panel" id="notifPanel"></div>
        <div class="avatar-circle" title="${esc(user.username)}">${initials(user.first_name+' '+user.last_name)}</div>
        <button class="icon-btn" id="logoutBtn" title="Log out"><i class="bi bi-box-arrow-right"></i></button>
      </div>
    </div>
  </nav>`;

  document.getElementById("logoutBtn").addEventListener("click", () => { clearSession(); window.location.href = "login.html"; });

  const searchInput = document.getElementById("navSearch");
  if (searchInput){
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.location.href = `index.html?q=${encodeURIComponent(e.target.value)}`;
    });
  }

  apiFetchNotifications().then((notifs) => {
    const unread = notifs.filter(n => !n.read).length;
    if (unread > 0) document.getElementById("notifDot").style.display = "block";
    const panel = document.getElementById("notifPanel");
    panel.innerHTML = `<div class="p-3 fw-bold border-bottom" style="font-size:13px;">Notifications</div>` +
      (notifs.length === 0
        ? `<div class="empty-state p-4">Nothing yet — you're all caught up.</div>`
        : notifs.map(n => `
          <div class="notif-item ${!n.read?'unread':''}">
            ${!n.read ? '<span class="notif-dot"></span>' : '<span style="width:7px;display:inline-block;"></span>'}
            <div><div>${esc(n.message)}</div><div class="text-muted mt-1" style="font-size:11px;">${esc(n.time)}</div></div>
          </div>`).join(""));
    document.getElementById("notifBtn").addEventListener("click", () => panel.classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (!panel.contains(e.target) && e.target.id !== "notifBtn" && !e.target.closest("#notifBtn")) panel.classList.remove("open");
    });
  });
}

/* ---------------- sidebar (organizer-facing pages) ---------------- */
function renderSidebar(activePage){
  const mount = document.getElementById("sidebar");
  if (!mount) return;
  const items = [
    { id:"dashboard", href:"dashboard.html", icon:"bi-grid-1x2", label:"Dashboard" },
    { id:"createEvent", href:"create-event.html", icon:"bi-plus-circle", label:"Create Event" },
    { id:"payments", href:"payments.html?org=1", icon:"bi-credit-card", label:"Payouts" },
  ];
  mount.outerHTML = `
  <div class="sidebar-foyer d-none d-md-flex flex-column">
    <a class="navbar-brand mb-4 ps-1" href="dashboard.html"><i class="bi bi-ticket-perforated"></i> FOYER</a>
    ${items.map(it => `<a class="side-link ${activePage===it.id?'active':''}" href="${it.href}"><i class="bi ${it.icon}"></i> ${it.label}</a>`).join("")}
    <hr>
    <a class="side-link" href="index.html"><i class="bi bi-person"></i> Attendee view</a>
    <div class="flex-grow-1"></div>
    <button class="side-link" id="sideLogout"><i class="bi bi-box-arrow-right"></i> Log out</button>
  </div>`;
  document.getElementById("sideLogout").addEventListener("click", () => { clearSession(); window.location.href = "login.html"; });
}

/* ---------------- chat widget ---------------- */
function renderChatWidget(){
  const mount = document.getElementById("chatWidget");
  if (!mount) return;
  mount.innerHTML = `
    <button class="chat-fab" id="chatFab"><i class="bi bi-chat-dots" id="chatIcon"></i></button>
    <div class="chat-panel" id="chatPanel">
      <div class="chat-head">
        <div class="d-flex align-items-center gap-2" style="font-size:13px;font-weight:700;">
          <span style="width:8px;height:8px;border-radius:50%;background:#4a7c59;display:inline-block;"></span> Support
        </div>
        <i class="bi bi-x" style="cursor:pointer;" id="chatClose"></i>
      </div>
      <div class="chat-body" id="chatBody">
        <div class="chat-msg them">Hi! This is the Foyer support line — ask away about any event or booking.</div>
      </div>
      <div class="chat-input-row">
        <input id="chatInput" placeholder="Type a message…">
        <button class="chat-send" id="chatSend"><i class="bi bi-send"></i></button>
      </div>
    </div>`;
  const panel = document.getElementById("chatPanel");
  const fab = document.getElementById("chatFab");
  const body = document.getElementById("chatBody");
  fab.addEventListener("click", () => panel.classList.toggle("open"));
  document.getElementById("chatClose").addEventListener("click", () => panel.classList.remove("open"));

  function send(){
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;
    body.insertAdjacentHTML("beforeend", `<div class="chat-msg me">${esc(text)}</div>`);
    input.value = "";
    body.scrollTop = body.scrollHeight;
    setTimeout(() => {
      body.insertAdjacentHTML("beforeend", `<div class="chat-msg them">Got it — someone from the team will follow up shortly. Anything else?</div>`);
      body.scrollTop = body.scrollHeight;
    }, 900);
  }
  document.getElementById("chatSend").addEventListener("click", send);
  document.getElementById("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
}

/* ---------------- event-card / stub-card builders ---------------- */
function eventCardHtml(ev){
  return `
  <a class="stub-card mb-3" href="event-detail.html?slug=${encodeURIComponent(ev.slug)}">
    <div class="stub-img" style="background-image:url('${esc(ev.image)}')"></div>
    <div class="stub-perf"><span class="stub-notch top"></span><span class="stub-notch bot"></span></div>
    <div class="stub-body">
      <div class="stub-eyebrow">${esc(ev.category)}</div>
      <div class="stub-title">${esc(ev.title)}</div>
      <div class="stub-meta">
        <span><i class="bi bi-calendar3"></i> ${fmtDate(ev.start_date)}</span>
        <span><i class="bi bi-geo-alt"></i> ${ev.is_online ? "Online" : esc(ev.location)}</span>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <span class="stub-price">${ev.is_free ? "Free" : fmtMoney(ev.price)}</span>
        <span class="text-muted" style="font-size:11px;">${ev.capacity > 0 ? "Limited capacity" : "Open capacity"}</span>
      </div>
    </div>
  </a>`;
}
