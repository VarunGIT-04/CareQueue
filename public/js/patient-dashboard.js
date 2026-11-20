// Patient Dashboard Logic
document.addEventListener("DOMContentLoaded", () => {
  loadPatientData();
  setupLogout();
});

async function loadPatientData() {
  try {
    const res = await fetch("/api/patient/dashboard");
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/login.html";
      throw new Error("Failed to load dashboard data");
    }
    const data = await res.json();
    
    // Update UI
    document.getElementById("nav-user-name").textContent = data.patient.name;
    document.getElementById("dash-greeting-name").textContent = data.patient.name;
    
    document.getElementById("stat-upcoming").textContent = data.stats.upcomingCount;
    document.getElementById("stat-completed").textContent = data.stats.completedCount;
    document.getElementById("stat-prescriptions").textContent = data.stats.prescriptionCount;
    document.getElementById("stat-tokens").textContent = data.stats.upcomingCount; // Simple mapping for token count

    renderNextAppointment(data.nextAppointment);
  } catch (err) {
    console.error(err);
  }
}

function renderNextAppointment(apt) {
  const container = document.getElementById("next-appointment-container");
  if (!apt) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-calendar2-x fs-1 d-block mb-3"></i>
        <p>No upcoming appointments found.</p>
        <a href="/book-appointment.html" class="btn btn-primary btn-sm">Book Now</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="d-flex align-items-center p-3 bg-light rounded-4 mb-3">
      <span class="doctor-avatar doctor-avatar-lg me-3"><i class="bi bi-person-badge"></i></span>
      <div class="flex-grow-1">
        <div class="badge bg-primary-subtle text-primary mb-1">${apt.token_number}</div>
        <h5 class="fw-bold mb-0">${apt.doctor_name}</h5>
        <div class="text-muted small">${apt.specialty} • ${apt.qualification}</div>
      </div>
      <div class="text-end">
        <div class="fw-bold text-dark"><i class="bi bi-calendar3 me-1"></i> ${apt.appointment_date}</div>
        <div class="text-primary fw-bold"><i class="bi bi-clock me-1"></i> ${formatTime12h(apt.appointment_time)}</div>
      </div>
    </div>
    <div class="d-grid">
      <a href="/my-appointments.html" class="btn btn-outline-primary">Manage Appointment</a>
    </div>
  `;
}

function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hours = parseInt(h);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${m} ${ampm}`;
}

function setupLogout() {
  document.getElementById("logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
}
