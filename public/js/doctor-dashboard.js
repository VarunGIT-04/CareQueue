let currentQueue = [];
let activeApt = null;
let queueFilter = "Booked";

document.addEventListener("DOMContentLoaded", () => {
  loadDoctorProfile();
  loadQueue();
  document.getElementById("logout-btn")?.addEventListener("click", async (event) => {
    event.preventDefault();
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/login.html?role=doctor";
  });
  document.getElementById("refresh-queue")?.addEventListener("click", () => loadQueue(true));

  document.querySelectorAll(".doctor-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".doctor-nav-link").forEach((el) => el.classList.remove("active"));
      link.classList.add("active");
    });
  });
});

async function loadDoctorProfile() {
  try {
    const res = await fetch("/api/doctor/dashboard", { credentials: "same-origin" });
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/login.html?role=doctor";
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not load your doctor profile.");
    document.getElementById("doc-name").textContent = data.doctor.name;
    document.getElementById("doc-specialty").textContent = data.doctor.specialty;
    const initials = (data.doctor.name || "DR").replace(/^Dr\.?\s*/i, "").trim().slice(0, 1).toUpperCase();
    const avatar = document.getElementById("doc-avatar-initial");
    if (avatar) avatar.textContent = initials || "D";
  } catch (error) {
    showQueueError(error.message);
  }
}

async function loadQueue(isManualRefresh = false) {
  const refreshButton = document.getElementById("refresh-queue");
  const refreshLabel = document.getElementById("refresh-label");
  const refreshIcon = document.getElementById("refresh-icon");
  if (refreshButton?.disabled) return;
  if (refreshButton) refreshButton.disabled = true;
  if (refreshLabel) refreshLabel.textContent = "Refreshing…";
  refreshIcon?.classList.add("spin");
  try {
    const res = await fetch("/api/doctor/appointments", { cache: "no-store", credentials: "same-origin" });
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/login.html?role=doctor";
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not load appointments.");
    if (!Array.isArray(data)) throw new Error("The appointments response was not valid.");
    currentQueue = data;
    document.getElementById("queue-updated-at").textContent = `Updated ${new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date())}`;
    const booked = currentQueue.filter((a) => a.status === "Booked").sort(compareAppointmentTime);
    document.getElementById("pending-count").textContent = booked.length;

    if (activeApt && !currentQueue.some((a) => a.id === activeApt.id && a.status === activeApt.status)) {
      activeApt = null;
    }
    renderQueue();

    if (activeApt) {
      const refreshed = currentQueue.find((a) => a.id === activeApt.id);
      if (refreshed) showAppointment(refreshed);
    } else if (queueFilter === "Booked" && booked.length) {
      selectPatient(booked[0].id);
    } else if (queueFilter === "Booked") {
      showEmpty();
    }
  } catch (error) {
    showQueueError(error.message);
    if (isManualRefresh) {
      document.getElementById("queue-updated-at").textContent = "Refresh failed — try again";
    }
  } finally {
    if (refreshButton) refreshButton.disabled = false;
    if (refreshLabel) refreshLabel.textContent = "Refresh Queue";
    refreshIcon?.classList.remove("spin");
  }
}

function compareAppointmentTime(a, b) {
  return `${String(a.appointment_date).slice(0, 10)} ${a.appointment_time}`.localeCompare(
    `${String(b.appointment_date).slice(0, 10)} ${b.appointment_time}`
  );
}

function setQueueFilter(filter) {
  queueFilter = filter;
  activeApt = null;
  document.getElementById("filter-booked").className =
    filter === "Booked" ? "btn btn-primary" : "btn btn-outline-secondary";
  document.getElementById("filter-completed").className =
    filter === "Completed" ? "btn btn-primary" : "btn btn-outline-secondary";
  document.getElementById("next-patient-notice")?.classList.add("d-none");
  renderQueue();
  const visible = getVisibleAppointments();
  if (visible.length) selectPatient(visible[0].id);
  else showEmpty();
}

function getVisibleAppointments() {
  return currentQueue
    .filter((appointment) => appointment.status === queueFilter)
    .sort(queueFilter === "Booked" ? compareAppointmentTime : (a, b) => compareAppointmentTime(b, a));
}

function renderQueue() {
  const container = document.getElementById("patient-queue-list");
  const appointments = getVisibleAppointments();
  document.getElementById("queue-visible-count").textContent = appointments.length;
  if (!appointments.length) {
    container.innerHTML = `<div class="text-center py-5 px-3 text-muted"><i class="bi ${
      queueFilter === "Booked" ? "bi-calendar2-check" : "bi-journal-check"
    } fs-2 d-block mb-2"></i>${
      queueFilter === "Booked" ? "No booked appointments yet." : "No completed visits yet."
    }</div>`;
    return;
  }
  container.innerHTML = appointments
    .map(
      (apt) => `
    <button type="button" class="list-group-item list-group-item-action p-3 patient-queue-card ${
      activeApt?.id === apt.id ? "active-patient" : ""
    }" onclick="selectPatient(${Number(apt.id)})">
      <div class="d-flex justify-content-between align-items-center">
        <span class="badge ${
          apt.status === "Completed" ? "bg-success-subtle text-success" : "bg-primary-subtle text-primary"
        }">${escapeHtml(apt.token_number || "Appointment")}</span>
        <small class="text-muted fw-bold">${formatTime12h(apt.appointment_time)}</small>
      </div>
      <h6 class="fw-bold mt-2 mb-1">${escapeHtml(apt.patient_name || "Patient")}</h6>
      <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${formatDate(apt.appointment_date)}${
        apt.patient_age ? ` · ${Number(apt.patient_age)} yrs` : ""
      }</small>
    </button>`
    )
    .join("");
}

function selectPatient(id) {
  document.getElementById("next-patient-notice")?.classList.add("d-none");
  activeApt = currentQueue.find((a) => Number(a.id) === Number(id));
  if (!activeApt) return;
  queueFilter = activeApt.status;
  document.getElementById("filter-booked").className =
    queueFilter === "Booked" ? "btn btn-primary" : "btn btn-outline-secondary";
  document.getElementById("filter-completed").className =
    queueFilter === "Completed" ? "btn btn-primary" : "btn btn-outline-secondary";
  renderQueue();
  showAppointment(activeApt);
  document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showAppointment(appointment) {
  document.getElementById("no-active-panel").classList.add("d-none");
  document.getElementById("active-consultation-panel").classList.remove("d-none");
  document.getElementById("active-token").textContent = appointment.token_number || "Appointment";
  document.getElementById("active-patient-name").textContent = appointment.patient_name || "Patient";
  const details = [
    appointment.patient_gender,
    appointment.patient_age ? `${appointment.patient_age} years` : "",
    formatDate(appointment.appointment_date),
    formatTime12h(appointment.appointment_time)
  ].filter(Boolean);
  document.getElementById("active-patient-meta").textContent = details.join(" · ");
  document.getElementById("active-reason").textContent = appointment.reason || "No specific reason provided.";
  const booked = appointment.status === "Booked";
  document.getElementById("clinical-notes").disabled = !booked;
  document.getElementById("prescription-text").disabled = !booked;
  document.getElementById("clinical-notes").value = appointment.doctor_notes || "";
  document.getElementById("prescription-text").value = prescriptionToText(appointment.prescription);
  document.getElementById("complete-consultation").classList.toggle("d-none", !booked);
  const statusBadge = document.getElementById("consult-status-badge");
  if (statusBadge) {
    statusBadge.innerHTML = booked
      ? '<i class="bi bi-person-check me-1"></i>Ready for consultation'
      : '<i class="bi bi-check-circle me-1"></i>Completed visit · Read only';
    statusBadge.className = booked
      ? "badge bg-success-subtle text-success px-3 py-2"
      : "badge bg-secondary-subtle text-secondary px-3 py-2";
  }
}

function prescriptionToText(value) {
  if (!value) return "";
  try {
    const items = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(items)) {
      return items
        .map((item) =>
          typeof item === "string" ? item : [item.name, item.dosage, item.duration].filter(Boolean).join(" — ")
        )
        .join("\n");
    }
    return String(value);
  } catch {
    return String(value);
  }
}

function showEmpty() {
  activeApt = null;
  document.getElementById("active-consultation-panel").classList.add("d-none");
  document.getElementById("no-active-panel").classList.remove("d-none");
  document.getElementById("no-active-panel").querySelector("h5").textContent =
    queueFilter === "Booked" ? "No booked visits to show." : "No completed visits to show.";
  document.getElementById("no-active-panel").querySelector("p").textContent =
    queueFilter === "Booked"
      ? "Appointments booked with your doctor account will appear here."
      : "Completed consultations will appear here for review.";
}

function showQueueError(message) {
  const list = document.getElementById("patient-queue-list");
  if (list) {
    list.innerHTML = `<div class="text-center py-4 px-3 text-danger">${escapeHtml(
      message
    )}<br><button type="button" class="btn btn-sm btn-outline-primary mt-3" onclick="loadQueue()">Try again</button></div>`;
  }
}

function escapeHtml(value) {
  const el = document.createElement("span");
  el.textContent = value ?? "";
  return el.innerHTML;
}

function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [h, m] = String(timeStr).split(":");
  const hour = Number(h);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

async function completeConsultation() {
  if (!activeApt || activeApt.status !== "Booked") return;
  const btn = document.getElementById("complete-consultation");
  const doctorNotes = document.getElementById("clinical-notes").value.trim();
  const rxText = document.getElementById("prescription-text").value.trim();
  const formError = document.getElementById("consult-form-error");

  if (formError) {
    formError.classList.add("d-none");
    formError.textContent = "";
  }

  if (!doctorNotes) {
    if (formError) {
      formError.textContent = "Please add consultation notes before completing this visit.";
      formError.classList.remove("d-none");
    } else {
      alert("Please add consultation notes before completing this visit.");
    }
    document.getElementById("clinical-notes").focus();
    return;
  }

  btn.disabled = true;
  const originalLabel = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving…`;

  try {
    const prescription = rxText
      ? rxText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((name) => ({ name, dosage: "As directed", duration: "As prescribed" }))
      : [];

    const res = await fetch(`/api/doctor/appointments/${activeApt.id}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorNotes, prescription })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Unable to complete this consultation.");

    const completedName = result.completedPatient || activeApt.patient_name || "Patient";
    activeApt = null;
    await loadQueue();

    const notice = document.getElementById("next-patient-notice");
    if (notice) {
      const nextName = result.nextPatient?.patient_name || activeApt?.patient_name;
      notice.textContent = nextName
        ? `${completedName}'s visit is complete. ${nextName} is ready to come in.`
        : `${completedName}'s visit is complete. There are no more booked visits in the queue.`;
      notice.classList.remove("d-none");
    }
  } catch (error) {
    if (formError) {
      formError.textContent = error.message;
      formError.classList.remove("d-none");
    } else {
      alert(error.message);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}
