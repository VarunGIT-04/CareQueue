// ========================================================
// MediSim Portal & Healthcare Simulation Engine
// ========================================================

let currentUser = null;
let allDoctors = [];
let allAppointments = [];
let selectedDoctor = null;
let selectedSlot = null;
let selectedConsultationType = "In-Person";
let activeFilter = "All";
let callTimerInterval = null;
let callSeconds = 225; // starting at 3m 45s for demo

// Helper: Escape HTML
function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
}

// Helper: 12-hour format converter
function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

// Helper: Show dynamic toast
function showToast(title, message, type = "primary") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toastId = "toast-" + Date.now();
  const bgClass = type === "success" ? "bg-success text-white" :
                  type === "danger" ? "bg-danger text-white" :
                  type === "warning" ? "bg-warning text-dark" : "bg-primary text-white";

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <strong>${escapeHtml(title)}:</strong> ${escapeHtml(message)}
        </div>
        <button type="button" class="btn-close ${type !== 'warning' ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML("beforeend", toastHtml);
  const el = document.getElementById(toastId);
  if (window.bootstrap && window.bootstrap.Toast) {
    const toast = new bootstrap.Toast(el, { delay: 4500 });
    toast.show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
  }
}

// Helper: JSON fetcher
async function apiCall(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.href = "/login.html";
    throw new Error("Session expired. Please log in.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

// Helper: Activate Bootstrap pill tab
function activateTab(tabId) {
  const triggerEl = document.querySelector(`button[data-bs-target="#${tabId}"]`);
  if (triggerEl && window.bootstrap && window.bootstrap.Tab) {
    const tab = new bootstrap.Tab(triggerEl);
    tab.show();
  }
}

// --------------------------------------------------------
// USER & SESSION PROFILE
// --------------------------------------------------------
async function loadUser() {
  try {
    const data = await apiCall("/api/me");
    currentUser = data.user;

    // Update navigation user
    document.getElementById("nav-user-name").textContent = currentUser.name;
    document.getElementById("nav-user-email").textContent = currentUser.email;
    const initial = (currentUser.name || "U")[0].toUpperCase();
    document.getElementById("nav-user-avatar").textContent = initial;
    document.getElementById("dash-greeting-name").textContent = currentUser.name;

    // Fill profile tab
    document.getElementById("profile-name").value = currentUser.name || "";
    document.getElementById("profile-email").value = currentUser.email || "";
    document.getElementById("profile-phone").value = currentUser.phone || "";
    document.getElementById("profile-age").value = currentUser.age || "";
    document.getElementById("profile-gender").value = currentUser.gender || "";
    document.getElementById("profile-blood").value = currentUser.blood_group || "";
    document.getElementById("profile-allergies").value = currentUser.allergies || "";

    // Profile card
    document.getElementById("profile-big-avatar").textContent = initial;
    document.getElementById("profile-card-name").textContent = currentUser.name;
    document.getElementById("profile-card-email").textContent = currentUser.email;
    document.getElementById("profile-card-blood").textContent = currentUser.blood_group || "Not set";
    document.getElementById("profile-card-phone").textContent = currentUser.phone || "Not set";
    document.getElementById("profile-card-date").textContent = currentUser.created_at ? currentUser.created_at.slice(0, 10) : "2026";
  } catch (err) {
    console.error("User load error:", err);
  }
}

async function saveUserProfile(event) {
  event.preventDefault();
  const btn = document.getElementById("btn-save-profile");
  const msgEl = document.getElementById("profile-save-message");

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving…`;
  msgEl.textContent = "";

  const payload = {
    name: document.getElementById("profile-name").value.trim(),
    phone: document.getElementById("profile-phone").value.trim(),
    age: document.getElementById("profile-age").value,
    gender: document.getElementById("profile-gender").value,
    blood_group: document.getElementById("profile-blood").value,
    allergies: document.getElementById("profile-allergies").value.trim()
  };

  try {
    const res = await apiCall("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    showToast("Profile Updated", res.message, "success");
    msgEl.textContent = "Saved successfully!";
    msgEl.className = "small text-success";
    await loadUser();
    await loadDashboardStats();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = "small text-danger";
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-save me-1"></i> Save Changes`;
  }
}

// --------------------------------------------------------
// DASHBOARD OVERVIEW & STATS
// --------------------------------------------------------
async function loadDashboardStats() {
  try {
    const stats = await apiCall("/api/patient/dashboard-stats");

    document.getElementById("stat-upcoming").textContent = stats.upcomingCount;
    document.getElementById("stat-completed").textContent = stats.completedCount;
    document.getElementById("stat-prescriptions").textContent = stats.prescriptionsCount;
    document.getElementById("stat-profile-completeness").textContent = `${stats.profileCompletion}%`;
    document.getElementById("dash-profile-pct").textContent = `${stats.profileCompletion}%`;
    document.getElementById("dash-profile-bar").style.width = `${stats.profileCompletion}%`;

    // Next consultation spotlight
    const nextContent = document.getElementById("dash-next-appointment-content");
    if (stats.nextAppointment) {
      const apt = stats.nextAppointment;
      const isVideo = apt.type === "Video Consultation";
      nextContent.innerHTML = `
        <div class="d-flex align-items-center gap-3 p-3 bg-light rounded-3">
          <img src="${apt.image_url || '/assets/img/doctors/doctors-1.jpg'}" class="rounded-circle border" style="width: 65px; height: 65px; object-fit: cover;" alt="">
          <div class="flex-grow-1">
            <h6 class="mb-0 fw-bold">${escapeHtml(apt.doctor_name)}</h6>
            <div class="text-primary small fw-semibold">${escapeHtml(apt.specialty)}</div>
            <div class="text-muted small mt-1">
              <i class="bi bi-calendar3 me-1"></i> ${escapeHtml(apt.appointment_date)} &nbsp;|&nbsp; 
              <i class="bi bi-clock me-1"></i> ${formatTime12h(apt.appointment_time)}
            </div>
          </div>
          <div class="text-end">
            <span class="badge ${isVideo ? 'bg-info-subtle text-info' : 'bg-primary-subtle text-primary'} mb-2 d-block">
              <i class="bi ${isVideo ? 'bi-camera-video' : 'bi-hospital'} me-1"></i>${escapeHtml(apt.type)}
            </span>
            ${isVideo 
              ? `<button class="btn btn-sm btn-success" onclick="joinVideoCall(${apt.id}, '${escapeHtml(apt.doctor_name)}', '${escapeHtml(apt.specialty)}', '${apt.image_url}')">
                   <i class="bi bi-camera-video me-1"></i> Join Call
                 </button>`
              : `<button class="btn btn-sm btn-outline-primary" onclick="openSlipModal(${apt.id})">
                   <i class="bi bi-receipt me-1"></i> View Pass
                 </button>`
            }
          </div>
        </div>
      `;
    } else {
      nextContent.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-calendar-x fs-1 opacity-50 d-block mb-2"></i>
          <p class="mb-2">No upcoming appointment scheduled right now.</p>
          <button class="btn btn-sm btn-primary" onclick="activateTab('tab-book')">Book Your Next Visit</button>
        </div>
      `;
    }
  } catch (err) {
    console.error("Dashboard stats error:", err);
  }
}

// --------------------------------------------------------
// DOCTOR CATALOG & SLOTS
// --------------------------------------------------------
async function loadDoctors(specialty = "All") {
  try {
    let url = "/api/doctors";
    if (specialty && specialty !== "All") {
      url += `?specialty=${encodeURIComponent(specialty)}`;
    }
    const doctors = await apiCall(url);
    allDoctors = doctors;

    // Populate select in booking tab
    const select = document.getElementById("book-doctor-select");
    select.innerHTML = '<option value="">Choose a doctor…</option>';
    doctors.forEach((d) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${d.id}">${escapeHtml(d.name)} — ${escapeHtml(d.specialty)} (₹${Number(d.fee).toFixed(0)})</option>`
      );
    });

    // Populate directory tab
    renderDoctorsDirectory(doctors);
  } catch (err) {
    console.error("Doctors load error:", err);
  }
}

function filterDoctorsBySpecialty(specialty, button) {
  document.querySelectorAll("#booking-specialty-filter button").forEach((b) => {
    b.className = "btn btn-sm btn-outline-secondary";
  });
  button.className = "btn btn-sm btn-primary active-specialty";
  loadDoctors(specialty);
}

function onDoctorSelected() {
  const select = document.getElementById("book-doctor-select");
  const docId = Number(select.value);
  selectedDoctor = allDoctors.find((d) => d.id === docId);

  const preview = document.getElementById("selected-doctor-preview");
  const detailCard = document.getElementById("booking-doctor-detail-card");

  if (!selectedDoctor) {
    preview.classList.add("d-none");
    detailCard.innerHTML = `<h4 class="h5 fw-bold mb-3"><i class="bi bi-person-lines-fill text-primary me-2"></i>Doctor Details</h4><p class="text-muted small">Select any doctor from the list to view their experience, bio, and verified credentials.</p>`;
    return;
  }

  // Update inline preview
  preview.classList.remove("d-none");
  document.getElementById("preview-doc-img").src = selectedDoctor.image_url || "/assets/img/doctors/doctors-1.jpg";
  document.getElementById("preview-doc-name").textContent = selectedDoctor.name;
  document.getElementById("preview-doc-specialty").textContent = `${selectedDoctor.specialty} (${selectedDoctor.qualification || 'MBBS'})`;
  document.getElementById("preview-doc-days").textContent = `Available: ${selectedDoctor.available_days}`;
  document.getElementById("preview-doc-fee").textContent = `₹${Number(selectedDoctor.fee).toFixed(0)}`;
  document.getElementById("preview-doc-rating").textContent = Number(selectedDoctor.rating).toFixed(1);

  // Update right detail card
  detailCard.innerHTML = `
    <div class="text-center pb-3 border-bottom mb-3">
      <img src="${selectedDoctor.image_url || '/assets/img/doctors/doctors-1.jpg'}" class="doctor-avatar-img mb-2" alt="">
      <h5 class="fw-bold mb-0">${escapeHtml(selectedDoctor.name)}</h5>
      <span class="text-primary small fw-semibold">${escapeHtml(selectedDoctor.specialty)}</span>
      <div class="text-warning small mt-1">
        <i class="bi bi-star-fill"></i> ${Number(selectedDoctor.rating).toFixed(2)} (${selectedDoctor.review_count || 15} reviews)
      </div>
    </div>
    <div class="small text-muted mb-2"><strong>Experience:</strong> ${selectedDoctor.experience_years || 8} years</div>
    <div class="small text-muted mb-2"><strong>Qualifications:</strong> ${escapeHtml(selectedDoctor.qualification || 'MBBS, MD')}</div>
    <div class="small text-muted mb-3"><strong>Working Hours:</strong> ${selectedDoctor.available_time_start ? formatTime12h(selectedDoctor.available_time_start) : '09:00 AM'} - ${selectedDoctor.available_time_end ? formatTime12h(selectedDoctor.available_time_end) : '05:00 PM'}</div>
    <p class="small text-muted">${escapeHtml(selectedDoctor.bio || 'Experienced specialist committed to patient wellness.')}</p>
  `;

  // Set min date to today
  const today = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("book-date-input");
  dateInput.min = today;

  if (dateInput.value) {
    onDateChanged();
  }
}

function selectConsultationType(type) {
  selectedConsultationType = type;
  document.getElementById("type-box-inperson").classList.toggle("active", type === "In-Person");
  document.getElementById("type-box-video").classList.toggle("active", type === "Video Consultation");
}

function appendReason(tag) {
  const reasonBox = document.getElementById("book-reason");
  if (reasonBox.value) {
    reasonBox.value += `, ${tag}`;
  } else {
    reasonBox.value = tag;
  }
}

async function onDateChanged() {
  const docId = document.getElementById("book-doctor-select").value;
  const dateVal = document.getElementById("book-date-input").value;
  const slotsContainer = document.getElementById("slots-container");
  const slotsLabel = document.getElementById("slots-count-label");

  selectedSlot = null;
  document.getElementById("book-selected-time").value = "";

  if (!docId || !dateVal) {
    slotsContainer.innerHTML = `<div class="text-muted small py-3 col-12 text-center bg-light rounded">Please pick a doctor and date first to load real-time available slots.</div>`;
    return;
  }

  slotsContainer.innerHTML = `<div class="py-3 col-12 text-center"><span class="spinner-border spinner-border-sm text-primary"></span> Calculating live available slots…</div>`;

  try {
    const data = await apiCall(`/api/doctors/${docId}/available-slots?date=${dateVal}`);

    if (!data.available) {
      slotsContainer.innerHTML = `<div class="alert alert-warning py-2 small col-12 mb-0"><i class="bi bi-exclamation-triangle me-1"></i> ${escapeHtml(data.message)}</div>`;
      slotsLabel.textContent = "Doctor not available on this weekday";
      return;
    }

    const availableCount = data.slots.filter((s) => s.isAvailable).length;
    slotsLabel.textContent = `${availableCount} slots available for ${data.weekday}`;

    if (data.slots.length === 0) {
      slotsContainer.innerHTML = `<div class="text-muted small py-3 col-12 text-center bg-light rounded">No slots scheduled for this date.</div>`;
      return;
    }

    slotsContainer.innerHTML = data.slots.map((s) => {
      if (s.isAvailable) {
        return `<button type="button" class="slot-btn" onclick="selectSlot('${s.time}', this)">${s.label}</button>`;
      } else if (s.isBooked) {
        return `<button type="button" class="slot-btn booked" disabled title="Already booked by another patient">${s.label}</button>`;
      } else {
        return `<button type="button" class="slot-btn" disabled title="Slot has already passed today">${s.label}</button>`;
      }
    }).join("");
  } catch (err) {
    slotsContainer.innerHTML = `<div class="text-danger small py-2 col-12">${escapeHtml(err.message)}</div>`;
  }
}

function selectSlot(timeStr, btn) {
  selectedSlot = timeStr;
  document.getElementById("book-selected-time").value = timeStr;
  document.querySelectorAll("#slots-container .slot-btn").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
}

async function submitAppointmentBooking() {
  const docId = document.getElementById("book-doctor-select").value;
  const dateVal = document.getElementById("book-date-input").value;
  const timeVal = document.getElementById("book-selected-time").value;
  const reasonVal = document.getElementById("book-reason").value.trim();
  const alertBox = document.getElementById("booking-alert-box");
  const btn = document.getElementById("btn-submit-booking");

  alertBox.innerHTML = "";

  if (!docId) {
    alertBox.innerHTML = `<div class="alert alert-danger py-2 small">Please select a doctor.</div>`;
    return;
  }
  if (!dateVal) {
    alertBox.innerHTML = `<div class="alert alert-danger py-2 small">Please choose an appointment date.</div>`;
    return;
  }
  if (!timeVal) {
    alertBox.innerHTML = `<div class="alert alert-danger py-2 small">Please select an available time slot.</div>`;
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Confirming Slot…`;

  try {
    const res = await apiCall("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: docId,
        appointmentDate: dateVal,
        appointmentTime: timeVal,
        type: selectedConsultationType,
        reason: reasonVal
      })
    });

    showToast("Booking Confirmed", res.message, "success");
    alertBox.innerHTML = `<div class="alert alert-success py-2 small"><i class="bi bi-check-circle me-1"></i> ${escapeHtml(res.message)} Token #${res.appointmentId} created!</div>`;

    // Reset fields
    document.getElementById("book-reason").value = "";
    document.getElementById("book-selected-time").value = "";
    selectedSlot = null;
    onDateChanged();

    // Reload overview, appointments list, and notifications
    await loadAppointments();
    await loadDashboardStats();
    await loadNotifications();

    // Switch to appointments tab after 1.2s
    setTimeout(() => {
      activateTab("tab-appointments");
    }, 1200);
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-danger py-2 small">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-check-circle me-1"></i> Confirm Appointment Booking`;
  }
}

// --------------------------------------------------------
// MY APPOINTMENTS TAB
// --------------------------------------------------------
async function loadAppointments() {
  try {
    const appointments = await apiCall("/api/appointments");
    allAppointments = appointments;

    // Update count badge
    document.getElementById("badge-appointments-count").textContent = appointments.length;

    renderAppointmentsList();
    renderPrescriptionsTab();
  } catch (err) {
    console.error("Appointments load error:", err);
  }
}

function filterAppointments(filter) {
  activeFilter = filter;
  ["all", "booked", "completed", "cancelled"].forEach((f) => {
    const btn = document.getElementById(`btn-filter-${f}`);
    if (btn) btn.classList.toggle("active", f.toLowerCase() === filter.toLowerCase());
  });
  renderAppointmentsList();
}

function renderAppointmentsList() {
  const container = document.getElementById("appointments-container");
  let filtered = allAppointments;

  if (activeFilter !== "All") {
    filtered = allAppointments.filter((a) => a.status.toLowerCase() === activeFilter.toLowerCase());
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-calendar-x fs-1 opacity-50 d-block mb-2"></i>
        <h6>No ${activeFilter !== 'All' ? activeFilter.toLowerCase() : ''} appointments found.</h6>
        <button class="btn btn-sm btn-primary mt-2" onclick="activateTab('tab-book')">Book an Appointment</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((a) => {
    const isBooked = a.status === "Booked";
    const isCompleted = a.status === "Completed";
    const isCancelled = a.status === "Cancelled";
    const isVideo = a.type === "Video Consultation";

    const statusBadge = isBooked ? `<span class="badge badge-status badge-status-booked">Booked</span>` :
                        isCompleted ? `<span class="badge badge-status badge-status-completed">Completed</span>` :
                        isCancelled ? `<span class="badge badge-status badge-status-cancelled">Cancelled</span>` :
                        `<span class="badge badge-status badge-status-inprogress">${escapeHtml(a.status)}</span>`;

    const typeBadge = isVideo 
      ? `<span class="badge bg-info-subtle text-info"><i class="bi bi-camera-video me-1"></i>Virtual Video</span>`
      : `<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-hospital me-1"></i>In-Person</span>`;

    return `
      <div class="portal-card p-3 mb-0">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
          
          <!-- Doctor & Time Info -->
          <div class="d-flex align-items-center gap-3">
            <img src="${a.image_url || '/assets/img/doctors/doctors-1.jpg'}" class="rounded-circle border" style="width: 60px; height: 60px; object-fit: cover;" alt="">
            <div>
              <div class="d-flex align-items-center gap-2">
                <h6 class="mb-0 fw-bold">${escapeHtml(a.doctor_name)}</h6>
                ${statusBadge}
                ${typeBadge}
              </div>
              <div class="text-primary small fw-semibold">${escapeHtml(a.specialty)} • Fee: ₹${Number(a.fee).toFixed(0)}</div>
              <div class="text-muted small mt-1">
                <i class="bi bi-calendar-event me-1"></i> <strong>${escapeHtml(a.appointment_date)}</strong> &nbsp;|&nbsp; 
                <i class="bi bi-clock me-1"></i> ${formatTime12h(a.appointment_time)}
              </div>
              ${a.reason ? `<div class="small text-muted mt-1 fst-italic">Reason: "${escapeHtml(a.reason)}"</div>` : ''}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="d-flex flex-wrap gap-2 align-items-center ms-auto">
            <button class="btn btn-sm btn-outline-secondary" onclick="openSlipModal(${a.id})">
              <i class="bi bi-receipt me-1"></i> Slip
            </button>

            ${isBooked && isVideo ? `
              <button class="btn btn-sm btn-success" onclick="joinVideoCall(${a.id}, '${escapeHtml(a.doctor_name)}', '${escapeHtml(a.specialty)}', '${a.image_url}')">
                <i class="bi bi-camera-video me-1"></i> Join Call
              </button>
            ` : ''}

            ${isBooked ? `
              <button class="btn btn-sm btn-outline-primary" onclick="openRescheduleModal(${a.id}, '${escapeHtml(a.doctor_name)}', ${a.doctor_id})">
                <i class="bi bi-arrow-repeat me-1"></i> Reschedule
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="cancelAppointment(${a.id})">
                <i class="bi bi-x-circle me-1"></i> Cancel
              </button>
            ` : ''}

            ${isCompleted && a.prescription ? `
              <button class="btn btn-sm btn-primary" onclick="openPrescriptionModal(${a.id})">
                <i class="bi bi-file-earmark-medical me-1"></i> View Rx
              </button>
            ` : ''}

            ${isCompleted ? `
              <button class="btn btn-sm btn-outline-warning text-dark" onclick="openReviewModal(${a.id}, '${escapeHtml(a.doctor_name)}')">
                <i class="bi bi-star-fill text-warning me-1"></i> ${a.user_review_rating ? 'Reviewed (' + a.user_review_rating + '★)' : 'Rate Doctor'}
              </button>
            ` : ''}
          </div>

        </div>
      </div>
    `;
  }).join("");
}

// Cancel appointment
async function cancelAppointment(aptId) {
  if (!confirm("Are you sure you want to cancel this appointment?")) return;

  try {
    const res = await apiCall(`/api/appointments/${aptId}/cancel`, { method: "POST" });
    showToast("Cancelled", res.message, "danger");
    await loadAppointments();
    await loadDashboardStats();
    await loadNotifications();
  } catch (err) {
    alert(err.message);
  }
}

// --------------------------------------------------------
// RESCHEDULE MODAL
// --------------------------------------------------------
let rescheduleDocId = null;

function openRescheduleModal(aptId, docName, docId) {
  document.getElementById("reschedule-appointment-id").value = aptId;
  document.getElementById("reschedule-doctor-name").value = docName;
  rescheduleDocId = docId;

  const dateInput = document.getElementById("reschedule-date-input");
  dateInput.min = new Date().toISOString().split("T")[0];
  dateInput.value = "";
  document.getElementById("reschedule-slots-container").innerHTML = `<small class="text-muted col-12">Pick a date above to check available slots.</small>`;
  document.getElementById("reschedule-selected-time").value = "";
  document.getElementById("reschedule-message").textContent = "";

  const modal = new bootstrap.Modal(document.getElementById("rescheduleModal"));
  modal.show();
}

async function loadRescheduleSlots() {
  const dateVal = document.getElementById("reschedule-date-input").value;
  const container = document.getElementById("reschedule-slots-container");
  if (!dateVal || !rescheduleDocId) return;

  container.innerHTML = `<div class="py-2 col-12 text-center"><span class="spinner-border spinner-border-sm"></span> Loading slots…</div>`;

  try {
    const data = await apiCall(`/api/doctors/${rescheduleDocId}/available-slots?date=${dateVal}`);
    if (!data.available) {
      container.innerHTML = `<div class="alert alert-warning py-1 small col-12">${escapeHtml(data.message)}</div>`;
      return;
    }

    container.innerHTML = data.slots.map((s) => {
      if (s.isAvailable) {
        return `<button type="button" class="slot-btn" onclick="selectRescheduleSlot('${s.time}', this)">${s.label}</button>`;
      } else {
        return `<button type="button" class="slot-btn booked" disabled>${s.label}</button>`;
      }
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="text-danger small col-12">${escapeHtml(err.message)}</div>`;
  }
}

function selectRescheduleSlot(timeStr, btn) {
  document.getElementById("reschedule-selected-time").value = timeStr;
  document.querySelectorAll("#reschedule-slots-container .slot-btn").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
}

async function submitReschedule() {
  const aptId = document.getElementById("reschedule-appointment-id").value;
  const newDate = document.getElementById("reschedule-date-input").value;
  const newTime = document.getElementById("reschedule-selected-time").value;
  const msgEl = document.getElementById("reschedule-message");

  if (!newDate || !newTime) {
    msgEl.textContent = "Please select both a new date and a time slot.";
    msgEl.className = "small text-danger mt-2";
    return;
  }

  try {
    const res = await apiCall(`/api/appointments/${aptId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentDate: newDate, appointmentTime: newTime })
    });

    showToast("Rescheduled", res.message, "success");
    bootstrap.Modal.getInstance(document.getElementById("rescheduleModal")).hide();
    await loadAppointments();
    await loadDashboardStats();
    await loadNotifications();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.className = "small text-danger mt-2";
  }
}

// --------------------------------------------------------
// APPOINTMENT SLIP / PASS MODAL
// --------------------------------------------------------
async function openSlipModal(aptId) {
  try {
    const slip = await apiCall(`/api/appointments/${aptId}/slip`);

    document.getElementById("slip-token").textContent = `#APT-${String(slip.id).padStart(4, "0")}`;
    document.getElementById("slip-barcode").textContent = `||| ${slip.id}934 882 |||`;
    document.getElementById("slip-created").textContent = `Issued: ${slip.created_at ? slip.created_at.slice(0, 10) : '2026-11-15'}`;
    document.getElementById("slip-patient-name").textContent = slip.patient_name;
    document.getElementById("slip-patient-phone").textContent = `Phone: ${slip.patient_phone || '+91 98765 43210'}`;
    document.getElementById("slip-patient-blood").textContent = `Blood Group: ${slip.blood_group || 'O+'}`;

    document.getElementById("slip-doctor-name").textContent = slip.doctor_name;
    document.getElementById("slip-doctor-spec").textContent = slip.specialty;
    document.getElementById("slip-doctor-qual").textContent = slip.qualification || "MBBS, MD";

    document.getElementById("slip-date").textContent = slip.appointment_date;
    document.getElementById("slip-time").textContent = formatTime12h(slip.appointment_time);
    document.getElementById("slip-type").textContent = slip.type;
    document.getElementById("slip-pay").textContent = slip.payment_status || "Paid (Simulated)";
    document.getElementById("slip-fee").textContent = `₹${Number(slip.fee).toFixed(2)}`;

    const modal = new bootstrap.Modal(document.getElementById("slipModal"));
    modal.show();
  } catch (err) {
    alert("Could not load appointment slip: " + err.message);
  }
}

// --------------------------------------------------------
// PRESCRIPTIONS & MEDICAL RECORDS TAB
// --------------------------------------------------------
function renderPrescriptionsTab() {
  const container = document.getElementById("prescriptions-container");
  const completedWithRx = allAppointments.filter((a) => a.prescription && a.status === "Completed");

  if (completedWithRx.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="bi bi-clipboard2-pulse fs-1 opacity-50 d-block mb-2"></i>
        <h6>No digital prescriptions issued yet.</h6>
        <p class="small">Once your consultation is completed by the doctor, clinical notes and medication slips will appear here.</p>
        <button class="btn btn-sm btn-outline-primary" onclick="activateTab('tab-doctor-simulator')">
          <i class="bi bi-hospital me-1"></i> Try Doctor Mode to Issue an Rx
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = completedWithRx.map((a) => {
    let meds = [];
    try {
      meds = JSON.parse(a.prescription);
    } catch {
      meds = [{ name: a.prescription, dosage: "-", duration: "-", instructions: "-" }];
    }

    return `
      <div class="col-lg-6">
        <div class="portal-card h-100 border">
          <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
            <div class="d-flex align-items-center gap-3">
              <img src="${a.image_url || '/assets/img/doctors/doctors-1.jpg'}" class="rounded-circle border" style="width: 50px; height: 50px; object-fit: cover;" alt="">
              <div>
                <h6 class="fw-bold mb-0">${escapeHtml(a.doctor_name)}</h6>
                <small class="text-primary fw-semibold">${escapeHtml(a.specialty)}</small>
                <div class="small text-muted"><i class="bi bi-calendar3 me-1"></i>${escapeHtml(a.appointment_date)}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="openPrescriptionModal(${a.id})">
              <i class="bi bi-printer me-1"></i> View & Print
            </button>
          </div>

          <div class="mb-3">
            <small class="text-muted text-uppercase fw-bold d-block mb-1">Clinical Notes:</small>
            <div class="p-2 bg-light rounded small fst-italic">${escapeHtml(a.doctor_notes || 'Routine checkup. Medications advised as indicated.')}</div>
          </div>

          <small class="text-muted text-uppercase fw-bold d-block mb-1">Prescribed Medicines (${meds.length}):</small>
          <ul class="list-group list-group-flush small mb-3">
            ${meds.slice(0, 3).map((m) => `
              <li class="list-group-item px-0 py-1 d-flex justify-content-between">
                <strong>${escapeHtml(m.name)}</strong>
                <span class="text-muted">${escapeHtml(m.dosage)} (${escapeHtml(m.duration)})</span>
              </li>
            `).join("")}
            ${meds.length > 3 ? `<li class="list-group-item px-0 py-1 text-muted text-center">+ ${meds.length - 3} more items</li>` : ''}
          </ul>
        </div>
      </div>
    `;
  }).join("");
}

function openPrescriptionModal(aptId) {
  const apt = allAppointments.find((a) => a.id === aptId);
  if (!apt) return;

  document.getElementById("rx-doctor-name").textContent = apt.doctor_name;
  document.getElementById("rx-doctor-spec").textContent = `${apt.specialty} (${apt.qualification || 'MBBS, MD'})`;
  document.getElementById("rx-date").textContent = `Date: ${apt.completed_at ? apt.completed_at.slice(0, 10) : apt.appointment_date}`;
  document.getElementById("rx-patient-name").textContent = currentUser ? currentUser.name : "Patient";
  document.getElementById("rx-patient-details").textContent = `${currentUser ? currentUser.gender || 'Not specified' : 'Male'}, ${currentUser ? currentUser.age || 25 : 25} yrs`;
  document.getElementById("rx-patient-blood").textContent = currentUser ? currentUser.blood_group || "O+" : "O+";
  document.getElementById("rx-diagnosis-notes").textContent = apt.doctor_notes || "Patient evaluated. Prescribed treatment plan as charted.";
  document.getElementById("rx-signature").textContent = apt.doctor_name;

  let meds = [];
  try {
    meds = JSON.parse(apt.prescription);
  } catch {
    meds = [{ name: apt.prescription, dosage: "-", duration: "-", instructions: "-" }];
  }

  const tbody = document.getElementById("rx-meds-tbody");
  tbody.innerHTML = meds.map((m, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="fw-bold">${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.dosage)}</td>
      <td>${escapeHtml(m.duration)}</td>
      <td class="text-muted">${escapeHtml(m.instructions)}</td>
    </tr>
  `).join("");

  const modal = new bootstrap.Modal(document.getElementById("prescriptionModal"));
  modal.show();
}

// --------------------------------------------------------
// FIND DOCTORS DIRECTORY
// --------------------------------------------------------
function renderDoctorsDirectory(doctors) {
  const container = document.getElementById("doctors-directory-container");
  if (doctors.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5 text-muted">No specialists match your search criteria.</div>`;
    return;
  }

  container.innerHTML = doctors.map((doc) => `
    <div class="col-md-6 col-xl-4">
      <div class="doctor-profile-card">
        <div class="d-flex align-items-center gap-3 mb-3">
          <img src="${doc.image_url || '/assets/img/doctors/doctors-1.jpg'}" class="doctor-avatar-img" alt="">
          <div>
            <h5 class="fw-bold mb-0">${escapeHtml(doc.name)}</h5>
            <span class="text-primary small fw-semibold">${escapeHtml(doc.specialty)}</span>
            <div class="text-warning small mt-1">
              <i class="bi bi-star-fill"></i> ${Number(doc.rating).toFixed(2)} (${doc.review_count || 12} reviews)
            </div>
          </div>
        </div>

        <div class="small text-muted mb-2"><strong>Qualifications:</strong> ${escapeHtml(doc.qualification || 'MBBS, MD')}</div>
        <div class="small text-muted mb-2"><strong>Experience:</strong> ${doc.experience_years || 8}+ years clinical practice</div>
        <div class="small text-muted mb-3"><strong>Available Days:</strong> ${escapeHtml(doc.available_days)}</div>
        <p class="small text-muted mb-3 flex-grow-1">${escapeHtml(doc.bio || 'Dedicated medical specialist offering top-tier clinical consultations.')}</p>

        <div class="d-flex justify-content-between align-items-center border-top pt-3 mt-auto">
          <div>
            <small class="text-muted d-block">Consultation Fee</small>
            <span class="doctor-fee">₹${Number(doc.fee).toFixed(0)}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="directBookDoctor(${doc.id})">
            <i class="bi bi-calendar-plus me-1"></i> Book Slot
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function onSearchDoctors(term) {
  const lower = term.toLowerCase();
  const filtered = allDoctors.filter((d) => 
    d.name.toLowerCase().includes(lower) ||
    d.specialty.toLowerCase().includes(lower) ||
    (d.bio && d.bio.toLowerCase().includes(lower))
  );
  renderDoctorsDirectory(filtered);
}

function directBookDoctor(docId) {
  activateTab("tab-book");
  const select = document.getElementById("book-doctor-select");
  select.value = docId;
  onDoctorSelected();
}

// --------------------------------------------------------
// REVIEWS & RATINGS
// --------------------------------------------------------
function openReviewModal(aptId, docName) {
  document.getElementById("review-appointment-id").value = aptId;
  document.getElementById("review-doctor-name").textContent = docName;
  document.getElementById("review-comment").value = "";
  document.getElementById("review-alert").textContent = "";
  setStarRating(5);

  const modal = new bootstrap.Modal(document.getElementById("reviewModal"));
  modal.show();
}

function setStarRating(val) {
  document.getElementById("review-rating-value").value = val;
  const stars = document.querySelectorAll("#star-rating-box i");
  stars.forEach((star, idx) => {
    if (idx < val) {
      star.className = "bi bi-star-fill pointer-star text-warning";
    } else {
      star.className = "bi bi-star pointer-star text-secondary";
    }
  });
}

async function submitReview() {
  const aptId = document.getElementById("review-appointment-id").value;
  const rating = document.getElementById("review-rating-value").value;
  const comment = document.getElementById("review-comment").value.trim();
  const alertEl = document.getElementById("review-alert");

  try {
    const res = await apiCall(`/api/appointments/${aptId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment })
    });

    showToast("Review Submitted", res.message, "success");
    bootstrap.Modal.getInstance(document.getElementById("reviewModal")).hide();
    await loadAppointments();
    await loadDoctors();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = "small text-danger mt-2";
  }
}

// --------------------------------------------------------
// TELEMEDICINE VIRTUAL CONSULTATION ROOM
// --------------------------------------------------------
function joinVideoCall(aptId, docName, docSpecialty, docImg) {
  document.getElementById("call-doctor-name").textContent = docName;
  document.getElementById("call-doctor-spec").textContent = docSpecialty;
  if (docImg) document.getElementById("call-doctor-img").src = docImg;

  activateTab("tab-video");
  startCallTimer();
  showToast("Virtual Call Connected", `Consultation live with ${docName}.`, "success");
}

function startCallTimer() {
  if (callTimerInterval) clearInterval(callTimerInterval);
  const timerEl = document.getElementById("call-timer");
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, "0");
    const s = String(callSeconds % 60).padStart(2, "0");
    timerEl.innerHTML = `<i class="bi bi-clock me-1"></i>00:${m}:${s}`;
  }, 1000);
}

function toggleCallControl(type) {
  if (type === "mic") {
    const btn = document.getElementById("ctrl-mic");
    btn.classList.toggle("active-danger");
    const isMuted = btn.classList.contains("active-danger");
    btn.innerHTML = `<i class="bi ${isMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}"></i>`;
    showToast("Microphone", isMuted ? "Microphone muted" : "Microphone unmuted", "secondary");
  } else if (type === "cam") {
    const btn = document.getElementById("ctrl-cam");
    btn.classList.toggle("active-danger");
    const isOff = btn.classList.contains("active-danger");
    btn.innerHTML = `<i class="bi ${isOff ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}"></i>`;
    document.getElementById("user-pip-avatar").className = isOff ? "bi bi-eye-slash-fill fs-1 text-danger" : "bi bi-person-video fs-1 text-secondary";
    showToast("Camera", isOff ? "Video stream paused" : "Video stream active", "secondary");
  } else if (type === "vitals") {
    const hud = document.getElementById("hud-vitals");
    hud.classList.toggle("d-none");
  }
}

function sendCallChatMessage() {
  const input = document.getElementById("call-chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  const chatBox = document.getElementById("call-chat-messages");
  chatBox.insertAdjacentHTML("beforeend", `
    <div class="chat-bubble patient">
      <strong>You:</strong> ${escapeHtml(msg)}
    </div>
  `);
  input.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;

  // Simulated Doctor Response after 1.5 seconds
  setTimeout(() => {
    const replies = [
      "I have noted your observation. Are you currently taking any regular vitamins?",
      "That is consistent with your vitals. I will prescribe a mild dosage to help relieve the symptoms.",
      "Understood. Be sure to stay well hydrated and monitor your blood pressure.",
      "Thank you for confirming. I will document this in your digital prescription now."
    ];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    chatBox.insertAdjacentHTML("beforeend", `
      <div class="chat-bubble doctor">
        <strong>Dr. Kabir:</strong> ${randomReply}
      </div>
    `);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 1400);
}

function endSimulatedCall() {
  if (confirm("End this virtual telemedicine consultation?")) {
    if (callTimerInterval) clearInterval(callTimerInterval);
    showToast("Call Ended", "Consultation ended. Doctor notes and Rx will be generated.", "info");
    activateTab("tab-dashboard");
  }
}

// --------------------------------------------------------
// CLINIC & DOCTOR SIMULATOR MODE
// --------------------------------------------------------
function switchSimulatorRole(role) {
  const btnPatient = document.getElementById("btn-mode-patient");
  const btnDoctor = document.getElementById("btn-mode-doctor");
  const banner = document.getElementById("role-banner");
  const bannerTitle = document.getElementById("role-banner-title");
  const bannerDesc = document.getElementById("role-banner-desc");
  const bannerAction = document.getElementById("role-banner-action");

  if (role === "doctor") {
    btnDoctor.className = "btn btn-primary";
    btnPatient.className = "btn btn-outline-primary";
    banner.className = "alert alert-warning border-0 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4";
    bannerTitle.textContent = "Doctor / Clinic Mode Active:";
    bannerDesc.textContent = "You are now managing the clinic queue! Update appointment status, diagnose patients, and prescribe medications.";
    bannerAction.innerHTML = `<i class="bi bi-arrow-repeat me-1"></i> Switch to Patient View`;
    activateTab("tab-doctor-simulator");
    loadDoctorSimulatorQueue();
  } else {
    btnPatient.className = "btn btn-primary";
    btnDoctor.className = "btn btn-outline-primary";
    banner.className = "alert alert-info border-0 shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4";
    bannerTitle.textContent = "Patient Portal Mode Active:";
    bannerDesc.textContent = "You are viewing the patient experience (book slots, view prescriptions, join consultations).";
    bannerAction.innerHTML = `<i class="bi bi-arrow-repeat me-1"></i> Switch to Doctor Mode`;
    activateTab("tab-dashboard");
  }
}

function toggleRoleBannerAction() {
  const isDoctor = document.getElementById("btn-mode-doctor").classList.contains("btn-primary");
  switchSimulatorRole(isDoctor ? "patient" : "doctor");
}

async function loadDoctorSimulatorQueue() {
  const tbody = document.getElementById("simulator-queue-tbody");
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4"><span class="spinner-border spinner-border-sm"></span> Loading clinic queue…</td></tr>`;

  try {
    const appointments = await apiCall("/api/simulator/doctor-appointments");

    if (appointments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No appointments recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = appointments.map((a) => {
      const isCompleted = a.status === "Completed";
      const isInProgress = a.status === "In-Progress";

      return `
        <tr>
          <td><span class="badge bg-light text-dark border">#${a.id}</span></td>
          <td>
            <strong>${escapeHtml(a.patient_name)}</strong>
            <div class="small text-muted">${escapeHtml(a.patient_phone || 'N/A')} • ${escapeHtml(a.blood_group || 'O+')}</div>
            ${a.reason ? `<div class="small text-muted fst-italic">"${escapeHtml(a.reason)}"</div>` : ''}
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(a.doctor_name)}</div>
            <small class="text-muted">${escapeHtml(a.specialty)}</small>
          </td>
          <td>
            <div class="small fw-semibold">${escapeHtml(a.appointment_date)}</div>
            <small class="text-muted">${formatTime12h(a.appointment_time)}</small>
          </td>
          <td><span class="badge bg-secondary-subtle text-secondary small">${escapeHtml(a.type)}</span></td>
          <td>
            <span class="badge ${isCompleted ? 'bg-success' : isInProgress ? 'bg-warning text-dark' : 'bg-primary'}">${escapeHtml(a.status)}</span>
          </td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              ${!isCompleted ? `
                <button type="button" class="btn btn-outline-warning" title="Mark In-Progress" onclick="updateSimulatorStatus(${a.id}, 'In-Progress')">
                  <i class="bi bi-play-circle"></i> In-Progress
                </button>
                <button type="button" class="btn btn-success" title="Prescribe & Complete" onclick="openDoctorPrescribeModal(${a.id}, '${escapeHtml(a.patient_name)}', '${escapeHtml(a.reason || 'Checkup')}')">
                  <i class="bi bi-capsule"></i> Prescribe
                </button>
              ` : `
                <button type="button" class="btn btn-outline-secondary" onclick="openPrescriptionModal(${a.id})">
                  <i class="bi bi-eye"></i> View Rx
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger py-4 text-center">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function updateSimulatorStatus(aptId, status) {
  try {
    const res = await apiCall(`/api/simulator/appointments/${aptId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    showToast("Status Updated", res.message, "success");
    await loadDoctorSimulatorQueue();
    await loadAppointments();
  } catch (err) {
    alert(err.message);
  }
}

function openDoctorPrescribeModal(aptId, patientName, reason) {
  document.getElementById("sim-prescribe-apt-id").value = aptId;
  document.getElementById("sim-prescribe-patient").textContent = patientName;
  document.getElementById("sim-prescribe-reason").textContent = reason;
  document.getElementById("sim-doctor-notes").value = "Patient examined. Vitals within normal range. Prescribed medical regimen with rest.";
  document.getElementById("sim-prescribe-alert").textContent = "";

  const medsContainer = document.getElementById("sim-meds-list");
  medsContainer.innerHTML = "";
  // Add 2 default realistic rows
  addPrescriptionRow("Paracetamol 650mg", "1 tablet twice daily", "3 days", "Take after food for fever/ache");
  addPrescriptionRow("Vitamin C 500mg", "1 chewable tablet daily", "10 days", "Take after lunch");

  const modal = new bootstrap.Modal(document.getElementById("doctorPrescribeModal"));
  modal.show();
}

function addPrescriptionRow(name = "", dosage = "", duration = "", instructions = "") {
  const container = document.getElementById("sim-meds-list");
  const rowId = "med-row-" + Date.now() + Math.random().toString(36).substring(2, 5);

  container.insertAdjacentHTML("beforeend", `
    <div class="row g-2 align-items-center p-2 bg-white border rounded" id="${rowId}">
      <div class="col-md-4">
        <input type="text" class="form-control form-control-sm med-name" placeholder="Medicine name (e.g. Amoxicillin)" value="${escapeHtml(name)}" required>
      </div>
      <div class="col-md-3">
        <input type="text" class="form-control form-control-sm med-dosage" placeholder="Dosage (e.g. 1 tab thrice daily)" value="${escapeHtml(dosage)}" required>
      </div>
      <div class="col-md-2">
        <input type="text" class="form-control form-control-sm med-duration" placeholder="Duration (e.g. 5 days)" value="${escapeHtml(duration)}" required>
      </div>
      <div class="col-md-2">
        <input type="text" class="form-control form-control-sm med-instructions" placeholder="Instructions" value="${escapeHtml(instructions)}">
      </div>
      <div class="col-md-1 text-end">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="document.getElementById('${rowId}').remove()"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `);
}

async function submitDoctorPrescription() {
  const aptId = document.getElementById("sim-prescribe-apt-id").value;
  const notes = document.getElementById("sim-doctor-notes").value.trim();
  const alertEl = document.getElementById("sim-prescribe-alert");

  const meds = [];
  document.querySelectorAll("#sim-meds-list .row").forEach((row) => {
    const name = row.querySelector(".med-name").value.trim();
    const dosage = row.querySelector(".med-dosage").value.trim();
    const duration = row.querySelector(".med-duration").value.trim();
    const instructions = row.querySelector(".med-instructions").value.trim();
    if (name) meds.push({ name, dosage, duration, instructions });
  });

  if (meds.length === 0) {
    alertEl.textContent = "Please add at least one medication.";
    alertEl.className = "small text-danger mt-2";
    return;
  }

  try {
    const res = await apiCall(`/api/simulator/appointments/${aptId}/prescribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorNotes: notes, prescription: meds })
    });

    showToast("Prescription Issued", res.message, "success");
    bootstrap.Modal.getInstance(document.getElementById("doctorPrescribeModal")).hide();
    await loadDoctorSimulatorQueue();
    await loadAppointments();
    await loadDashboardStats();
    await loadNotifications();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = "small text-danger mt-2";
  }
}

// --------------------------------------------------------
// IN-APP NOTIFICATIONS
// --------------------------------------------------------
async function loadNotifications() {
  try {
    const data = await apiCall("/api/notifications");
    const badge = document.getElementById("notif-badge");
    const container = document.getElementById("notif-list-container");

    if (data.unreadCount > 0) {
      badge.textContent = data.unreadCount;
      badge.classList.remove("d-none");
    } else {
      badge.classList.add("d-none");
    }

    if (data.notifications.length === 0) {
      container.innerHTML = `<li class="p-3 text-center text-muted small">No notifications yet.</li>`;
      return;
    }

    container.innerHTML = data.notifications.map((n) => `
      <li class="notif-item ${!n.is_read ? 'unread' : ''}">
        <div class="fw-semibold text-dark">${escapeHtml(n.title)}</div>
        <div class="text-muted small">${escapeHtml(n.message)}</div>
        <div class="text-secondary small mt-1" style="font-size: 0.72rem;">${n.created_at ? n.created_at.slice(0, 16).replace('T', ' ') : ''}</div>
      </li>
    `).join("");
  } catch (err) {
    console.error("Notifications load error:", err);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiCall("/api/notifications/read-all", { method: "POST" });
    await loadNotifications();
  } catch (err) {
    console.error(err);
  }
}

// --------------------------------------------------------
// LOGOUT & INITIALIZATION
// --------------------------------------------------------
document.getElementById("logout-button").addEventListener("click", async () => {
  try {
    await apiCall("/api/logout", { method: "POST" });
  } catch (err) {
    console.error("Logout error:", err);
  }
  window.location.href = "/login.html";
});

// Boot up simulator
(async function init() {
  try {
    await loadUser();
    await loadDoctors();
    await loadAppointments();
    await loadDashboardStats();
    await loadNotifications();
  } catch (err) {
    console.error("Init error:", err);
  }
})();
