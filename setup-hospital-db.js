require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

async function setup() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
  });

  console.log("Connected to MySQL for CareQueue setup...");

  async function columnExists(table, column) {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_NAME, table, column]
    );
    return rows.length > 0;
  }

  // 1. Doctors table columns
  if (!(await columnExists("doctors", "email"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN email VARCHAR(150) NULL AFTER name");
    console.log("Added column: doctors.email");
  }
  if (!(await columnExists("doctors", "user_id"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN user_id INT NULL AFTER email");
    console.log("Added column: doctors.user_id");
  }

  // 2. Appointments table columns
  if (!(await columnExists("appointments", "token_number"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN token_number VARCHAR(30) NULL AFTER id");
    console.log("Added column: appointments.token_number");
  }
  if (!(await columnExists("appointments", "patient_name"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN patient_name VARCHAR(100) NULL AFTER user_id");
    console.log("Added column: appointments.patient_name");
  }
  if (!(await columnExists("appointments", "patient_phone"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN patient_phone VARCHAR(25) NULL AFTER patient_name");
    console.log("Added column: appointments.patient_phone");
  }
  if (!(await columnExists("appointments", "patient_age"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN patient_age INT NULL AFTER patient_phone");
    console.log("Added column: appointments.patient_age");
  }
  if (!(await columnExists("appointments", "patient_gender"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN patient_gender VARCHAR(20) NULL AFTER patient_age");
    console.log("Added column: appointments.patient_gender");
  }

  const defaultDocPassword = await bcrypt.hash("doctor123", 10);
  const defaultAdminPassword = await bcrypt.hash("admin123", 10);
  const defaultUserPassword = await bcrypt.hash("varun0560", 10);

  // 3. Setup Admin Account
  const [adminExists] = await db.query("SELECT id FROM users WHERE email = 'admin@hospital.com'");
  if (adminExists.length === 0) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ('Hospital Administrator', 'admin@hospital.com', ?, 'admin', '+91 98888 11222')`,
      [defaultAdminPassword]
    );
    console.log("Created Admin account: admin@hospital.com / admin123");
  } else {
    await db.query(
      "UPDATE users SET role = 'admin', password_hash = ? WHERE email = 'admin@hospital.com'",
      [defaultAdminPassword]
    );
  }

  // 4. Setup Patient Account (Varun Kumar)
  const [patientExists] = await db.query("SELECT id FROM users WHERE email = 'varun22042@gmail.com'");
  if (patientExists.length === 0) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, phone, gender, age, blood_group)
       VALUES ('Varun Kumar', 'varun22042@gmail.com', ?, 'patient', '+91 98765 43210', 'Male', 24, 'O+')`,
      [defaultUserPassword]
    );
    console.log("Created Patient account: varun22042@gmail.com / varun0560");
  } else {
    await db.query(
      "UPDATE users SET name = 'Varun Kumar', role = 'patient', phone = COALESCE(phone, '+91 98765 43210'), gender = 'Male', age = 24, blood_group = 'O+' WHERE email = 'varun22042@gmail.com'"
    );
  }

  // 5. Update Doctors with Authentic Indian Names, Emails, Credentials
  const indianDoctors = [
    {
      id: 1,
      name: "Dr. Ananya Iyer",
      email: "ananya.iyer@hospital.com",
      specialty: "General Medicine",
      qualification: "MBBS, MD (Internal Medicine)",
      experience_years: 11,
      fee: 500.00,
      available_days: "Monday, Wednesday, Friday",
      image_url: "/assets/img/doctors/doctors-1.jpg",
      bio: "Senior Consultant Physician with over 11 years of experience in adult medicine, preventive healthcare, diabetes, and infectious ailments.",
      rating: 4.90,
      review_count: 48
    },
    {
      id: 2,
      name: "Dr. Rajesh Sharma",
      email: "rajesh.sharma@hospital.com",
      specialty: "Cardiology",
      qualification: "MD, DM (Cardiology), FACC",
      experience_years: 16,
      fee: 900.00,
      available_days: "Tuesday, Thursday, Saturday",
      image_url: "/assets/img/doctors/doctors-2.jpg",
      bio: "Distinguished Cardiologist specializing in preventive cardiology, coronary interventions, hypertension management, and echocardiography.",
      rating: 4.96,
      review_count: 65
    },
    {
      id: 3,
      name: "Dr. Sunita Rao",
      email: "sunita.rao@hospital.com",
      specialty: "Dermatology",
      qualification: "MBBS, MD (Dermatology), DNB",
      experience_years: 9,
      fee: 700.00,
      available_days: "Monday, Tuesday, Thursday",
      image_url: "/assets/img/doctors/doctors-3.jpg",
      bio: "Specialist dermatologist with comprehensive expertise in clinical dermatology, allergy testing, chronic skin conditions, and pediatric skin care.",
      rating: 4.88,
      review_count: 36
    },
    {
      id: 4,
      name: "Dr. Arjun Verma",
      email: "arjun.verma@hospital.com",
      specialty: "Pediatrics",
      qualification: "MD (Pediatrics), DCH",
      experience_years: 12,
      fee: 600.00,
      available_days: "Monday, Wednesday, Saturday",
      image_url: "/assets/img/doctors/doctors-4.jpg",
      bio: "Compassionate child specialist devoted to newborn care, child growth monitoring, vaccinations, and pediatric emergency medicine.",
      rating: 4.94,
      review_count: 52
    },
    {
      id: 5,
      name: "Dr. Priya Nambiar",
      email: "priya.nambiar@hospital.com",
      specialty: "Neurology",
      qualification: "MD, DM (Neurology)",
      experience_years: 14,
      fee: 1100.00,
      available_days: "Tuesday, Wednesday, Friday",
      image_url: "/assets/img/doctors/doctors-1.jpg",
      bio: "Senior Neurologist offering specialized clinical care for migraines, stroke management, neuropathy, memory disorders, and epilepsy.",
      rating: 4.92,
      review_count: 41
    },
    {
      id: 6,
      name: "Dr. Suresh Patel",
      email: "suresh.patel@hospital.com",
      specialty: "Orthopedics",
      qualification: "MS (Orthopedics), MCh",
      experience_years: 13,
      fee: 850.00,
      available_days: "Monday, Thursday, Saturday",
      image_url: "/assets/img/doctors/doctors-2.jpg",
      bio: "Consultant Orthopedic Surgeon specialized in joint disorders, sports injuries, arthroscopy, spine care, and fracture trauma management.",
      rating: 4.91,
      review_count: 39
    },
    { id: 7, name: "Dr. Aditi Menon", email: "aditi.menon@hospital.com", specialty: "General Medicine", qualification: "MBBS, MD (General Medicine)", experience_years: 8, fee: 450, available_days: "Tuesday, Thursday, Saturday", image_url: "", bio: "Family physician focused on preventive care, everyday health concerns, and long-term wellness.", rating: 4.86, review_count: 22 },
    { id: 8, name: "Dr. Karan Mehta", email: "karan.mehta@hospital.com", specialty: "Cardiology", qualification: "MBBS, MD, DM (Cardiology)", experience_years: 10, fee: 800, available_days: "Monday, Wednesday, Friday", image_url: "", bio: "Cardiologist with a focus on heart health, hypertension, and preventive cardiac care.", rating: 4.89, review_count: 27 },
    { id: 9, name: "Dr. Neha Kulkarni", email: "neha.kulkarni@hospital.com", specialty: "Dermatology", qualification: "MBBS, MD (Dermatology)", experience_years: 7, fee: 650, available_days: "Wednesday, Thursday, Saturday", image_url: "", bio: "Dermatologist providing care for common skin, hair, and nail conditions.", rating: 4.87, review_count: 19 },
    { id: 10, name: "Dr. Vivek Nair", email: "vivek.nair@hospital.com", specialty: "Pediatrics", qualification: "MBBS, MD (Pediatrics)", experience_years: 9, fee: 550, available_days: "Tuesday, Thursday, Saturday", image_url: "", bio: "Pediatrician supporting children’s health, growth, and routine immunization.", rating: 4.90, review_count: 31 },
    { id: 11, name: "Dr. Meera Shah", email: "meera.shah@hospital.com", specialty: "Neurology", qualification: "MBBS, MD, DM (Neurology)", experience_years: 8, fee: 950, available_days: "Monday, Thursday, Saturday", image_url: "", bio: "Neurologist with experience in headache, nerve, and movement-related conditions.", rating: 4.88, review_count: 24 },
    { id: 12, name: "Dr. Aditya Joshi", email: "aditya.joshi@hospital.com", specialty: "Orthopedics", qualification: "MBBS, MS (Orthopedics)", experience_years: 9, fee: 750, available_days: "Tuesday, Wednesday, Friday", image_url: "", bio: "Orthopedic specialist caring for joint pain, sports injuries, and mobility concerns.", rating: 4.85, review_count: 21 },
    { id: 13, name: "Dr. Kavya Reddy", email: "kavya.reddy@hospital.com", specialty: "General Medicine", qualification: "MBBS, DNB (Family Medicine)", experience_years: 6, fee: 400, available_days: "Monday, Wednesday, Saturday", image_url: "", bio: "Primary care doctor offering thoughtful support for common and chronic conditions.", rating: 4.84, review_count: 17 },
    { id: 14, name: "Dr. Sameer Kapoor", email: "sameer.kapoor@hospital.com", specialty: "Cardiology", qualification: "MBBS, MD (Medicine), DM (Cardiology)", experience_years: 12, fee: 850, available_days: "Tuesday, Thursday, Saturday", image_url: "", bio: "Consultant cardiologist specializing in cardiac evaluation and heart-health planning.", rating: 4.91, review_count: 33 },
    { id: 15, name: "Dr. Isha Fernandes", email: "isha.fernandes@hospital.com", specialty: "Dermatology", qualification: "MBBS, DNB (Dermatology)", experience_years: 5, fee: 600, available_days: "Monday, Tuesday, Friday", image_url: "", bio: "Dermatologist helping patients manage skin sensitivity, acne, and hair concerns.", rating: 4.82, review_count: 14 },
    { id: 16, name: "Dr. Nikhil Bhat", email: "nikhil.bhat@hospital.com", specialty: "Pediatrics", qualification: "MBBS, DCH, DNB (Pediatrics)", experience_years: 7, fee: 500, available_days: "Monday, Wednesday, Friday", image_url: "", bio: "Child health specialist focused on routine pediatric care and healthy development.", rating: 4.87, review_count: 20 },
    { id: 17, name: "Dr. Ritu Sinha", email: "ritu.sinha@hospital.com", specialty: "Neurology", qualification: "MBBS, MD (Medicine), DM (Neurology)", experience_years: 6, fee: 900, available_days: "Tuesday, Wednesday, Friday", image_url: "", bio: "Neurologist focused on patient-centered assessment of headaches and neurological symptoms.", rating: 4.83, review_count: 16 },
    { id: 18, name: "Dr. Pranav Rao", email: "pranav.rao@hospital.com", specialty: "Orthopedics", qualification: "MBBS, DNB (Orthopedics)", experience_years: 6, fee: 700, available_days: "Monday, Thursday, Saturday", image_url: "", bio: "Orthopedic doctor supporting recovery from joint, bone, and sports-related injuries.", rating: 4.86, review_count: 18 }
  ];

  for (const doc of indianDoctors) {
    // 1. Create or update user account for doctor
    const [u] = await db.query("SELECT id FROM users WHERE email = ?", [doc.email]);
    let docUserId;
    if (u.length === 0) {
      const [ins] = await db.query(
        `INSERT INTO users (name, email, password_hash, role, phone)
         VALUES (?, ?, ?, 'doctor', '+91 98760 12345')`,
        [doc.name, doc.email, defaultDocPassword]
      );
      docUserId = ins.insertId;
      console.log(`Created doctor user: ${doc.email} / doctor123`);
    } else {
      docUserId = u[0].id;
      await db.query(
        "UPDATE users SET name = ?, role = 'doctor', password_hash = ? WHERE id = ?",
        [doc.name, defaultDocPassword, docUserId]
      );
    }

    // 2. Insert or update doctor record
    const [d] = await db.query("SELECT id FROM doctors WHERE id = ?", [doc.id]);
    if (d.length === 0) {
      await db.query(
        `INSERT INTO doctors 
         (id, name, email, user_id, specialty, qualification, experience_years, fee, available_days, available_time_start, available_time_end, slot_duration_minutes, image_url, bio, rating, review_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '09:00:00', '17:00:00', 30, ?, ?, ?, ?)`,
        [doc.id, doc.name, doc.email, docUserId, doc.specialty, doc.qualification, doc.experience_years, doc.fee, doc.available_days, doc.image_url, doc.bio, doc.rating, doc.review_count]
      );
    } else {
      await db.query(
        `UPDATE doctors SET 
          name = ?, email = ?, user_id = ?, specialty = ?, qualification = ?, experience_years = ?, fee = ?,
          available_days = ?, image_url = ?, bio = ?, rating = ?, review_count = ?
         WHERE id = ?`,
        [doc.name, doc.email, docUserId, doc.specialty, doc.qualification, doc.experience_years, doc.fee, doc.available_days, doc.image_url, doc.bio, doc.rating, doc.review_count, doc.id]
      );
    }
  }

  // 6. Update existing appointments with token numbers and patient details if missing
  const [apts] = await db.query("SELECT a.id, a.user_id, u.name, u.phone, u.age, u.gender FROM appointments a JOIN users u ON u.id = a.user_id");
  for (const a of apts) {
    const token = `#TKN-${String(100 + a.id)}`;
    await db.query(
      `UPDATE appointments SET 
        token_number = COALESCE(token_number, ?),
        patient_name = COALESCE(patient_name, ?),
        patient_phone = COALESCE(patient_phone, ?),
        patient_age = COALESCE(patient_age, ?),
        patient_gender = COALESCE(patient_gender, ?)
       WHERE id = ?`,
      [token, a.name, a.phone || '+91 98765 43210', a.age || 24, a.gender || 'Male', a.id]
    );
  }

  console.log("Hospital database configuration finished successfully!");
  await db.end();
}

setup().catch((e) => {
  console.error("Setup error:", e);
  process.exit(1);
});
