// ============================================
// BADMINTON BOOKING SYSTEM — localStorage mode
// ============================================

const COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"];

const COURT_PRICES = {
  "Court 1": 35,
  "Court 2": 65,
  "Court 3": 45,
  "Court 4": 20
};

const COURT_LABELS = {
  "Court 1": "Court 1 — RM35/hr (Standard)",
  "Court 2": "Court 2 — RM65/hr (Premium)",
  "Court 3": "Court 3 — RM45/hr (Elite)",
  "Court 4": "Court 4 — RM20/hr (Basic)"
};

// Source of truth for each court's fixed type/price — used to auto-repair
// any "courts" data in localStorage that is missing or out of date.
const COURT_DEFAULTS = {
  "Court 1": { court_type: "Standard", price_per_hour: 35 },
  "Court 2": { court_type: "Premium", price_per_hour: 65 },
  "Court 3": { court_type: "Elite", price_per_hour: 45 },
  "Court 4": { court_type: "Basic", price_per_hour: 20 }
};

const MEMBER_DISCOUNT = {
  "Monthly": 0.05,
  "Quarterly": 0.10,
  "Yearly": 0.15,
};

const TIME_SLOTS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
  "6:00 PM - 8:00 PM",
  "8:00 PM - 10:00 PM",
  "10:00 PM - 11:00 PM"
];

// Slot duration in hours
const SLOT_HOURS = {
  "8:00 AM - 10:00 AM": 2,
  "10:00 AM - 12:00 PM": 2,
  "12:00 PM - 2:00 PM": 2,
  "2:00 PM - 4:00 PM": 2,
  "4:00 PM - 6:00 PM": 2,
  "6:00 PM - 8:00 PM": 2,
  "8:00 PM - 10:00 PM": 2,
  "10:00 PM - 11:00 PM": 1
};

const page = document.body.dataset.page;

// ---- localStorage helpers ----
function getDB(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function setDB(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ---- Seed default data ----
function seedData() {
  if (!localStorage.getItem("seeded")) {
    setDB("users", [{
      user_id: 1,
      full_name: "System Administrator",
      email: "admin@gmail.com",
      password: "admin123",
      phone_number: "0191234567",
      role: "Admin"
    }]);
    setDB("memberships", []);
    setDB("bookings", []);
    setDB("payments", []);
    setDB("nextUserId", 2);
    setDB("nextBookingId", 1);
    setDB("nextPaymentId", 1);
    localStorage.setItem("seeded", "1");
  }

  // Migration-safe seeding: runs even for installs that were seeded
  // before COURTS/BOOKING_HISTORY existed, so existing users don't lose data.
  if (!localStorage.getItem("courts")) {
    setDB("courts", [
      { court_id: 1, court_name: "Court 1", court_type: "Standard", price_per_hour: 35, status: "Available" },
      { court_id: 2, court_name: "Court 2", court_type: "Premium", price_per_hour: 65, status: "Available" },
      { court_id: 3, court_name: "Court 3", court_type: "Elite", price_per_hour: 45, status: "Available" },
      { court_id: 4, court_name: "Court 4", court_type: "Basic", price_per_hour: 20, status: "Available" }
    ]);
  }
  if (!localStorage.getItem("booking_history")) {
    setDB("booking_history", []);
    setDB("nextHistoryId", 1);
  }

  repairCourtsData();
}

// Fixes any court records that are missing or have wrong court_type /
// price_per_hour / status — e.g. leftover data from an older version of
// this app. Runs on every page load, so it self-heals automatically.
function repairCourtsData() {
  let courts = getDB("courts");
  if (!courts || courts.length === 0) {
    courts = Object.keys(COURT_DEFAULTS).map((name, i) => ({
      court_id: i + 1,
      court_name: name,
      court_type: COURT_DEFAULTS[name].court_type,
      price_per_hour: COURT_DEFAULTS[name].price_per_hour,
      status: "Available"
    }));
    setDB("courts", courts);
    return;
  }

  let changed = false;
  courts = courts.map((c, i) => {
    const defaults = COURT_DEFAULTS[c.court_name];
    const fixed = { ...c };
    if (!fixed.court_id) { fixed.court_id = i + 1; changed = true; }
    if (defaults && fixed.court_type !== defaults.court_type) { fixed.court_type = defaults.court_type; changed = true; }
    if (defaults && fixed.price_per_hour !== defaults.price_per_hour) { fixed.price_per_hour = defaults.price_per_hour; changed = true; }
    if (!fixed.status) { fixed.status = "Available"; changed = true; }
    return fixed;
  });

  if (changed) setDB("courts", courts);
}

// ---- Utilities ----
function today() { return new Date().toISOString().slice(0, 10); }

function requireUser() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) window.location.href = "index.html";
  return user;
}

function fillSelect(el, options, labelMap) {
  if (!el) return;
  el.innerHTML = options.map(o => `<option value="${o}">${labelMap ? labelMap[o] : o}</option>`).join("");
}

function addMonths(dateValue, months) {
  const d = new Date(dateValue);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
}

function statusBadge(status) {
  const map = { 
    Pending: 'badge-pending', 
    Approved: 'badge-approved', 
    Rejected: 'badge-rejected', 
    Paid: 'badge-paid', 
    Refunded: 'badge-rejected', 
    Active: 'badge-active', 
    None: 'badge-none',
    Expired: 'badge-rejected',
    Cancelled: 'badge-rejected',
    Available: 'badge-approved',
    'Under Maintenance': 'badge-pending'
  };
  
  const inlineStyle = `
    display: inline-block; 
    white-space: nowrap; 
    padding: 4px 10px; 
    font-size: 0.78rem; 
    font-weight: 600; 
    text-transform: capitalize;
  `;
  
  return `<span class="badge ${map[status] || 'badge-none'}" style="${inlineStyle}">${status}</span>`;
}

function getActiveMembership(userId) {
  const memberships = getDB("memberships");
  const mem = memberships.find(m => m.user_id === userId && m.status === "Active");
  if (!mem) return null;
  if (mem.expiry_date && mem.expiry_date < today()) return null;
  return mem;
}

function getDiscount(userId) {
  const mem = getActiveMembership(userId);
  if (!mem) return 0;
  return MEMBER_DISCOUNT[mem.membership_type] || 0;
}

// ---- Courts & Booking History helpers ----
function getCourts() { return getDB("courts"); }

function isCourtAvailable(courtName) {
  const court = getCourts().find(c => c.court_name === courtName);
  return court ? court.status === "Available" : true;
}

function logBookingHistory(bookingId, action, remarks) {
  const history = getDB("booking_history");
  const newId = getDB("nextHistoryId", 1);
  history.push({
    history_id: newId,
    booking_id: bookingId,
    action,
    action_date: new Date().toLocaleString('en-US'),
    remarks: remarks || ""
  });
  setDB("booking_history", history);
  setDB("nextHistoryId", newId + 1);
}

function calcAmount(court, slot, userId) {
  const rate = COURT_PRICES[court] || 20;
  const hours = SLOT_HOURS[slot] || 2;
  const base = rate * hours;
  const discountRate = userId ? getDiscount(userId) : 0;
  const discount = base * discountRate;
  return { base, discount, total: base - discount, discountRate };
}

// ---- Menukar nama dinamik untuk Sidebar & Dashboard Ucapan secara automatik ----
function initSidebar() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  
  // Kemas kini nama di Sidebar (Semua halaman)
  const nameEl = document.getElementById("sidebarName");
  if (nameEl && user) {
    nameEl.textContent = user.full_name || "User";
  }

  // Kemas kini nama di Welcome Message (Dashboard sahaja)
  const welcomeEl = document.getElementById("welcomeName");
  if (welcomeEl && user) {
    welcomeEl.textContent = user.full_name || "Player";
  }

  const logoutBtn = document.getElementById("logoutButton") || document.getElementById("adminLogout");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

// ============================================
// AUTH
// ============================================
function initAuthPages() {
  if (page === "login") {
    const togglePassword = document.getElementById("togglePassword");
    const loginPassword = document.getElementById("loginPassword");

    if (togglePassword && loginPassword) {
      togglePassword.addEventListener("click", function () {
        const type = loginPassword.getAttribute("type") === "password" ? "text" : "password";
        loginPassword.setAttribute("type", type);
        this.textContent = type === "password" ? "👁️" : "🔒"; 
        this.style.color = type === "password" ? "#888" : "var(--red)";
      });
    }

    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;
        const msg = document.getElementById("loginMessage");
        if (msg) { msg.textContent = ""; msg.className = "message"; }
        const users = getDB("users");
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
          localStorage.setItem("currentUser", JSON.stringify(user));
          window.location.href = user.role === "Admin" ? "admin_dashboard.html" : "dashboard.html";
        } else {
          if (msg) msg.textContent = "Invalid email or password.";
        }
      });
    }
  }

  if (page === "register") {
    document.getElementById("registerBtn").addEventListener("click", () => {
      const name = document.getElementById("registerName").value.trim();
      const email = document.getElementById("registerEmail").value.trim().toLowerCase();
      const password = document.getElementById("registerPassword").value;
      const phone = document.getElementById("registerPhone").value.trim();
      const msg = document.getElementById("registerMessage");
      msg.textContent = ""; msg.className = "message";
      if (!name || !email || !password || !phone) { msg.textContent = "Please fill in all fields."; return; }
      if (password.length < 6) { msg.textContent = "Password must be at least 6 characters."; return; }
      const users = getDB("users");
      if (users.find(u => u.email === email)) { msg.textContent = "Email already registered."; return; }
      const newId = getDB("nextUserId", 2);
      users.push({ user_id: newId, full_name: name, email, password, phone_number: phone, role: "Customer" });
      setDB("users", users);
      setDB("nextUserId", newId + 1);
      alert("Registration successful! Please log in.");
      window.location.href = "index.html";
    });
  }
}

// ============================================
// DASHBOARD
// ============================================
function initDashboard() {
  requireUser();
}

// ============================================
// PROFILE — DIKEMAS KINI (DENGAN FIX AVATAR)
// ============================================
function initProfile() {
  const user = requireUser();
  
  if (document.getElementById("profileName")) document.getElementById("profileName").value = user.full_name || "";
  if (document.getElementById("profilePhone")) document.getElementById("profilePhone").value = user.phone_number || "";
  
  const membershipTypeEl = document.getElementById("profileMembershipType");
  if (membershipTypeEl) {
    const activeMem = getActiveMembership(user.user_id);
    if (activeMem) {
      membershipTypeEl.innerHTML = `<span style="color:#16a34a; font-weight:bold;">Active</span> (${activeMem.membership_type})`;
    } else {
      membershipTypeEl.innerHTML = `<span style="color:#aaa;">No Active Plan</span>`;
    }
  }

  const avatarImage = document.getElementById("avatarImage");
  const avatarInput = document.getElementById("avatarInput");
  const avatarSvg = document.getElementById("avatarSvg");

  // PAPARAN GAMBAR: Jika user memang dah ada gambar profil, tunjuk gambar & sorok SVG kelabu
  if (avatarImage && user.profile_picture) {
    avatarImage.src = user.profile_picture;
    avatarImage.style.display = "block";
    avatarImage.style.width = "100%";
    avatarImage.style.height = "100%";
    avatarImage.style.objectFit = "cover";
    if (avatarSvg) avatarSvg.style.display = "none";
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = function() {
        const base64String = reader.result;
        
        // Terus tukar paparan di skrin supaya nampak perubahan real-time
        if (avatarImage) {
          avatarImage.src = base64String;
          avatarImage.style.display = "block";
          avatarImage.style.width = "100%";
          avatarImage.style.height = "100%";
          avatarImage.style.objectFit = "cover";
        }
        if (avatarSvg) avatarSvg.style.display = "none";

        // Simpan ke dalam database localStorage
        const users = getDB("users");
        const idx = users.findIndex(u => u.user_id === user.user_id);
        if (idx !== -1) {
          users[idx].profile_picture = base64String;
          setDB("users", users);
          localStorage.setItem("currentUser", JSON.stringify(users[idx]));
          
          // Beri sedikit masa (300ms) untuk pelayar stabilkan storan sebelum refresh
          setTimeout(() => window.location.reload(), 300);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("profileBtn").addEventListener("click", () => {
    const msg = document.getElementById("profileMessage");
    msg.textContent = ""; msg.className = "message";
    const name = document.getElementById("profileName").value.trim();
    const phone = document.getElementById("profilePhone").value.trim();
    const password = document.getElementById("profilePassword").value;
    
    const users = getDB("users");
    const idx = users.findIndex(u => u.user_id === user.user_id);
    if (idx === -1) { msg.textContent = "User not found."; return; }
    
    users[idx].full_name = name;
    users[idx].phone_number = phone;
    if (password) users[idx].password = password;
    
    setDB("users", users);
    localStorage.setItem("currentUser", JSON.stringify(users[idx]));
    msg.textContent = "Profile updated successfully!";
    msg.className = "message success";
    
    setTimeout(() => window.location.reload(), 1000);
  });
}

// ============================================
// MEMBERSHIP
// ============================================
function initMembership() {
  requireUser();
  const membershipStart = document.getElementById("membershipStart");
  const membershipExpiry = document.getElementById("membershipExpiry");
  const membershipType = document.getElementById("membershipType");
  const amountDisplay = document.getElementById("paymentAmountDisplay");
  const membershipBtn = document.getElementById("membershipBtn");

  if (membershipStart) membershipStart.value = today();

  const prices = { 'Monthly': '30.00', 'Quarterly': '80.00', 'Yearly': '300.00' };

  const updateExpiry = () => {
    if (!membershipType || !membershipExpiry || !membershipStart) return;
    const months = { Monthly: 1, Quarterly: 3, Yearly: 12 }[membershipType.value];
    membershipExpiry.value = membershipStart.value ? addMonths(membershipStart.value, months) : "";
    if (amountDisplay) amountDisplay.textContent = 'RM ' + prices[membershipType.value];
  };

  if (membershipType) membershipType.addEventListener("change", updateExpiry);
  if (membershipStart) membershipStart.addEventListener("change", updateExpiry);
  updateExpiry();

  if (membershipBtn) {
    membershipBtn.addEventListener("click", () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      const msg = document.getElementById("membershipMessage");
      if (!msg) return;

      const chosenPrice = prices[membershipType.value];

      const pendingMembership = {
        user_id: user.user_id,
        membership_type: membershipType.value,
        start_date: membershipStart.value,
        expiry_date: membershipExpiry.value,
        amount: chosenPrice,
        status: "Pending"
      };

      setDB("pendingMembershipData", pendingMembership);
      localStorage.setItem("isMembershipPayment", "true");

      msg.textContent = "Application submitted! Redirecting to payment page...";
      msg.className = "message success";

      setTimeout(() => {
        window.location.href = "payment.html";
      }, 1200);
    });
  }
}

// ============================================
// BOOKING
// ============================================
function initBooking() {
  const user = requireUser();
  const bookingCourt = document.getElementById("bookingCourt");
  const bookingSlot = document.getElementById("bookingSlot");
  const bookingDate = document.getElementById("bookingDate");
  const bookingMessage = document.getElementById("bookingMessage");
  const priceDisplay = document.getElementById("priceDisplay");

  const availableCourtNames = getCourts().filter(c => c.status === "Available").map(c => c.court_name);
  fillSelect(bookingCourt, availableCourtNames, COURT_LABELS);
  fillSelect(bookingSlot, TIME_SLOTS);
  bookingDate.value = today();

  const mem = getActiveMembership(user.user_id);
  const discountPct = mem ? Math.round((MEMBER_DISCOUNT[mem.membership_type] || 0) * 100) : 0;
  document.getElementById("memberStatus").textContent = mem ? mem.status : "None";
  document.getElementById("memberType").textContent = mem
    ? `${mem.membership_type} — ${discountPct}% discount applied`
    : "No active plan";

  function updatePrice() {
    const court = bookingCourt.value;
    const slot = bookingSlot.value;
    const { base, discount, total } = calcAmount(court, slot, user.user_id);
    if (priceDisplay) {
      priceDisplay.innerHTML = mem
        ? `<span style="text-decoration:line-through;color:#aaa;font-size:0.9em;">RM${base.toFixed(2)}</span>
           <span style="color:var(--red);font-weight:700;font-size:1.1em;margin-left:8px;">RM${total.toFixed(2)}</span>
           <span style="color:#16a34a;font-size:0.8em;margin-left:6px;">(${discountPct}% member discount)</span>`
        : `<span style="font-weight:700;font-size:1.1em;">RM${total.toFixed(2)}</span>`;
    }
  }

  bookingCourt.addEventListener("change", updatePrice);
  bookingSlot.addEventListener("change", updatePrice);
  updatePrice();

  document.getElementById("bookingBtn").addEventListener("click", () => {
    bookingMessage.textContent = ""; bookingMessage.className = "message";
    const court = bookingCourt.value;
    const date = bookingDate.value;
    const slot = bookingSlot.value;
    if (!isCourtAvailable(court)) { bookingMessage.textContent = "This court is currently under maintenance. Please choose another court."; return; }

    const bookings = getDB("bookings");
    const conflict = bookings.find(b => b.court_name === court && b.booking_date === date && b.slot === slot && b.status !== "Rejected");
    if (conflict) { bookingMessage.textContent = "This slot is already booked. Please choose another."; return; }
    const { base, discount, total } = calcAmount(court, slot, user.user_id);
    const [startTime, endTime] = slot.split(" - ");
    const newId = getDB("nextBookingId", 1);
    
    bookings.push({
      booking_id: newId,
      user_id: user.user_id,
      court_name: court,
      booking_date: date,
      slot, start_time: startTime, end_time: endTime,
      base_price: base,
      discount_amount: discount,
      total_price: total,
      status: "Pending",
      created_at: new Date().toLocaleString('en-US') 
    });

    setDB("bookings", bookings);
    setDB("nextBookingId", newId + 1);
    logBookingHistory(newId, "Created", `Booking submitted by ${user.full_name}`);

    localStorage.setItem("pendingPaymentId", newId);
    localStorage.setItem("isMembershipPayment", "false");

    bookingMessage.textContent = "Booking locked! Redirecting to payment page...";
    bookingMessage.className = "message success";

    setTimeout(() => {
      window.location.href = "payment.html";
    }, 1000);
  });
}

// ============================================
// PAYMENT
// ============================================
function initPayment() {
  const user = requireUser();
  const paymentMessage = document.getElementById("paymentMessage");
  
  if (document.getElementById("paymentDate")) {
    document.getElementById("paymentDate").value = today();
  }

  const isMembership = localStorage.getItem("isMembershipPayment") === "true";

  if (isMembership) {
    const pendingMem = getDB("pendingMembershipData", null);
    if (!pendingMem) {
      if (paymentMessage) paymentMessage.textContent = "No pending membership found.";
      if (document.getElementById("confirmPaymentBtn")) document.getElementById("confirmPaymentBtn").disabled = true;
      return;
    }

    if (document.getElementById("paymentBookingId")) document.getElementById("paymentBookingId").textContent = "MEMBERSHIP — " + pendingMem.membership_type.toUpperCase();
    if (document.getElementById("paymentBookingIdHidden")) document.getElementById("paymentBookingIdHidden").value = "0";
    if (document.getElementById("paymentAmount")) document.getElementById("paymentAmount").value = pendingMem.amount;
    if (document.getElementById("paymentAmountDisplay")) document.getElementById("paymentAmountDisplay").textContent = parseFloat(pendingMem.amount).toFixed(2);

    const confirmBtn = document.getElementById("confirmPaymentBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        if (paymentMessage) { paymentMessage.textContent = ""; paymentMessage.className = "message"; }
        
        const payments = getDB("payments");
        const nextPaymentId = getDB("nextPaymentId", 1);
        const memberships = getDB("memberships");

        payments.push({
          payment_id: nextPaymentId,
          booking_id: null,
          payment_method: document.getElementById("paymentMethod").value,
          amount: parseFloat(pendingMem.amount),
          payment_date: document.getElementById("paymentDate").value,
          payment_status: "Paid",
          transaction_id: `TXN-MEM-${Date.now()}`
        });
        setDB("payments", payments);
        setDB("nextPaymentId", nextPaymentId + 1);

        pendingMem.status = "Active";
        const existing = memberships.findIndex(m => m.user_id === user.user_id);
        if (existing >= 0) memberships[existing] = pendingMem;
        else memberships.push(pendingMem);
        setDB("memberships", memberships);

        localStorage.removeItem("pendingMembershipData");
        localStorage.removeItem("isMembershipPayment");

        if (paymentMessage) {
          paymentMessage.textContent = "Membership Paid Successfully! Redirecting...";
          paymentMessage.className = "message success";
        }
        
        localStorage.setItem("lastPaymentType", "membership");
        setTimeout(() => window.location.href = "payment_success.html", 1000);
      });
    }

  } else {
    const pendingId = parseInt(localStorage.getItem("pendingPaymentId"));
    const bookings = getDB("bookings");
    const booking = pendingId
      ? bookings.find(b => b.booking_id === pendingId)
      : bookings.filter(b => b.user_id === user.user_id).reverse().find(b => {
          const payments = getDB("payments");
          return !payments.find(p => p.booking_id === b.booking_id);
        });

    if (!booking) {
      if (paymentMessage) paymentMessage.textContent = "No pending booking found.";
      if (document.getElementById("confirmPaymentBtn")) document.getElementById("confirmPaymentBtn").disabled = true;
      return;
    }

    if (document.getElementById("paymentBookingId")) document.getElementById("paymentBookingId").textContent = booking.booking_id;
    if (document.getElementById("paymentBookingIdHidden")) document.getElementById("paymentBookingIdHidden").value = booking.booking_id;
    if (document.getElementById("paymentAmount")) document.getElementById("paymentAmount").value = booking.total_price;
    if (document.getElementById("paymentAmountDisplay")) document.getElementById("paymentAmountDisplay").textContent = parseFloat(booking.total_price).toFixed(2);

    const breakdownEl = document.getElementById("paymentBreakdown");
    if (breakdownEl && booking.discount_amount > 0) {
      const pct = Math.round((booking.discount_amount / booking.base_price) * 100);
      breakdownEl.innerHTML = `
        <div style="font-size:0.82rem;color:#888;margin-top:8px;padding-top:8px;border-top:1px solid #2a2a2a;">
          Original: <span style="text-decoration:line-through;">RM${parseFloat(booking.base_price).toFixed(2)}</span> &nbsp;
          Discount: <span style="color:#16a34a;">-RM${parseFloat(booking.discount_amount).toFixed(2)}</span> (${pct}% member)
        </div>`;
    }

    const confirmBtn = document.getElementById("confirmPaymentBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        if (paymentMessage) { paymentMessage.textContent = ""; paymentMessage.className = "message"; }
        const payments = getDB("payments");
        const newPayId = getDB("nextPaymentId", 1);
        payments.push({
          payment_id: newPayId,
          booking_id: booking.booking_id,
          payment_method: document.getElementById("paymentMethod").value,
          amount: booking.total_price,
          payment_date: document.getElementById("paymentDate").value,
          payment_status: "Paid",
          transaction_id: `TXN-${Date.now()}`
        });
        setDB("payments", payments);
        setDB("nextPaymentId", newPayId + 1);
        const allBookings = getDB("bookings");
        const idx = allBookings.findIndex(b => b.booking_id === booking.booking_id);
        if (idx >= 0) { allBookings[idx].status = "Approved"; setDB("bookings", allBookings); }
        localStorage.removeItem("pendingPaymentId");
        
        if (paymentMessage) {
          paymentMessage.textContent = "Payment confirmed! Redirecting...";
          paymentMessage.className = "message success";
        }

        localStorage.setItem("lastPaymentType", "booking");
        setTimeout(() => window.location.href = "payment_success.html", 1000);
      });
    }
  }

  const cancelBtn = document.getElementById("cancelPayment");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      localStorage.removeItem("pendingPaymentId");
      localStorage.removeItem("isMembershipPayment");
      window.location.href = "dashboard.html";
    });
  }
}

// ============================================
// AVAILABILITY
// ============================================
function renderAvailability() {
    const court = document.getElementById("availabilityCourt").value;
    const date = document.getElementById("availabilityDate").value;
    const tbody = document.getElementById("availabilityRows");

    if (!isCourtAvailable(court)) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:16px;color:#dc2626;font-weight:600;">This court is currently under maintenance.</td></tr>`;
        return;
    }

    const bookings = getDB("bookings");

    const bookedSlots = bookings
        .filter(
            b =>
                b.court_name === court &&
                b.booking_date === date &&
                b.status !== "Rejected"
        )
        .map(b => b.slot);

    tbody.innerHTML = TIME_SLOTS.map(slot => {
        const isBooked = bookedSlots.includes(slot);
        const statusHtml = isBooked
            ? '<span class="avail-booked">Booked</span>'
            : '<span class="avail-available">Available</span>';

        return `
            <tr>
                <td>${slot}</td>
                <td>${statusHtml}</td>
            </tr>
        `;
    }).join("");
}

function initAvailability() {
  requireUser();
  fillSelect(document.getElementById("availabilityCourt"), COURTS, COURT_LABELS);
  document.getElementById("availabilityDate").value = today();
  document.getElementById("checkAvailBtn").addEventListener("click", renderAvailability);
  renderAvailability();
}

// ============================================
// HISTORY
// ============================================
function initHistory() {
    const user = requireUser();
    const historyRows = document.getElementById("historyRows");
    const historyEmpty = document.getElementById("historyEmpty");

    const bookings = getDB("bookings")
        .filter(b => b.user_id === user.user_id)
        .reverse();

    const payments = getDB("payments");

    if (bookings.length === 0) {
        historyEmpty.textContent = "No bookings yet. Book your first court!";
        historyRows.innerHTML = "";
        return;
    }

    historyEmpty.textContent = "";

    historyRows.innerHTML = bookings.map(b => {
        const payment = payments.find(p => p.booking_id === b.booking_id);
        let currentPaymentStatus = payment ? payment.payment_status : "Pending";
        if (b.status === "Rejected") {
            currentPaymentStatus = "Refunded";
        }

        return `
            <tr>
                <td>#${b.booking_id}</td>
                <td>${b.court_name}</td>
                <td>${b.booking_date}</td>
                <td>${b.start_time} - ${b.end_time}</td>
                <td>${statusBadge(b.status)}</td>
                <td>${statusBadge(currentPaymentStatus)}</td>
            </tr>
        `;
    }).join("");
}

// ============================================
// ADMIN DASHBOARD
// ============================================
function initAdminDashboard() {
  requireUser();

  function loadUsers() {
    const users = (getDB("users") || []).filter(u => u.role === "Customer");
    const memberships = getDB("memberships") || [];
    const tbody = document.getElementById("adminUsersList");
    if (!tbody) return;
    
    tbody.innerHTML = users.length
      ? users.map(u => {
          const userMem = memberships.find(m => m.user_id === u.user_id);
          const memType = userMem ? userMem.membership_type : "Non-Member";

          return `<tr>
            <td style="white-space: nowrap; padding: 12px 8px;">#${u.user_id}</td>
            <td style="white-space: nowrap; padding: 12px 8px; font-weight: 600;">${u.full_name}</td>
            <td style="white-space: nowrap; padding: 12px 8px;">${u.email}</td>
            <td style="white-space: nowrap; padding: 12px 8px;">${u.phone_number}</td>
            <td style="white-space: nowrap; padding: 12px 8px;"><span style="color: #16a34a; font-weight: 600;">${memType}</span></td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="5" style="text-align:center;padding:20px;color:#888;">No users registered yet.</td></tr>`;
  }

  function populateCourtFilter() {
    const filterCourt = document.getElementById("filterCourt");
    if (!filterCourt) return;
    const courts = getCourts();
    filterCourt.innerHTML = `<option value="">All Courts</option>` +
      courts.map(c => `<option value="${c.court_name}">${c.court_name}</option>`).join("");
  }

  function loadBookings() {
    const tbody = document.getElementById("adminBookingsList");
    if (!tbody) return;

    const searchName = document.getElementById("searchName")?.value.trim().toLowerCase() || "";
    const filterStatus = document.getElementById("filterStatus")?.value || "";
    const filterDate = document.getElementById("filterDate")?.value || "";
    const filterCourt = document.getElementById("filterCourt")?.value || "";

    const bookings = getDB("bookings") || [];
    const users = getDB("users") || [];

    let filtered = [...bookings].reverse();

    if (searchName) {
      filtered = filtered.filter(b => {
        const player = users.find(u => u.user_id === b.user_id);
        return player && player.full_name.toLowerCase().includes(searchName);
      });
    }

    if (filterStatus) {
      filtered = filtered.filter(b => b.status === filterStatus);
    }

    if (filterDate) {
      filtered = filtered.filter(b => b.booking_date === filterDate);
    }

    if (filterCourt) {
      filtered = filtered.filter(b => b.court_name === filterCourt);
    }

    tbody.innerHTML = filtered.length
      ? filtered.map(b => {
          const player = users.find(u => u.user_id === b.user_id) || { full_name: "Unknown", phone_number: "-" };
          let actionButtons = "";
          const rescheduleBtn = `<button onclick="handleBookingReschedule(${b.booking_id})" style="background:#2563eb; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:600; margin-left:4px;">Reschedule</button>`;
          if (b.status === "Pending") {
            actionButtons = `
              <button onclick="handleBookingAction(${b.booking_id}, 'Approved')" style="background:#16a34a; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:600; margin-right:4px;">Approve</button>
              <button onclick="handleBookingAction(${b.booking_id}, 'Rejected')" style="background:#dc2626; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:600;">Reject</button>
              ${rescheduleBtn}
            `;
          } else if (b.status === "Approved") {
            actionButtons = `
              <button onclick="handleBookingAction(${b.booking_id}, 'Rejected')" style="background:#dc2626; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:600;">Reject</button>
              ${rescheduleBtn}
            `;
          } else {
            actionButtons = `
              <button onclick="handleBookingAction(${b.booking_id}, 'Approved')" style="background:#16a34a; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:600;">Approve</button>
            `;
          }

          const bookingMadeOn = b.created_at || "-";

          return `<tr>
            <td style="padding: 12px 8px;">#${b.booking_id}</td>
            <td style="padding: 12px 8px; font-weight:600; font-size:0.85rem;">${player.full_name}<br><small style="color:#666; font-weight:400;">${player.phone_number}</small></td>
            <td style="padding: 12px 8px; font-size:0.85rem;">${b.court_name}</td>
            <td style="padding: 12px 8px; font-size:0.82rem; min-width:120px;">${b.booking_date}<br><small style="color:#666;">${b.slot}</small></td>
            <td style="padding: 12px 8px; font-weight:700; color:var(--red); font-size:0.85rem; min-width:90px; white-space:nowrap;">RM${parseFloat(b.total_price).toFixed(2)}</td>
            <td style="padding: 12px 8px;">${statusBadge(b.status)}</td>
            <td style="padding: 12px 8px; font-size:0.75rem; color:#666; min-width:40px;">${bookingMadeOn}</td>
            <td style="padding: 12px 8px;">${actionButtons}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888;">No bookings found matching filters.</td></tr>`;
  }

  function loadMemberships() {
    const tbody = document.getElementById("adminMembershipsList");
    if (!tbody) return;

    const memberships = getDB("memberships") || [];
    const users = getDB("users") || [];
    const todayStr = today();

    tbody.innerHTML = memberships.length
      ? memberships.map(m => {
          const user = users.find(u => u.user_id === m.user_id) || { full_name: "Unknown" };
          const daysLeft = Math.ceil((new Date(m.expiry_date) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
          const expiringSoon = m.status === "Active" && daysLeft >= 0 && daysLeft <= 7;
          const expiryDisplay = expiringSoon
            ? `${m.expiry_date}<br><span style="color:#f59e0b;font-weight:700;font-size:0.72rem;">⚠ Expiring in ${daysLeft}d — follow up</span>`
            : m.expiry_date;

          return `<tr>
            <td style="padding:12px 8px;font-weight:600;">${user.full_name}</td>
            <td style="padding:12px 8px;">${m.membership_type}</td>
            <td style="padding:12px 8px;">${m.start_date}</td>
            <td style="padding:12px 8px;font-size:0.85rem;">${expiryDisplay}</td>
            <td style="padding:12px 8px;">${statusBadge(m.status)}</td>
            <td style="padding:12px 8px;">
              <select onchange="handleMembershipStatusChange(${m.user_id}, this.value)" style="padding:4px 6px;border-radius:4px;">
                <option value="Active" ${m.status === "Active" ? "selected" : ""}>Active</option>
                <option value="Expired" ${m.status === "Expired" ? "selected" : ""}>Expired</option>
                <option value="Cancelled" ${m.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
              </select>
            </td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">No memberships found.</td></tr>`;
  }

  function loadCourts() {
    const tbody = document.getElementById("adminCourtsList");
    if (!tbody) return;

    const courts = getCourts();
    tbody.innerHTML = courts.length
      ? courts.map(c => `<tr>
          <td style="padding:12px 8px;">#${c.court_id}</td>
          <td style="padding:12px 8px;font-weight:600;">${c.court_name}</td>
          <td style="padding:12px 8px;">${c.court_type}</td>
          <td style="padding:12px 8px;">RM${parseFloat(c.price_per_hour).toFixed(2)}/hr</td>
          <td style="padding:12px 8px;">${statusBadge(c.status)}</td>
          <td style="padding:12px 8px;">
            <select onchange="handleCourtStatusChange(${c.court_id}, this.value)" style="padding:4px 6px;border-radius:4px;">
              <option value="Available" ${c.status === "Available" ? "selected" : ""}>Available</option>
              <option value="Under Maintenance" ${c.status === "Under Maintenance" ? "selected" : ""}>Under Maintenance</option>
            </select>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">No courts configured.</td></tr>`;
  }

  function loadBookingHistory() {
    const tbody = document.getElementById("adminHistoryList");
    if (!tbody) return;

    const history = getDB("booking_history") || [];
    tbody.innerHTML = history.length
      ? [...history].reverse().map(h => `<tr>
          <td style="padding:10px 8px;">#${h.booking_id}</td>
          <td style="padding:10px 8px;">${h.action}</td>
          <td style="padding:10px 8px;font-size:0.8rem;color:#666;white-space:nowrap;">${h.action_date}</td>
          <td style="padding:10px 8px;font-size:0.85rem;">${h.remarks || "-"}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="text-align:center;padding:16px;color:#888;">No history recorded yet.</td></tr>`;
  }

  function loadReports() {
    const bookings = getDB("bookings") || [];
    const payments = getDB("payments") || [];
    const memberships = getDB("memberships") || [];
    const courts = getCourts();

    const totalRevenue = payments
      .filter(p => p.payment_status === "Paid")
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText("reportTotalBookings", bookings.length);
    setText("reportTotalRevenue", `RM${totalRevenue.toFixed(2)}`);
    setText("reportApproved", bookings.filter(b => b.status === "Approved").length);
    setText("reportPending", bookings.filter(b => b.status === "Pending").length);
    setText("reportRejected", bookings.filter(b => b.status === "Rejected").length);
    setText("reportActiveMembers", memberships.filter(m => m.status === "Active").length);

    const usageTbody = document.getElementById("reportCourtUsage");
    if (usageTbody) {
      usageTbody.innerHTML = courts.map(c => {
        const count = bookings.filter(b => b.court_name === c.court_name).length;
        return `<tr><td style="padding:8px;">${c.court_name}</td><td style="padding:8px;">${count} booking(s)</td></tr>`;
      }).join("");
    }
  }

  const searchBtn = document.getElementById("btnSearch");
  if (searchBtn) searchBtn.addEventListener("click", loadBookings);

  const reportBtn = document.getElementById("btnGenerateReport");
  if (reportBtn) reportBtn.addEventListener("click", loadReports);

  populateCourtFilter();
  loadUsers();
  loadBookings();
  loadMemberships();
  loadCourts();
  loadBookingHistory();
  loadReports();
}

window.handleBookingAction = function(bookingId, action) {
  if (!confirm(`Mark booking #${bookingId} as ${action}?`)) return;
  const remarks = prompt("Add a remark for this action (optional):", "") || "";

  const bookings = getDB("bookings");
  const idx = bookings.findIndex(b => b.booking_id === bookingId);
  
  if (idx >= 0) { 
    bookings[idx].status = action; 
    setDB("bookings", bookings); 
    logBookingHistory(bookingId, action, remarks);
    
    if (action === "Rejected") {
      const payments = getDB("payments");
      const pIdx = payments.findIndex(p => p.booking_id === bookingId);
      if (pIdx >= 0) {
        payments[pIdx].payment_status = "Refunded";
        setDB("payments", payments);
      }
    }
    else if (action === "Approved") {
      const payments = getDB("payments");
      const pIdx = payments.findIndex(p => p.booking_id === bookingId);
      if (pIdx >= 0) {
        payments[pIdx].payment_status = "Paid";
        setDB("payments", payments);
      }
    }
  }
  
  alert(`Booking ${action} successfully.`);
  window.location.reload();
};

window.handleBookingReschedule = function(bookingId) {
  const bookings = getDB("bookings");
  const idx = bookings.findIndex(b => b.booking_id === bookingId);
  if (idx < 0) return;
  const booking = bookings[idx];

  const newDate = prompt("New date (YYYY-MM-DD):", booking.booking_date);
  if (!newDate) return;
  const newSlot = prompt("New time slot (e.g. 8:00 AM - 10:00 AM):", booking.slot);
  if (!newSlot) return;
  if (!TIME_SLOTS.includes(newSlot)) { alert("Invalid time slot. Please use one of the exact time slot labels used on the booking page."); return; }

  const conflict = bookings.find(b => b.booking_id !== bookingId && b.court_name === booking.court_name && b.booking_date === newDate && b.slot === newSlot && b.status !== "Rejected");
  if (conflict) { alert("That slot is already booked for this court. Reschedule cancelled."); return; }

  const remarks = prompt("Remarks for this reschedule (optional):", "") || "";
  const oldInfo = `${booking.booking_date}, ${booking.slot}`;
  const [startTime, endTime] = newSlot.split(" - ");

  booking.booking_date = newDate;
  booking.slot = newSlot;
  booking.start_time = startTime;
  booking.end_time = endTime;
  bookings[idx] = booking;
  setDB("bookings", bookings);

  logBookingHistory(bookingId, "Rescheduled", remarks ? `From ${oldInfo} to ${newDate}, ${newSlot}. ${remarks}` : `From ${oldInfo} to ${newDate}, ${newSlot}`);

  alert("Booking rescheduled successfully.");
  window.location.reload();
};

window.handleMembershipStatusChange = function(userId, newStatus) {
  const memberships = getDB("memberships");
  const idx = memberships.findIndex(m => m.user_id === userId);
  if (idx < 0) return;
  memberships[idx].status = newStatus;
  setDB("memberships", memberships);
  alert("Membership status updated.");
  window.location.reload();
};

window.handleCourtStatusChange = function(courtId, newStatus) {
  const courts = getDB("courts");
  const idx = courts.findIndex(c => c.court_id === courtId);
  if (idx < 0) return;
  courts[idx].status = newStatus;
  setDB("courts", courts);
  alert("Court status updated.");
  window.location.reload();
};

// ============================================
// ROUTER
// ============================================
seedData();
initSidebar();
initAuthPages();
if (page === "dashboard")    initDashboard();
if (page === "profile")      initProfile();
if (page === "membership")   initMembership();
if (page === "booking")      initBooking();
if (page === "payment")      initPayment();
if (page === "availability") initAvailability();
if (page === "history")      initHistory();
if (page === "admin")        initAdminDashboard();
