/* =========================================================
   FOYER — API layer
   Points at your DRF backend. Every call tries the real
   endpoint first; if it's unreachable it falls back to demo
   data (DEMO.*) below, so every page works standalone while
   you wire up the backend.

   NOTE ON AUTH STORAGE: this uses localStorage so the session
   survives navigating between pages (login.html -> index.html
   etc). That only works once these files are served from your
   own Django/static server — it will not persist inside
   Claude's in-chat file preview, only after you download and
   host them yourself.
   ========================================================= */

const API_BASE = "https://getyourshow.onrender.com";

function getToken(){ return localStorage.getItem("foyer_token"); }
function getUser(){ try{ return JSON.parse(localStorage.getItem("foyer_user")); }catch(e){ return null; } }
function setSession(token, user){ localStorage.setItem("foyer_token", token); localStorage.setItem("foyer_user", JSON.stringify(user)); }
function clearSession(){ localStorage.removeItem("foyer_token"); localStorage.removeItem("foyer_user"); }

function requireAuth(){
  if (!getToken()){ window.location.href = "login.html"; return null; }
  return getUser();
}
function requireOrganizer(){
  const u = requireAuth();
  if (u && !u.is_seller){ window.location.href = "index.html"; return null; }
  return u;
}

async function apiRequest(path, options = {}){
  try{
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    if (res.status === 204) return {};
    return await res.json();
  }catch(err){
    return null; // signal: caller should fall back to demo data
  }
}

/* ---------------- Auth ----------------
   USERNAME_FIELD on CustomUser_details is 'mob' */
async function apiLogin(mob, password){
  const data = await apiRequest("/auth/token/", { method:"POST", body: JSON.stringify({ mob, password }) });
  if (data) return data;
  const match = DEMO.users.find(u => u.mob === mob);
  if (!match) return { error: "No account with that mobile number (demo: try 9876543210)." };
  return { token: "demo-token-" + match.id, user: match };
}

async function apiRegisterUser(payload){
  const data = await apiRequest("/user/", { method:"POST", body: JSON.stringify(payload) });
  if (data) return data;
  const newUser = {
    id: 100 + DEMO.users.length, username: payload.username, first_name: payload.first_name,
    last_name: payload.last_name, email: payload.email, mob: payload.mob, is_seller: !!payload.is_seller,
  };
  return { token: "demo-token-" + newUser.id, user: newUser };
}

/* ---------------- Categories (event_category model) ---------------- */
async function apiFetchCategories(){
  const data = await apiRequest("/categories/", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.categories;
}

/* ---------------- Events ---------------- */
async function apiFetchEvents(){
  const data = await apiRequest("/list/event/", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.events;
}
async function apiFetchEventBySlug(slug){
  const data = await apiRequest(`/list/event/${slug}/`, { method:"GET" });
  if (data) return data;
  return DEMO.events.find(e => e.slug === slug) || DEMO.events[0];
}
async function apiFetchMyEvents(){
  const data = await apiRequest("/events/my-events/", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.events.filter(e => e.organizer === "you");
}
async function apiCreateEvent(payload){
  const data = await apiRequest("/list/event/", { method:"POST", body: JSON.stringify(payload) });
  if (data) return data;
  return { ...payload, id: Date.now(), slug: payload.title.toLowerCase().replace(/\s+/g,"-"), organizer:"you" };
}

/* ---------------- Registrations ---------------- */
async function apiFetchMyBookings(){
  const data = await apiRequest("/registration", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.bookings;
}
async function apiFetchBookingById(id){
  const data = await apiRequest(`/registration/${id}`, { method:"GET" });
  if (data) return data;
  return DEMO.bookings.find(b => String(b.id) === String(id));
}
async function apiRegisterForEvent(eventId, notes){
  const data = await apiRequest("/registration/", { method:"POST", body: JSON.stringify({ event: eventId, notes }) });
  if (data) return data;
  const event = DEMO.events.find(e => e.id === eventId);
  return {
    id: Date.now(), event, status: "confirmed",
    ticket_code: "demo-" + Math.random().toString(36).slice(2, 10),
    notes, amount_paid: event.is_free ? 0 : event.price,
    checked_in: false, registered_at: new Date().toISOString(),
  };
}
async function apiCancelRegistration(id){
  const data = await apiRequest(`/registration/${id}/cancel/`, { method:"POST" });
  return data || { detail: "Cancelled (demo)" };
}
async function apiFetchEventRegistrations(slug){
  const data = await apiRequest(`/event/${slug}/registrations/`, { method:"GET" });
  if (data) return data.results || data;
  return DEMO.eventRegistrations;
}
async function apiCheckIn(id){
  const data = await apiRequest(`/registration/${id}/check-in/`, { method:"POST" });
  return data || { detail: "Checked in (demo)" };
}

/* ---------------- Payments ---------------- */
async function apiFetchPayments(){
  const data = await apiRequest("/payments/", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.payments;
}
async function apiFetchOrgRevenue(){
  const data = await apiRequest("/payments/organizer-summary/", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.orgRevenue;
}

/* ---------------- Notifications ---------------- */
async function apiFetchNotifications(){
  const data = await apiRequest("/notifications/", { method:"GET" });
  if (data) return data.results || data;
  return DEMO.notifications;
}

/* =========================================================
   DEMO DATA — used only when API_BASE is unreachable
   ========================================================= */
const DEMO = {
  users: [
    { id:1, username:"ravi_k", first_name:"Ravi", last_name:"Kumar", email:"ravi@example.com", mob:"9876543210", is_seller:false },
    { id:2, username:"maya_events", first_name:"Maya", last_name:"Singh", email:"maya@example.com", mob:"9123456789", is_seller:true },
  ],
  categories: [
    { id:1, name:"Music" }, { id:2, name:"Technology" }, { id:3, name:"Art & Design" },
    { id:4, name:"Food & Drink" }, { id:5, name:"Business" }, { id:6, name:"Sports" },
  ],
  events: [
    { id:1, slug:"midnight-frequencies", title:"Midnight Frequencies — Live Set",
      description:"An after-hours electronic showcase across two stages — analog synths, modular rigs, and a closing set built for the warehouse's natural reverb. Doors at 9, first set at 10.",
      category:"Music", organizer:"maya_events", start_date:"2026-07-18T21:00:00", end_date:"2026-07-19T02:00:00",
      location:"The Tin Shed, Warehouse District", is_online:false, online_link:"",
      capacity:200, status:"published", image:"https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
      is_free:false, price:35.0,
      media:[ {type:"image", url:"https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=900"},
              {type:"youtube", url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ"} ] },
    { id:2, slug:"build-week-2026", title:"Build Week: Systems & Compilers",
      description:"Three days of deep-dive talks on compiler design, kernel internals, and the occasional regrettable hardware hack. Bring a laptop — every talk ends in a live demo.",
      category:"Technology", organizer:"maya_events", start_date:"2026-08-04T09:00:00", end_date:"2026-08-06T18:00:00",
      location:"Online", is_online:true, online_link:"https://meet.example.com/buildweek",
      capacity:500, status:"published", image:"https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200",
      is_free:true, price:0, media:[ {type:"image", url:"https://images.unsplash.com/photo-1518770660439-4636190af475?w=900"} ] },
    { id:3, slug:"ink-and-light", title:"Ink & Light — Printmaking Open Studio",
      description:"A relaxed open studio for letterpress and risograph work. Bring a design or come learn the press from scratch — all materials included.",
      category:"Art & Design", organizer:"maya_events", start_date:"2026-07-02T13:00:00", end_date:"2026-07-02T18:00:00",
      location:"Lower Mill Studios, 14 Foundry Rd", is_online:false, online_link:"",
      capacity:24, status:"published", image:"https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200",
      is_free:false, price:18.0, media:[] },
    { id:4, slug:"founders-table", title:"The Founders' Table — Dinner Series",
      description:"A small, off-the-record dinner for early-stage founders. Five courses, no pitches — just the conversations that don't happen at conferences.",
      category:"Business", organizer:"maya_events", start_date:"2026-07-25T19:00:00", end_date:"2026-07-25T22:30:00",
      location:"Private Room, Eastside Kitchen", is_online:false, online_link:"",
      capacity:16, status:"published", image:"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200",
      is_free:false, price:85.0, media:[] },
    { id:5, slug:"sunrise-5k", title:"Sunrise 5K — Riverside Run",
      description:"A low-key timed 5K along the river path, finishing with coffee and pastries at the boathouse. All paces welcome.",
      category:"Sports", organizer:"maya_events", start_date:"2026-06-28T06:30:00", end_date:"2026-06-28T08:30:00",
      location:"Boathouse Park, River Trail", is_online:false, online_link:"",
      capacity:0, status:"published", image:"https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=1200",
      is_free:true, price:0, media:[] },
  ],
  bookings: [
    { id:501, event:null, status:"confirmed", ticket_code:"a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c", notes:"", amount_paid:35.0, checked_in:false, registered_at:"2026-06-10T14:22:00" },
    { id:502, event:null, status:"waitlisted", ticket_code:"f9e8d7c6-b5a4-4938-8271-6f5e4d3c2b1a", notes:"Left-handed, if that matters for the press", amount_paid:0, checked_in:false, registered_at:"2026-06-12T09:05:00" },
    { id:503, event:null, status:"attended", ticket_code:"11223344-5566-4778-99aa-bbccddeeff00", notes:"", amount_paid:0, checked_in:true, registered_at:"2026-06-01T11:00:00" },
  ],
  eventRegistrations: [
    { id:901, attendee:"Ravi Kumar", mob:"9876543210", status:"confirmed", amount_paid:35.0, checked_in:false, registered_at:"2026-06-10T14:22:00" },
    { id:902, attendee:"Priya Nair", mob:"9988776655", status:"confirmed", amount_paid:35.0, checked_in:true, registered_at:"2026-06-09T10:15:00" },
    { id:903, attendee:"Dev Patel", mob:"9871234560", status:"waitlisted", amount_paid:0, checked_in:false, registered_at:"2026-06-13T08:40:00" },
    { id:904, attendee:"Anita Roy", mob:"9001122334", status:"cancelled", amount_paid:0, checked_in:false, registered_at:"2026-06-05T16:00:00" },
    { id:905, attendee:"Karan Mehta", mob:"9112233445", status:"confirmed", amount_paid:35.0, checked_in:true, registered_at:"2026-06-08T19:30:00" },
  ],
  payments: [
    { id:1, event_title:"Midnight Frequencies — Live Set", amount:35.0, date:"2026-06-10T14:22:00", status:"paid", method:"Card •••• 4242" },
    { id:2, event_title:"Ink & Light — Printmaking Open Studio", amount:18.0, date:"2026-06-12T09:05:00", status:"pending", method:"Card •••• 4242" },
  ],
  orgRevenue: [
    { event:"Midnight Frequencies — Live Set", sold:142, capacity:200, revenue:4970, payout:"paid" },
    { event:"Ink & Light — Printmaking Open Studio", sold:19, capacity:24, revenue:342, payout:"pending" },
    { event:"The Founders' Table — Dinner Series", sold:16, capacity:16, revenue:1360, payout:"pending" },
  ],
  notifications: [
    { id:1, message:"You're confirmed for Midnight Frequencies — Live Set.", time:"2h ago", read:false },
    { id:2, message:"A spot opened up — you've been moved to confirmed for Ink & Light.", time:"1d ago", read:false },
    { id:3, message:"Sunrise 5K starts tomorrow at 6:30 AM.", time:"2d ago", read:true },
  ],
  regTrend: [8,14,11,22,31,19,9],
  statusBreakdown: { confirmed:142, waitlisted:12, attended:88, cancelled:6 },
};
// wire bookings to event objects
DEMO.bookings[0].event = DEMO.events[0];
DEMO.bookings[1].event = DEMO.events[2];
DEMO.bookings[2].event = DEMO.events[4];
