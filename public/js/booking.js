// Booking Wizard Logic
let selectedSpecialty = "";
let selectedDoctorId = null;
let selectedDate = "";
let selectedTime = null;
let doctors = [];

document.addEventListener("DOMContentLoaded", () => {
  // Check auth
  fetch("/api/me").then(res => {
    if (!res.ok) window.location.href = "/login.html";
  });
});

function nextStep(step) {
  if (step === 2) {
    const radio = document.querySelector('input[name="specialty"]:checked');
    if (!radio) {
      alert("Please select a specialization first.");
      return;
    }
    selectedSpecialty = radio.value;
    loadDoctors();
  }
  
  if (step === 4) {
    const doc = doctors.find(d => d.id == selectedDoctorId);
    document.getElementById("conf-doc-name").textContent = doc.name;
    document.getElementById("conf-doc-spec").textContent = doc.specialty;
    document.getElementById("conf-date-time").textContent = `${selectedDate} at ${formatTime12h(selectedTime)}`;
    document.getElementById("conf-fee").textContent = `₹${doc.fee}`;
  }

  document.querySelectorAll(".booking-step").forEach(s => s.classList.add("d-none"));
  document.getElementById(`step-${step}`).classList.remove("d-none");
  
  // Update indicators
  document.querySelectorAll(".step").forEach((s, idx) => {
    if (idx + 1 < step) s.classList.add("completed");
    if (idx + 1 === step) s.classList.add("active");
    else s.classList.remove("active");
  });
}

function prevStep(step) {
  document.querySelectorAll(".booking-step").forEach(s => s.classList.add("d-none"));
  document.getElementById(`step-${step}`).classList.remove("d-none");
  
  document.querySelectorAll(".step").forEach((s, idx) => {
    if (idx + 1 >= step) {
      s.classList.remove("completed");
      if (idx + 1 === step) s.classList.add("active");
      else s.classList.remove("active");
    }
  });
}

async function loadDoctors() {
  const container = document.getElementById("doctor-list");
  container.innerHTML = '<div class="text-center py-4 w-100"><span class="spinner-border spinner-border-sm"></span> Loading Indian specialists...</div>';
  
  try {
    const res = await fetch(`/api/doctors?specialty=${selectedSpecialty}`);
    doctors = await res.json();
    
    if (doctors.length === 0) {
      container.innerHTML = '<div class="alert alert-info w-100">No doctors available for this specialty currently.</div>';
      return;
    }

    container.innerHTML = doctors.map(doc => `
      <div class="col-md-6">
        <div class="card border p-3 h-100 doctor-card pointer" onclick="selectDoctor(${doc.id}, this)">
          <div class="d-flex align-items-center">
            <span class="doctor-avatar me-3"><i class="bi bi-person-badge"></i></span>
            <div>
              <h6 class="fw-bold mb-0">${doc.name}</h6>
              <small class="text-primary">${doc.qualification}</small>
              <div class="small text-muted mt-1"><i class="bi bi-star-fill text-warning"></i> ${doc.rating} (${doc.review_count} reviews)</div>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger w-100">Failed to load doctors.</div>';
  }
}

function selectDoctor(id, el) {
  selectedDoctorId = id;
  document.querySelectorAll(".doctor-card").forEach(c => c.classList.remove("border-primary", "bg-primary-subtle"));
  el.classList.add("border-primary", "bg-primary-subtle");
  document.getElementById("btn-to-step-3").disabled = false;
  
  const doc = doctors.find(d => d.id == id);
  document.getElementById("doc-available-days").textContent = doc.available_days;
  
  // Reset date and slots
  document.getElementById("booking-date").value = "";
  document.getElementById("slots-container").innerHTML = '<div class="text-muted small py-4 text-center w-100">Select a date to view slots.</div>';
}

async function loadSlots() {
  selectedDate = document.getElementById("booking-date").value;
  const container = document.getElementById("slots-container");
  
  if (!selectedDate) return;
  
  container.innerHTML = '<div class="text-center py-4 w-100"><span class="spinner-border spinner-border-sm text-primary"></span> Checking slots...</div>';
  
  try {
    const res = await fetch(`/api/doctors/${selectedDoctorId}/available-slots?date=${selectedDate}`);
    const data = await res.json();
    
    if (!data.available) {
      container.innerHTML = `<div class="alert alert-warning small w-100">${data.message}</div>`;
      return;
    }

    container.innerHTML = data.slots.map(s => `
      <button class="slot-btn ${s.isAvailable ? '' : 'booked'}" 
              ${s.isAvailable ? '' : 'disabled'} 
              onclick="selectSlot('${s.time}', this)">
        ${s.label}
      </button>
    `).join("");
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger small w-100">Failed to load slots.</div>';
  }
}

function selectSlot(time, el) {
  selectedTime = time;
  document.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  document.getElementById("btn-to-step-4").disabled = false;
}

async function finishBooking() {
  const btn = document.getElementById("btn-finish");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Booking...';
  
  try {
    const profileResponse = await fetch("/api/me");
    const profileData = await profileResponse.json();
    if (!profileResponse.ok) throw new Error(profileData.message || "Please sign in before booking.");
    const res = await fetch("/api/patient/book-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: selectedDoctorId,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime,
        reason: document.getElementById("booking-reason").value,
        patientName: profileData.user.name,
        patientPhone: profileData.user.phone,
        patientAge: profileData.user.age,
        patientGender: profileData.user.gender
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert(`Booking successful! Your token is ${data.tokenNumber}.`);
      window.location.href = "/patient-dashboard.html";
    } else {
      alert(data.message);
      btn.disabled = false;
      btn.innerHTML = 'Confirm & Book Now <i class="bi bi-check-circle ms-2"></i>';
    }
  } catch (err) {
    alert(err.message || "An error occurred. Please try again.");
    btn.disabled = false;
    btn.innerHTML = 'Confirm & Book Now <i class="bi bi-check-circle ms-2"></i>';
  }
}

function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hours = parseInt(h);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${m} ${ampm}`;
}
