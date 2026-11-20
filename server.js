require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  session({
   secret: process.env.SESSION_SECRET,
resave: false,
saveUninitialized: false,
cookie: {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 24
}
  })
);

const { getDbConfig } = require("./db-config");

const db = mysql.createPool({
  ...getDbConfig(),
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true
});

// Helper: 24h to 12h format
function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

// -------------------------------------------------------------
// AUTHENTICATION MIDDLEWARES
// -------------------------------------------------------------
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please log in first." });
  }
  next();
}

function requireDoctor(req, res, next) {
  if (!req.session.user || req.session.user.role !== "doctor") {
    return res.status(403).json({ message: "Access restricted to medical doctors only." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Access restricted to hospital administrators only." });
  }
  next();
}

// -------------------------------------------------------------
// PUBLIC & HEALTH ENDPOINTS
// -------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true, message: "Connected to hospital database." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Database connection failed." });
  }
});

app.get("/api/public-stats", async (req, res) => {
  try {
    const [[{ totalDoctors }]] = await db.query("SELECT COUNT(*) AS totalDoctors FROM doctors");
    const [[{ totalSpecialties }]] = await db.query("SELECT COUNT(DISTINCT specialty) AS totalSpecialties FROM doctors");
    const [[{ totalAppointments }]] = await db.query("SELECT COUNT(*) AS totalAppointments FROM appointments");
    const [[{ totalPatients }]] = await db.query("SELECT COUNT(*) AS totalPatients FROM users WHERE role = 'patient'");

    res.json({
      totalDoctors: Number(totalDoctors),
      totalSpecialties: Number(totalSpecialties),
      totalAppointments: Number(totalAppointments),
      totalPatients: Number(totalPatients)
    });
  } catch (error) {
    res.status(500).json({ message: "Could not load hospital stats." });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION (PATIENT / DOCTOR / ADMIN)
// -------------------------------------------------------------
app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const phone = String(req.body.phone || "").trim();
    const gender = String(req.body.gender || "").trim();
    const age = req.body.age ? parseInt(req.body.age, 10) : null;
    const bloodGroup = String(req.body.bloodGroup || "").trim();

    if (!name || !email || password.length < 6) {
      return res.status(400).json({
        message: "Please enter your full name, valid email, and password of at least 6 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, gender, age, blood_group, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'patient')`,
      [name, email, passwordHash, phone || null, gender || null, age || null, bloodGroup || null]
    );

    req.session.user = {
      id: result.insertId,
      name,
      email,
      role: "patient"
    };

    res.status(201).json({
      message: "Patient registration successful!",
      user: req.session.user,
      redirectUrl: "/patient-dashboard.html"
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "This email address is already registered." });
    }
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Could not complete registration." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const [users] = await db.query(
      "SELECT id, name, email, password_hash, role, phone FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email address or password." });
    }

    const user = users[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email address or password." });
    }

    let doctorId = null;
    let redirectUrl = "/patient-dashboard.html";

    if (user.role === "doctor") {
      const [doc] = await db.query(
        "SELECT id FROM doctors WHERE user_id = ? OR email = ?",
        [user.id, user.email]
      );
      if (doc.length > 0) {
        doctorId = doc[0].id;
      }
      redirectUrl = "/doctor-dashboard.html";
    } else if (user.role === "admin") {
      redirectUrl = "/admin-dashboard.html";
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "patient",
      doctorId
    };

    res.json({
      message: "Login successful.",
      user: req.session.user,
      redirectUrl
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Could not complete login." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: "Could not log out." });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully.", redirectUrl: "/login.html" });
  });
});

app.get("/api/me", requireLogin, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, email, phone, gender, age, blood_group, allergies, role FROM users WHERE id = ?",
      [req.session.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ user: users[0], session: req.session.user });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user profile." });
  }
});

app.put("/api/profile", requireLogin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    const age = req.body.age ? Number.parseInt(req.body.age, 10) : null;
    const gender = String(req.body.gender || "").trim();
    const bloodGroup = String(req.body.blood_group || req.body.bloodGroup || "").trim();
    const allergies = String(req.body.allergies || "").trim();
    if (!name) return res.status(400).json({ message: "Please enter your name." });
    await db.query(
      "UPDATE users SET name = ?, phone = ?, age = ?, gender = ?, blood_group = ?, allergies = ? WHERE id = ?",
      [name, phone || null, age, gender || null, bloodGroup || null, allergies || null, req.session.user.id]
    );
    req.session.user.name = name;
    res.json({ message: "Your profile has been saved." });
  } catch (error) {
    res.status(500).json({ message: "Could not save your profile." });
  }
});

// -------------------------------------------------------------
// DOCTORS & AVAILABILITY SLOTS
// -------------------------------------------------------------
app.get("/api/doctors", async (req, res) => {
  try {
    const { specialty } = req.query;
    let sql = "SELECT * FROM doctors WHERE 1=1";
    const params = [];

    if (specialty && specialty !== "All") {
      sql += " AND specialty = ?";
      params.push(specialty);
    }

    sql += " ORDER BY id ASC";
    const [doctors] = await db.query(sql, params);
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Failed to load doctors list." });
  }
});

app.get("/api/doctors/:id", async (req, res) => {
  try {
    const [doctors] = await db.query("SELECT * FROM doctors WHERE id = ?", [Number(req.params.id)]);
    if (doctors.length === 0) {
      return res.status(404).json({ message: "Doctor not found." });
    }
    res.json(doctors[0]);
  } catch (error) {
    res.status(500).json({ message: "Error loading doctor details." });
  }
});

app.get("/api/doctors/:id/available-slots", async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    const { date } = req.query;

    if (!doctorId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Valid doctor ID and date (YYYY-MM-DD) are required." });
    }

    const [doctors] = await db.query("SELECT * FROM doctors WHERE id = ?", [doctorId]);
    if (doctors.length === 0) {
      return res.status(404).json({ message: "Doctor not found." });
    }

    const doctor = doctors[0];
    const [year, month, day] = date.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetWeekday = weekdayNames[parsedDate.getDay()];

    const availableDays = (doctor.available_days || "").split(",").map((s) => s.trim());
    if (!availableDays.includes(targetWeekday)) {
      return res.json({
        available: false,
        message: `${doctor.name} is available on ${doctor.available_days}. Not available on ${targetWeekday}s.`,
        slots: []
      });
    }

    // Booked slots on this date
    const [bookedRows] = await db.query(
      `SELECT appointment_time FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND status = 'Booked'`,
      [doctorId, date]
    );

    const bookedTimes = new Set(bookedRows.map((r) => String(r.appointment_time).slice(0, 5)));

    const startTime = doctor.available_time_start || "09:00:00";
    const endTime = doctor.available_time_end || "17:00:00";
    const slotDuration = doctor.slot_duration_minutes || 30;

    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    const now = new Date();
    const todayStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let m = startTotal; m < endTotal; m += slotDuration) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const isBooked = bookedTimes.has(timeStr);
      const isPast = date === todayStr && m <= currentMinutes;

      slots.push({
        time: timeStr,
        label: formatTime12h(timeStr),
        isBooked,
        isPast,
        isAvailable: !isBooked && !isPast
      });
    }

    res.json({
      available: true,
      weekday: targetWeekday,
      slots
    });
  } catch (error) {
    res.status(500).json({ message: "Could not calculate slots." });
  }
});

// -------------------------------------------------------------
// PATIENT MODULE API
// -------------------------------------------------------------
app.get("/api/patient/dashboard", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [users] = await db.query(
      "SELECT id, name, email, phone, gender, age, blood_group FROM users WHERE id = ?",
      [userId]
    );

    const [[{ upcomingCount }]] = await db.query(
      "SELECT COUNT(*) AS upcomingCount FROM appointments WHERE user_id = ? AND status = 'Booked' AND appointment_date >= CURDATE()",
      [userId]
    );

    const [[{ completedCount }]] = await db.query(
      "SELECT COUNT(*) AS completedCount FROM appointments WHERE user_id = ? AND status = 'Completed'",
      [userId]
    );

    const [[{ prescriptionCount }]] = await db.query(
      "SELECT COUNT(*) AS prescriptionCount FROM appointments WHERE user_id = ? AND prescription IS NOT NULL AND status = 'Completed'",
      [userId]
    );

    const [nextAppointment] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time, a.status,
              d.name AS doctor_name, d.specialty, d.qualification, d.fee, d.image_url
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.user_id = ? AND a.status = 'Booked' AND a.appointment_date >= CURDATE()
       ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 1`,
      [userId]
    );

    res.json({
      patient: users[0],
      stats: {
        upcomingCount: Number(upcomingCount),
        completedCount: Number(completedCount),
        prescriptionCount: Number(prescriptionCount)
      },
      nextAppointment: nextAppointment.length > 0 ? nextAppointment[0] : null
    });
  } catch (error) {
    console.error("Patient dashboard error:", error.message);
    res.status(500).json({ message: "Failed to load patient dashboard." });
  }
});

app.post("/api/patient/book-appointment", requireLogin, async (req, res) => {
  try {
    const doctorId = Number(req.body.doctorId);
    const appointmentDate = String(req.body.appointmentDate || "");
    const appointmentTime = String(req.body.appointmentTime || "");
    const patientName = String(req.body.patientName || req.session.user.name).trim();
    const patientPhone = String(req.body.patientPhone || "").trim();
    const patientAge = req.body.patientAge ? parseInt(req.body.patientAge, 10) : null;
    const patientGender = String(req.body.patientGender || "Male").trim();
    const reason = String(req.body.reason || "").trim();

    if (!doctorId || !appointmentDate || !appointmentTime || !patientName || !patientPhone) {
      return res.status(400).json({ message: "Please fill in all required appointment details." });
    }

    const [doctors] = await db.query("SELECT id, name, fee, available_days, available_time_start, available_time_end, slot_duration_minutes FROM doctors WHERE id = ?", [doctorId]);
    if (doctors.length === 0) {
      return res.status(400).json({ message: "Selected doctor does not exist." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}$/.test(appointmentTime)) {
      return res.status(400).json({ message: "Choose a valid appointment date and time." });
    }
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const [hour, minute] = appointmentTime.split(":").map(Number);
    const chosenDate = new Date(year, month - 1, day);
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][chosenDate.getDay()];
    const chosenMinutes = hour * 60 + minute;
    const startParts = String(doctors[0].available_time_start || "09:00:00").split(":").map(Number);
    const endParts = String(doctors[0].available_time_end || "17:00:00").split(":").map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    const slotDuration = Number(doctors[0].slot_duration_minutes) || 30;
    const availableDays = String(doctors[0].available_days || "").split(",").map(value => value.trim());
    if (!availableDays.includes(weekday) || chosenMinutes < startMinutes || chosenMinutes >= endMinutes || (chosenMinutes - startMinutes) % slotDuration !== 0) {
      return res.status(400).json({ message: "That time is outside this doctor's available schedule. Please select an available slot." });
    }
    const [[currentDate]] = await db.query("SELECT CURDATE() AS today");
    if (appointmentDate < currentDate.today) {
      return res.status(400).json({ message: "Please choose a future appointment date." });
    }

    // Check slot clash
    const [conflict] = await db.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status = 'Booked'`,
      [doctorId, appointmentDate, appointmentTime]
    );

    if (conflict.length > 0) {
      return res.status(409).json({ message: "This slot is already booked. Please choose another slot." });
    }

    // Count existing to generate clean sequential token ID: e.g. #TKN-104
    const [[{ maxId }]] = await db.query("SELECT COALESCE(MAX(id), 0) AS maxId FROM appointments");
    const nextToken = `#TKN-${String(100 + Number(maxId) + 1)}`;

    const [insertResult] = await db.query(
      `INSERT INTO appointments 
       (token_number, user_id, patient_name, patient_phone, patient_age, patient_gender, doctor_id, appointment_date, appointment_time, type, reason, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'In-Person', ?, 'Booked', 'Confirmed')`,
      [nextToken, req.session.user.id, patientName, patientPhone, patientAge, patientGender, doctorId, appointmentDate, appointmentTime, reason || null]
    );

    res.status(201).json({
      message: "Appointment successfully booked and allotted!",
      appointmentId: insertResult.insertId,
      tokenNumber: nextToken,
      fee: doctors[0].fee
    });
  } catch (error) {
    console.error("Booking error:", error.message);
    res.status(500).json({ message: "Could not book appointment." });
  }
});

app.get("/api/patient/appointments", requireLogin, async (req, res) => {
  try {
    const [appointments] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time, a.patient_name, a.patient_phone,
              a.patient_age, a.patient_gender, a.reason, a.status, a.doctor_notes, a.prescription, a.created_at,
              d.name AS doctor_name, d.specialty, d.qualification, d.fee, d.image_url
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.user_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [req.session.user.id]
    );
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Could not load appointments." });
  }
});

app.post("/api/patient/appointments/:id/cancel", requireLogin, async (req, res) => {
  try {
    const aptId = Number(req.params.id);
    const [result] = await db.query(
      "UPDATE appointments SET status = 'Cancelled' WHERE id = ? AND user_id = ? AND status = 'Booked'",
      [aptId, req.session.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Appointment not found or already cancelled." });
    }

    res.json({ message: "Appointment cancelled successfully." });
  } catch (error) {
    res.status(500).json({ message: "Could not cancel appointment." });
  }
});

app.get("/api/patient/prescriptions", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time, a.patient_name,
              a.doctor_notes, a.prescription, a.completed_at,
              d.name AS doctor_name, d.specialty, d.qualification
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.user_id = ? AND a.status = 'Completed' AND a.prescription IS NOT NULL
       ORDER BY a.completed_at DESC, a.appointment_date DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Could not load prescriptions." });
  }
});

// -------------------------------------------------------------
// DOCTOR MODULE API
// -------------------------------------------------------------
app.get("/api/doctor/dashboard", requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.doctorId;
    if (!doctorId) {
      return res.status(400).json({ message: "Doctor profile not linked to user account." });
    }

    const [docs] = await db.query("SELECT * FROM doctors WHERE id = ?", [doctorId]);
    if (docs.length === 0) {
      return res.status(404).json({ message: "Doctor record not found." });
    }

    const [[{ todayCount }]] = await db.query(
      "SELECT COUNT(*) AS todayCount FROM appointments WHERE doctor_id = ? AND appointment_date = CURDATE() AND status != 'Cancelled'",
      [doctorId]
    );

    const [[{ pendingCount }]] = await db.query(
      "SELECT COUNT(*) AS pendingCount FROM appointments WHERE doctor_id = ? AND status = 'Booked' AND appointment_date >= CURDATE()",
      [doctorId]
    );

    const [[{ treatedCount }]] = await db.query(
      "SELECT COUNT(*) AS treatedCount FROM appointments WHERE doctor_id = ? AND status = 'Completed'",
      [doctorId]
    );

    const [todayAppointments] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time,
              a.patient_name, a.patient_phone, a.patient_age, a.patient_gender, a.reason, a.status
       FROM appointments a
       WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
       ORDER BY a.appointment_time ASC`,
      [doctorId]
    );

    res.json({
      doctor: docs[0],
      stats: {
        todayCount: Number(todayCount),
        pendingCount: Number(pendingCount),
        treatedCount: Number(treatedCount)
      },
      todayAppointments
    });
  } catch (error) {
    console.error("Doctor dashboard error:", error.message);
    res.status(500).json({ message: "Failed to load doctor dashboard." });
  }
});

app.get("/api/doctor/appointments", requireDoctor, async (req, res) => {
  try {
    const doctorId = req.session.user.doctorId;
    const [appointments] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time,
              a.patient_name, a.patient_phone, a.patient_age, a.patient_gender,
              a.reason, a.status, a.doctor_notes, a.prescription, a.completed_at
       FROM appointments a
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time ASC`,
      [doctorId]
    );
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Failed to load doctor appointments." });
  }
});

app.post("/api/doctor/appointments/:id/complete", requireDoctor, async (req, res) => {
  try {
    const appointmentId = Number(req.params.id);
    const doctorId = req.session.user.doctorId;
    if (!doctorId) {
      return res.status(400).json({ message: "Doctor profile not linked to user account." });
    }

    const doctorNotes = String(req.body.doctorNotes || "").trim();
    if (!doctorNotes) {
      return res.status(400).json({ message: "Please add consultation notes before completing this visit." });
    }

    const prescriptionList = Array.isArray(req.body.prescription) ? req.body.prescription : [];

    const [apt] = await db.query(
      "SELECT id, patient_name FROM appointments WHERE id = ? AND doctor_id = ? AND status = 'Booked'",
      [appointmentId, doctorId]
    );

    if (apt.length === 0) {
      return res.status(404).json({ message: "Appointment not found for this doctor, or it was already completed." });
    }

    const prescriptionJson = JSON.stringify(prescriptionList);

    await db.query(
      `UPDATE appointments 
       SET doctor_notes = ?, prescription = ?, status = 'Completed', completed_at = NOW()
       WHERE id = ? AND doctor_id = ? AND status = 'Booked'`,
      [doctorNotes, prescriptionJson, appointmentId, doctorId]
    );

    const [nextRows] = await db.query(
      `SELECT id, patient_name, token_number, appointment_time
       FROM appointments
       WHERE doctor_id = ? AND status = 'Booked'
       ORDER BY appointment_date ASC, appointment_time ASC
       LIMIT 1`,
      [doctorId]
    );

    res.json({
      message: "Consultation marked as Completed and Prescription issued successfully!",
      completedPatient: apt[0].patient_name,
      nextPatient: nextRows[0] || null
    });
  } catch (error) {
    console.error("Complete appointment error:", error.message);
    res.status(500).json({ message: "Could not complete appointment." });
  }
});

// -------------------------------------------------------------
// ADMIN MODULE API
// -------------------------------------------------------------
app.get("/api/admin/dashboard-stats", requireAdmin, async (req, res) => {
  try {
    const [[{ totalPatients }]] = await db.query("SELECT COUNT(*) AS totalPatients FROM users WHERE role = 'patient'");
    const [[{ totalDoctors }]] = await db.query("SELECT COUNT(*) AS totalDoctors FROM doctors");
    const [[{ totalAppointments }]] = await db.query("SELECT COUNT(*) AS totalAppointments FROM appointments");
    const [[{ totalTreated }]] = await db.query("SELECT COUNT(*) AS totalTreated FROM appointments WHERE status = 'Completed'");
    const [[{ totalRevenue }]] = await db.query(
      `SELECT COALESCE(SUM(d.fee), 0) AS totalRevenue 
       FROM appointments a 
       JOIN doctors d ON d.id = a.doctor_id 
       WHERE a.status = 'Completed'`
    );

    const [recentAppointments] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time, a.patient_name,
              a.patient_phone, a.status, d.name AS doctor_name, d.specialty, d.fee
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       ORDER BY a.id DESC LIMIT 10`
    );

    res.json({
      totalPatients: Number(totalPatients),
      totalDoctors: Number(totalDoctors),
      totalAppointments: Number(totalAppointments),
      totalTreated: Number(totalTreated),
      totalRevenue: Number(totalRevenue),
      recentAppointments
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);
    res.status(500).json({ message: "Failed to load admin stats." });
  }
});

app.get("/api/admin/doctors", requireAdmin, async (req, res) => {
  try {
    const [doctors] = await db.query(
      `SELECT d.*, 
        (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.status = 'Completed') AS treated_count,
        (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id AND a.status = 'Booked') AS pending_count
       FROM doctors d
       ORDER BY d.id ASC`
    );
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Failed to load doctors." });
  }
});

app.post("/api/admin/doctors", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const specialty = String(req.body.specialty || "").trim();
    const qualification = String(req.body.qualification || "").trim();
    const experienceYears = parseInt(req.body.experienceYears || 5, 10);
    const fee = parseFloat(req.body.fee || 500);
    const availableDays = String(req.body.availableDays || "Monday, Wednesday, Friday").trim();
    const bio = String(req.body.bio || "").trim();
    const password = String(req.body.password || "doctor123");

    if (!name || !email || !specialty) {
      return res.status(400).json({ message: "Doctor Name, Email, and Specialty are required." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [userRes] = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'doctor')",
      [name, email, passwordHash]
    );

    await db.query(
      `INSERT INTO doctors 
       (name, email, user_id, specialty, qualification, experience_years, fee, available_days, bio, rating, review_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 4.90, 0)`,
      [name, email, userRes.insertId, specialty, qualification, experienceYears, fee, availableDays, bio]
    );

    res.status(201).json({ message: `Doctor ${name} registered successfully!` });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "A user or doctor with this email already exists." });
    }
    res.status(500).json({ message: "Could not add doctor." });
  }
});

app.get("/api/admin/patients", requireAdmin, async (req, res) => {
  try {
    const [patients] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.gender, u.age, u.blood_group, u.allergies, u.created_at,
        (SELECT COUNT(*) FROM appointments a WHERE a.user_id = u.id) AS appointment_count
       FROM users u
       WHERE u.role = 'patient'
       ORDER BY u.id DESC`
    );
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: "Failed to load patients list." });
  }
});

app.get("/api/admin/appointments", requireAdmin, async (req, res) => {
  try {
    const [appointments] = await db.query(
      `SELECT a.id, a.token_number, a.appointment_date, a.appointment_time,
              a.patient_name, a.patient_phone, a.patient_age, a.patient_gender,
              a.reason, a.status, a.doctor_notes, a.prescription,
              d.name AS doctor_name, d.specialty, d.fee
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`
    );
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Failed to load appointments." });
  }
});

app.post("/api/admin/appointments/:id/cancel", requireAdmin, async (req, res) => {
  try {
    const aptId = Number(req.params.id);
    await db.query("UPDATE appointments SET status = 'Cancelled' WHERE id = ?", [aptId]);
    res.json({ message: "Appointment status updated to Cancelled." });
  } catch (error) {
    res.status(500).json({ message: "Could not cancel appointment." });
  }
});

// -------------------------------------------------------------
// MULTI-PAGE ACCESS CONTROL & ROUTING
// -------------------------------------------------------------

// Redirect legacy /portal.html to patient-dashboard
app.get("/portal.html", (req, res) => {
  res.redirect("/patient-dashboard.html");
});

// Protected Patient Pages
const patientPages = [
  "/patient-dashboard.html",
  "/book-appointment.html",
  "/appointment-summary.html",
  "/my-appointments.html",
  "/prescriptions.html",
  "/profile.html"
];

patientPages.forEach((pagePath) => {
  app.get(pagePath, (req, res, next) => {
    if (!req.session.user) {
      return res.redirect(`/login.html?redirect=${encodeURIComponent(pagePath)}`);
    }
    res.sendFile(path.join(__dirname, "public", pagePath));
  });
});

// Protected Doctor Pages
const doctorPages = [
  "/doctor-dashboard.html",
  "/doctor-appointments.html"
];

doctorPages.forEach((pagePath) => {
  app.get(pagePath, (req, res, next) => {
    if (!req.session.user || req.session.user.role !== "doctor") {
      return res.redirect("/login.html?role=doctor");
    }
    res.sendFile(path.join(__dirname, "public", pagePath));
  });
});

// Protected Admin Pages
const adminPages = [
  "/admin-dashboard.html",
  "/admin-doctors.html",
  "/admin-patients.html",
  "/admin-appointments.html"
];

adminPages.forEach((pagePath) => {
  app.get(pagePath, (req, res, next) => {
    if (!req.session.user || req.session.user.role !== "admin") {
      return res.redirect("/login.html?role=admin");
    }
    res.sendFile(path.join(__dirname, "public", pagePath));
  });
});

// Static assets
app.use(express.static(path.join(__dirname, "public")));

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`CareQueue running at http://localhost:${port}`);
});
