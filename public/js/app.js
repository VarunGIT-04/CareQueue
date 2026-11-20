// ========================================================
// Homepage Dynamic Experience Engine (public/js/app.js)
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
  initHomepageStats();
  initHomepageDoctors();
  checkAuthStatus();
});

function escapeHtml(val) {
  const span = document.createElement("span");
  span.textContent = val ?? "";
  return span.innerHTML;
}

// 1. Dynamic Live Stats
async function initHomepageStats() {
  const statDoctors = document.getElementById("home-stat-doctors");
  const statSpecialties = document.getElementById("home-stat-specialties");
  const statAppointments = document.getElementById("home-stat-appointments");
  const statUsers = document.getElementById("home-stat-users");

  if (!statDoctors) return;

  try {
    const res = await fetch("/api/public-stats");
    if (!res.ok) return;
    const stats = await res.json();

    statDoctors.textContent = stats.totalDoctors;
    if (statSpecialties) statSpecialties.textContent = stats.totalSpecialties;
    if (statAppointments) statAppointments.textContent = stats.totalAppointments;
    if (statUsers) statUsers.textContent = stats.totalPatients;
  } catch (err) {
    console.warn("Could not load stats:", err);
  }
}

// 2. Dynamic Doctor Showcase & Filter
let homeDoctorsList = [];

async function initHomepageDoctors() {
  const container = document.getElementById("home-doctors-grid");
  if (!container) return;

  try {
    const res = await fetch("/api/doctors");
    if (!res.ok) throw new Error("Could not fetch doctors.");
    homeDoctorsList = await res.json();

    renderHomeDoctors(homeDoctorsList);
  } catch (err) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-4">Unable to load doctors dynamically.</div>`;
  }
}

function renderHomeDoctors(doctors) {
  const container = document.getElementById("home-doctors-grid");
  if (!container) return;

  if (doctors.length === 0) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-4">No specialists found in this category.</div>`;
    return;
  }

  container.innerHTML = doctors.map((doc, idx) => `
    <div class="col-lg-4 col-md-6 d-flex align-items-stretch" data-aos="fade-up" data-aos-delay="${(idx + 1) * 100}">
      <div class="team-member w-100 shadow-sm border rounded-3 p-3 bg-white d-flex flex-column">
        <div class="member-img position-relative overflow-hidden rounded-3 mb-3 text-center">
          <span class="doctor-avatar doctor-avatar-feature" aria-label="Doctor icon"><i class="bi bi-person-badge"></i></span>
          <span class="badge bg-primary position-absolute top-0 end-0 m-2">₹${Number(doc.fee).toFixed(0)}</span>
        </div>
        <div class="member-info flex-grow-1 d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <h5 class="fw-bold mb-0">${escapeHtml(doc.name)}</h5>
            <div class="text-warning small"><i class="bi bi-star-fill"></i> ${Number(doc.rating).toFixed(1)}</div>
          </div>
          <span class="text-primary fw-semibold small mb-2 d-block">${escapeHtml(doc.specialty)} • ${escapeHtml(doc.qualification || 'MBBS')}</span>
          <p class="text-muted small mb-3 flex-grow-1">${escapeHtml(doc.bio || 'Experienced specialist committed to patient wellness.')}</p>
          
          <div class="border-top pt-2 mt-auto d-flex justify-content-between align-items-center">
            <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${escapeHtml(doc.available_days)}</small>
            <a href="/book-appointment.html" class="btn btn-sm btn-outline-primary fw-semibold">
              <i class="bi bi-calendar-plus me-1"></i> Book Slot
            </a>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

// Specialty Filter on Homepage
window.filterHomeDoctors = function(specialty, btn) {
  document.querySelectorAll(".home-spec-btn").forEach((b) => {
    b.classList.remove("btn-primary");
    b.classList.add("btn-outline-primary");
  });
  btn.classList.remove("btn-outline-primary");
  btn.classList.add("btn-primary");

  if (specialty === "All") {
    renderHomeDoctors(homeDoctorsList);
  } else {
    const filtered = homeDoctorsList.filter((d) => d.specialty.toLowerCase().includes(specialty.toLowerCase()));
    renderHomeDoctors(filtered);
  }
};

// 3. User Session Check for Navigation
async function checkAuthStatus() {
  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data = await res.json();
      const navMenu = document.querySelector("#navmenu ul");
      const ctaBtn = document.querySelector(".cta-btn");

      if (data && data.user) {
        if (ctaBtn) {
          ctaBtn.textContent = `Portal (${data.user.name})`;
          ctaBtn.href = "/portal.html";
          ctaBtn.className = "cta-btn btn-success d-none d-sm-block";
        }
        if (navMenu) {
          navMenu.insertAdjacentHTML(
            "beforeend",
            `<li><a href="/portal.html" class="fw-bold text-primary"><i class="bi bi-speedometer2 me-1"></i>My Portal</a></li>`
          );
        }
      }
    }
  } catch {
    // Visitor not logged in
  }
}
