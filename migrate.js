require("dotenv").config();
const mysql = require("mysql2/promise");

async function runMigration() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
  });

  console.log("Connected to MySQL for migration.");

  async function columnExists(table, column) {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_NAME, table, column]
    );
    return rows.length > 0;
  }

  // 1. Users table columns
  if (!(await columnExists("users", "phone"))) {
    await db.query("ALTER TABLE users ADD COLUMN phone VARCHAR(25) NULL AFTER email");
    console.log("Added column: users.phone");
  }
  if (!(await columnExists("users", "gender"))) {
    await db.query("ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL AFTER phone");
    console.log("Added column: users.gender");
  }
  if (!(await columnExists("users", "age"))) {
    await db.query("ALTER TABLE users ADD COLUMN age INT NULL AFTER gender");
    console.log("Added column: users.age");
  }
  if (!(await columnExists("users", "blood_group"))) {
    await db.query("ALTER TABLE users ADD COLUMN blood_group VARCHAR(10) NULL AFTER age");
    console.log("Added column: users.blood_group");
  }
  if (!(await columnExists("users", "allergies"))) {
    await db.query("ALTER TABLE users ADD COLUMN allergies TEXT NULL AFTER blood_group");
    console.log("Added column: users.allergies");
  }
  if (!(await columnExists("users", "role"))) {
    await db.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'patient' AFTER password_hash");
    console.log("Added column: users.role");
  }

  // 2. Doctors table columns
  if (!(await columnExists("doctors", "qualification"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN qualification VARCHAR(120) DEFAULT 'MBBS, MD' AFTER specialty");
    console.log("Added column: doctors.qualification");
  }
  if (!(await columnExists("doctors", "experience_years"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN experience_years INT DEFAULT 8 AFTER qualification");
    console.log("Added column: doctors.experience_years");
  }
  if (!(await columnExists("doctors", "image_url"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN image_url VARCHAR(255) DEFAULT '/assets/img/doctors/doctors-1.jpg' AFTER experience_years");
    console.log("Added column: doctors.image_url");
  }
  if (!(await columnExists("doctors", "bio"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN bio TEXT NULL AFTER image_url");
    console.log("Added column: doctors.bio");
  }
  if (!(await columnExists("doctors", "rating"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN rating DECIMAL(3,2) DEFAULT 4.90 AFTER bio");
    console.log("Added column: doctors.rating");
  }
  if (!(await columnExists("doctors", "review_count"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN review_count INT DEFAULT 18 AFTER rating");
    console.log("Added column: doctors.review_count");
  }
  if (!(await columnExists("doctors", "available_time_start"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN available_time_start TIME DEFAULT '09:00:00' AFTER available_days");
    console.log("Added column: doctors.available_time_start");
  }
  if (!(await columnExists("doctors", "available_time_end"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN available_time_end TIME DEFAULT '17:00:00' AFTER available_time_start");
    console.log("Added column: doctors.available_time_end");
  }
  if (!(await columnExists("doctors", "slot_duration_minutes"))) {
    await db.query("ALTER TABLE doctors ADD COLUMN slot_duration_minutes INT DEFAULT 30 AFTER available_time_end");
    console.log("Added column: doctors.slot_duration_minutes");
  }

  // 3. Appointments table columns
  if (!(await columnExists("appointments", "type"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN type VARCHAR(30) DEFAULT 'In-Person' AFTER appointment_time");
    console.log("Added column: appointments.type");
  }
  if (!(await columnExists("appointments", "doctor_notes"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN doctor_notes TEXT NULL AFTER reason");
    console.log("Added column: appointments.doctor_notes");
  }
  if (!(await columnExists("appointments", "prescription"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN prescription TEXT NULL AFTER doctor_notes");
    console.log("Added column: appointments.prescription");
  }
  if (!(await columnExists("appointments", "payment_status"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN payment_status VARCHAR(30) DEFAULT 'Paid (Simulated)' AFTER prescription");
    console.log("Added column: appointments.payment_status");
  }
  if (!(await columnExists("appointments", "completed_at"))) {
    await db.query("ALTER TABLE appointments ADD COLUMN completed_at TIMESTAMP NULL AFTER status");
    console.log("Added column: appointments.completed_at");
  }

  // 4. Reviews table
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      appointment_id INT NOT NULL,
      user_id INT NOT NULL,
      doctor_id INT NOT NULL,
      rating INT NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(appointment_id),
      INDEX(doctor_id),
      INDEX(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("Verified reviews table exists.");

  // 5. Notifications table
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      message VARCHAR(500) NOT NULL,
      type VARCHAR(50) DEFAULT 'system',
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("Verified notifications table exists.");

  // 6. Expand doctor catalog with realistic, high-quality entries
  const [existingDoctors] = await db.query("SELECT id, name FROM doctors");
  console.log(`Found ${existingDoctors.length} doctors.`);

  // Update existing doctors with rich metadata
  await db.query(`
    UPDATE doctors SET 
      qualification = 'MBBS, MD (Internal Medicine)',
      experience_years = 11,
      image_url = '/assets/img/doctors/doctors-1.jpg',
      bio = 'Consultant Physician with over a decade of clinical experience in preventative care, chronic disease management, and family medicine.',
      rating = 4.92,
      review_count = 34,
      available_time_start = '09:00:00',
      available_time_end = '16:00:00'
    WHERE id = 1
  `);

  await db.query(`
    UPDATE doctors SET 
      qualification = 'MD, DM (Cardiology), FACC',
      experience_years = 15,
      image_url = '/assets/img/doctors/doctors-2.jpg',
      bio = 'Interventional Cardiologist specialized in preventive cardiology, hypertension, lipid management, and non-invasive cardiac evaluation.',
      rating = 4.96,
      review_count = 42,
      available_time_start = '10:00:00',
      available_time_end = '18:00:00'
    WHERE id = 2
  `);

  await db.query(`
    UPDATE doctors SET 
      qualification = 'MBBS, MD (Dermatology), DNB',
      experience_years = 9,
      image_url = '/assets/img/doctors/doctors-3.jpg',
      bio = 'Leading dermatologist and trichologist specializing in clinical dermatology, acne treatments, skin allergies, and advanced cosmetic therapies.',
      rating = 4.88,
      review_count = 29,
      available_time_start = '09:30:00',
      available_time_end = '17:00:00'
    WHERE id = 3
  `);

  // Add more specialties if they don't exist
  if (existingDoctors.length <= 3) {
    const additionalDoctors = [
      [
        'Dr. Arjun Sharma',
        'Pediatrician',
        'MD (Pediatrics), DCH',
        12,
        600.00,
        'Monday, Wednesday, Saturday',
        '09:00:00',
        '15:00:00',
        30,
        '/assets/img/doctors/doctors-4.jpg',
        'Compassionate pediatrician devoted to child wellness, newborn health assessments, pediatric immunizations, and developmental milestones.',
        4.94,
        38
      ],
      [
        'Dr. Priya Venkatesh',
        'Neurologist',
        'MD, DM (Neurology)',
        14,
        1100.00,
        'Tuesday, Wednesday, Friday',
        '11:00:00',
        '18:00:00',
        30,
        '/assets/img/doctors/doctors-1.jpg',
        'Senior Neurologist with expertise in migraine management, neuromuscular disorders, neuropathy, and comprehensive brain health assessments.',
        4.91,
        27
      ],
      [
        'Dr. Rohan Verma',
        'Orthopedic Surgeon',
        'MS (Orthopedics), MCh',
        10,
        850.00,
        'Monday, Thursday, Saturday',
        '09:00:00',
        '17:00:00',
        30,
        '/assets/img/doctors/doctors-2.jpg',
        'Specialist in joint preservation, sports injury rehabilitation, spine ergonomics, arthroscopy, and fracture treatments.',
        4.89,
        31
      ]
    ];

    for (const doc of additionalDoctors) {
      await db.query(`
        INSERT INTO doctors 
        (name, specialty, qualification, experience_years, fee, available_days, available_time_start, available_time_end, slot_duration_minutes, image_url, bio, rating, review_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, doc);
    }
    console.log("Added additional specialized doctors to the database.");
  }

  // Update existing user with default profile information if blank
  await db.query(`
    UPDATE users SET 
      phone = COALESCE(phone, '+91 98765 43210'),
      gender = COALESCE(gender, 'Male'),
      age = COALESCE(age, 24),
      blood_group = COALESCE(blood_group, 'O+')
    WHERE id = 1
  `);

  await db.end();
  console.log("Database schema and seed data successfully initialized!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
