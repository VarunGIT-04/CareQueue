require("dotenv").config();
const mysql = require("mysql2/promise");

async function seedSampleData() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
  });

  const [users] = await db.query("SELECT id, name, phone, age, gender FROM users WHERE role = 'patient' ORDER BY id LIMIT 1");
  if (users.length > 0) {
    const userId = users[0].id;

    // Check if user has a completed appointment
    const [completed] = await db.query(
      "SELECT id FROM appointments WHERE user_id = ? AND status = 'Completed'",
      [userId]
    );

    if (completed.length === 0) {
      const rx = JSON.stringify([
        {
          name: "Amlodipine 5mg",
          dosage: "1 tablet daily",
          duration: "30 days",
          instructions: "Take in the morning after breakfast"
        },
        {
          name: "Atorvastatin 10mg",
          dosage: "1 tablet at bedtime",
          duration: "30 days",
          instructions: "Take with water at night"
        },
        {
          name: "CoQ10 Supplement 100mg",
          dosage: "1 capsule daily",
          duration: "30 days",
          instructions: "Take with lunch"
        }
      ]);
      const notes =
        "Patient examined for mild hypertension and occasional fatigue. Blood pressure was 132/84 mmHg. Recommended low-sodium balanced diet, daily hydration, and 30 minutes of aerobic exercise.";

      await db.query(
        `INSERT INTO appointments 
         (user_id, doctor_id, appointment_date, appointment_time, type, reason, doctor_notes, prescription, payment_status, status, completed_at)
         VALUES (?, 2, '2026-11-10', '10:30:00', 'In-Person', 'Routine cardiovascular health checkup', ?, ?, 'Paid (Simulated)', 'Completed', NOW())`,
        [userId, notes, rx]
      );
      console.log("Seeded sample completed appointment.");
    }

    // Seed booked visits for the demo doctor login (Dr. Rajesh Sharma, id=2)
    // Available days: Tuesday, Thursday, Saturday
    const demoDoctorId = 2;
    const [pending] = await db.query(
      "SELECT id FROM appointments WHERE doctor_id = ? AND status = 'Booked'",
      [demoDoctorId]
    );
    if (pending.length === 0) {
      const [[clock]] = await db.query("SELECT CURDATE() AS today, CURTIME() AS now");
      const allowedWeekdays = new Set([2, 4, 6]); // Tuesday, Thursday, Saturday
      let appointmentDate = null;
      let firstTime = null;
      for (let offset = 0; offset <= 14 && !firstTime; offset++) {
        const date = new Date(`${clock.today}T12:00:00`);
        date.setDate(date.getDate() + offset);
        if (!allowedWeekdays.has(date.getDay())) continue;
        let start = 10 * 60;
        if (offset === 0) {
          const [hour, minute] = String(clock.now).split(":").map(Number);
          start = Math.max(start, Math.ceil((hour * 60 + minute + 1) / 30) * 30);
        }
        for (let minutes = start; minutes < 18 * 60; minutes += 30) {
          const first = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
          const secondMinutes = minutes + 30;
          if (secondMinutes >= 18 * 60) continue;
          const second = `${String(Math.floor(secondMinutes / 60)).padStart(2, "0")}:${String(secondMinutes % 60).padStart(2, "0")}:00`;
          const day = date.toISOString().slice(0, 10);
          const [busy] = await db.query(
            "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'Booked' AND appointment_time IN (?, ?)",
            [demoDoctorId, day, first, second]
          );
          const blocked = new Set(busy.map(row => String(row.appointment_time).slice(0, 8)));
          if (!blocked.has(first) && !blocked.has(second)) {
            appointmentDate = day;
            firstTime = first;
            break;
          }
        }
      }
      if (appointmentDate && firstTime) {
        const [h, m] = firstTime.split(":").map(Number);
        const secondTime = `${String(Math.floor((h * 60 + m + 30) / 60)).padStart(2, "0")}:${String((m + 30) % 60).padStart(2, "0")}:00`;
        const [[{ maxId }]] = await db.query("SELECT COALESCE(MAX(id), 0) AS maxId FROM appointments");
        const patientPhone = users[0].phone || "+91 98765 43210";
        for (const [index, time] of [firstTime, secondTime].entries()) {
          await db.query(
            `INSERT INTO appointments
             (token_number, user_id, patient_name, patient_phone, patient_age, patient_gender, doctor_id, appointment_date, appointment_time, type, reason, status, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'In-Person', ?, 'Booked', 'Confirmed')`,
            [
              `#TKN-${String(100 + Number(maxId) + index + 1)}`,
              userId,
              users[0].name,
              patientPhone,
              users[0].age,
              users[0].gender,
              demoDoctorId,
              appointmentDate,
              time,
              index === 0 ? "Chest discomfort and follow-up review" : "Blood pressure monitoring visit"
            ]
          );
        }
        console.log(`Seeded two upcoming demo appointments for Dr. Rajesh Sharma on ${appointmentDate}.`);
      }
    }

    // Seed sample notification
    const [notifs] = await db.query(
      "SELECT id FROM notifications WHERE user_id = ?",
      [userId]
    );

    if (notifs.length === 0) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read)
         VALUES 
         (?, 'Welcome to Doctor Appointment Simulator!', 'Explore available doctors, schedule visits, and access digital prescriptions anytime.', 'system', 1),
         (?, 'Prescription Issued by Dr. Kabir Mehta', 'A new prescription has been generated for your cardiovascular checkup.', 'prescription', 0)`,
        [userId, userId]
      );
      console.log("Seeded sample notifications.");
    }

    // Seed a sample review
    const [reviews] = await db.query(
      "SELECT id FROM reviews WHERE user_id = ?",
      [userId]
    );
    if (reviews.length === 0) {
      await db.query(
        `INSERT INTO reviews (appointment_id, user_id, doctor_id, rating, comment)
         VALUES (1, ?, 2, 5, 'Dr. Kabir was extremely thorough, polite, and explained all cardiovascular metrics clearly!')`,
        [userId]
      );
      console.log("Seeded sample review.");
    }
  }

  await db.end();
  console.log("Seeding finished.");
}

seedSampleData().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
