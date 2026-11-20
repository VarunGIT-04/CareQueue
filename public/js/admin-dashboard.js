let adminDoctors = [];
let adminPatients = [];
let adminAppointments = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(new Date());
  loadAdminStats(); loadDoctors(); loadPatients(); loadAppointments(); setupLogout();
  document.getElementById("doctor-search").addEventListener("input", renderDoctors);
  document.getElementById("doctor-specialty-filter").addEventListener("change", renderDoctors);
  document.getElementById("patient-search").addEventListener("input", renderPatients);
  document.getElementById("appointment-search").addEventListener("input", renderAppointments);
  document.getElementById("appointment-filter").addEventListener("change", renderAppointments);
  document.getElementById("add-doctor-form").addEventListener("submit", addDoctor);
});

async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (res.status === 401 || res.status === 403) { window.location.href = "/login.html?role=admin"; throw new Error("Please sign in as an administrator."); }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function loadAdminStats() {
  try {
    const d = await getJson("/api/admin/dashboard-stats");
    document.getElementById("total-patients").textContent = d.totalPatients;
    document.getElementById("total-doctors").textContent = d.totalDoctors;
    document.getElementById("total-appointments").textContent = d.totalAppointments;
    document.getElementById("total-treated").textContent = d.totalTreated;
    document.getElementById("total-revenue").textContent = `₹${Number(d.totalRevenue).toLocaleString("en-IN")}`;
  } catch (error) { console.error(error); }
}

async function loadDoctors() {
  try { adminDoctors = await getJson("/api/admin/doctors"); populateSpecialtyFilter(); renderDoctors(); }
  catch (error) { showGridError("doctors-grid", error.message); }
}

async function loadPatients() {
  try { adminPatients = await getJson("/api/admin/patients"); renderPatients(); }
  catch (error) { showGridError("patients-grid", error.message); }
}

async function loadAppointments() {
  try { adminAppointments = await getJson("/api/admin/appointments"); renderAppointments(); }
  catch (error) { showGridError("appointments-grid", error.message); }
}

function renderDoctors() {
  const q = document.getElementById("doctor-search").value.trim().toLowerCase();
  const specialty = document.getElementById("doctor-specialty-filter").value;
  const rows = adminDoctors.filter(d => (specialty === "All" || d.specialty === specialty) && `${d.name} ${d.specialty} ${d.email || ""}`.toLowerCase().includes(q));
  document.getElementById("doctor-result-count").textContent = `${rows.length} ${rows.length === 1 ? "doctor" : "doctors"}`;
  document.getElementById("doctors-grid").innerHTML = rows.length ? rows.map(d => `
    <div class="col-sm-6 col-xl-4"><article class="directory-card h-100">
      <div class="directory-card-top"><span class="doctor-avatar"><i class="bi bi-person-badge"></i></span><span class="specialty-tag">${escapeHtml(d.specialty)}</span></div>
      <h3 class="directory-name">${escapeHtml(d.name)}</h3><p class="directory-subtitle">${escapeHtml(d.email || "Doctor account")}</p>
      <div class="directory-meta"><span><i class="bi bi-award"></i>${Number(d.experience_years) || 0} years</span><span><i class="bi bi-cash"></i>₹${Number(d.fee).toLocaleString("en-IN")}</span></div>
      <div class="directory-stats"><span><strong>${Number(d.treated_count) || 0}</strong> completed</span><span><strong>${Number(d.pending_count) || 0}</strong> booked</span></div>
      <button class="btn btn-sm btn-outline-primary w-100 mt-3" onclick="showDoctorDetails(${Number(d.id)})"><i class="bi bi-person-lines-fill me-1"></i>View doctor details</button>
    </article></div>`).join("") : emptyGrid("No doctors match your search.", 12);
}

function renderPatients() {
  const q = document.getElementById("patient-search").value.trim().toLowerCase();
  const rows = adminPatients.filter(p => `${p.name} ${p.email} ${p.phone || ""}`.toLowerCase().includes(q));
  document.getElementById("patient-result-count").textContent = `${rows.length} ${rows.length === 1 ? "patient" : "patients"}`;
  document.getElementById("patients-grid").innerHTML = rows.length ? rows.map(p => `
    <div class="col-sm-6 col-xl-4"><article class="directory-card patient-directory-card h-100">
      <div class="directory-card-top"><span class="patient-avatar"><i class="bi bi-person"></i></span><span class="queue-pill">${Number(p.appointment_count) || 0} visits</span></div>
      <h3 class="directory-name">${escapeHtml(p.name)}</h3><p class="directory-subtitle">${escapeHtml(p.email)}</p>
      <div class="patient-contact"><i class="bi bi-telephone"></i>${escapeHtml(p.phone || "No phone provided")}</div>
      <div class="patient-profile-line">${escapeHtml([p.age ? `${p.age} yrs` : "", p.gender || "", p.blood_group || ""].filter(Boolean).join(" · ") || "Profile details not provided")}</div>
      <button class="btn btn-sm btn-outline-primary w-100 mt-3" onclick="showPatientDetails(${Number(p.id)})"><i class="bi bi-person-lines-fill me-1"></i>View patient details</button>
    </article></div>`).join("") : emptyGrid("No patients match your search.", 12);
}

function renderAppointments() {
  const q = document.getElementById("appointment-search").value.trim().toLowerCase();
  const status = document.getElementById("appointment-filter").value;
  const rows = adminAppointments.filter(a => (status === "All" || a.status === status) && `${a.patient_name || ""} ${a.doctor_name} ${a.token_number || ""}`.toLowerCase().includes(q));
  document.getElementById("appointment-result-count").textContent = `${rows.length} ${rows.length === 1 ? "appointment" : "appointments"}`;
  document.getElementById("appointments-grid").innerHTML = rows.length ? rows.slice(0, 60).map(a => `
    <div class="col-sm-6 col-xl-4"><article class="appointment-card h-100">
      <div class="appointment-card-head"><span class="token-text">${escapeHtml(a.token_number || "Appointment")}</span><span class="status-chip status-${String(a.status).toLowerCase()}">${escapeHtml(a.status)}</span></div>
      <h3 class="directory-name mt-3">${escapeHtml(a.patient_name || "Patient")}</h3><p class="directory-subtitle mb-3">${escapeHtml(a.patient_phone || "Patient appointment")}</p>
      <div class="appointment-doctor"><span class="doctor-avatar doctor-avatar-sm"><i class="bi bi-person-badge"></i></span><div><strong>${escapeHtml(a.doctor_name)}</strong><small>${escapeHtml(a.specialty || "Specialist")}</small></div></div>
      <div class="appointment-date"><i class="bi bi-calendar3"></i><span>${formatDate(a.appointment_date)} · ${formatTime(a.appointment_time)}</span></div>
      ${a.status === "Booked" ? `<button class="btn btn-sm btn-outline-danger w-100 mt-3" onclick="cancelAppointment(${Number(a.id)})"><i class="bi bi-x-circle me-1"></i>Cancel booking</button>` : ""}
    </article></div>`).join("") : emptyGrid("No appointments match these filters.", 12);
}

function emptyGrid(message, cols) { return `<div class="col-12"><div class="grid-empty"><i class="bi bi-inbox"></i><span>${escapeHtml(message)}</span></div></div>`; }
function showGridError(id, message) { document.getElementById(id).innerHTML = `<div class="col-12"><div class="grid-empty text-danger">${escapeHtml(message)}</div></div>`; }

function populateSpecialtyFilter() {
  const select = document.getElementById("doctor-specialty-filter");
  const selected = select.value || "All";
  const specialties = [...new Set(adminDoctors.map(doctor => doctor.specialty).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  select.innerHTML = '<option value="All">All specialties</option>' + specialties.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  select.value = specialties.includes(selected) ? selected : "All";
}

function showDoctorDetails(id) {
  const doctor = adminDoctors.find(item => Number(item.id) === Number(id));
  if (!doctor) return;
  openRecordDetails("DOCTOR PROFILE", doctor.name, [
    ["Specialty", doctor.specialty], ["Qualification", doctor.qualification], ["Email", doctor.email],
    ["Experience", `${Number(doctor.experience_years) || 0} years`], ["Consultation fee", `₹${Number(doctor.fee).toLocaleString("en-IN")}`],
    ["Available days", doctor.available_days], ["Clinic hours", `${formatTime(doctor.available_time_start)} – ${formatTime(doctor.available_time_end)}`],
    ["Patient rating", `${Number(doctor.rating || 0).toFixed(1)} / 5 (${Number(doctor.review_count) || 0} reviews)`],
    ["Visits completed", Number(doctor.treated_count) || 0], ["Booked visits", Number(doctor.pending_count) || 0],
    ["About", doctor.bio || "No profile description provided."]
  ]);
}

function showPatientDetails(id) {
  const patient = adminPatients.find(item => Number(item.id) === Number(id));
  if (!patient) return;
  openRecordDetails("PATIENT PROFILE", patient.name, [
    ["Email", patient.email], ["Phone", patient.phone], ["Age", patient.age ? `${patient.age} years` : "Not provided"],
    ["Gender", patient.gender], ["Blood group", patient.blood_group], ["Allergies / health notes", patient.allergies || "None recorded"],
    ["Appointments", Number(patient.appointment_count) || 0], ["Account created", patient.created_at ? String(patient.created_at).slice(0,10) : "Not available"]
  ]);
}

function openRecordDetails(eyebrow, title, fields) {
  document.getElementById("detail-eyebrow").textContent = eyebrow;
  document.getElementById("detail-title").textContent = title;
  document.getElementById("detail-body").innerHTML = `<div class="detail-grid">${fields.map(([label,value]) => `<div class="detail-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "Not provided")}</strong></div>`).join("")}</div>`;
  bootstrap.Modal.getOrCreateInstance(document.getElementById("recordDetailModal")).show();
}

async function cancelAppointment(id) {
  if (!confirm("Cancel this appointment?")) return;
  try { await getJson(`/api/admin/appointments/${id}/cancel`, { method: "POST" }); await Promise.all([loadAppointments(), loadAdminStats()]); }
  catch (error) { alert(error.message); }
}

async function addDoctor(event) {
  event.preventDefault();
  const form = event.currentTarget, button = document.getElementById("add-doctor-submit"), message = document.getElementById("doctor-form-message");
  button.disabled = true; button.textContent = "Creating account…"; message.className = "d-none alert small";
  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    await getJson("/api/admin/doctors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    form.reset(); bootstrap.Modal.getInstance(document.getElementById("addDoctorModal")).hide();
    await Promise.all([loadDoctors(), loadAdminStats()]);
  } catch (error) { message.textContent = error.message; message.className = "alert alert-danger small"; }
  finally { button.disabled = false; button.textContent = "Create doctor account"; }
}

function escapeHtml(value) { const el = document.createElement("span"); el.textContent = value ?? ""; return el.innerHTML; }
function formatTime(value) { if (!value) return "Time not set"; const [h, m] = String(value).split(":"); const n = Number(h); return `${n % 12 || 12}:${m} ${n >= 12 ? "PM" : "AM"}`; }
function formatDate(value) { if (!value) return "Date not set"; const [y,m,d] = String(value).slice(0,10).split("-").map(Number); return new Intl.DateTimeFormat("en-IN", { day:"numeric", month:"short", year:"numeric" }).format(new Date(y,m-1,d)); }
function setupLogout() { document.getElementById("logout-btn").addEventListener("click", async () => { await fetch("/api/logout", { method:"POST" }); window.location.href="/login.html"; }); }
