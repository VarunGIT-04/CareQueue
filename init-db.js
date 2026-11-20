require("dotenv").config();
const mysql = require("mysql2/promise");
const { getDbConfig } = require("./db-config");

async function initializeDatabase() {
  const databaseName = process.env.DB_NAME;
  if (!databaseName || !/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error("Set DB_NAME to a database name containing only letters, numbers, and underscores.");
  }

  const db = await mysql.createConnection(
  getDbConfig({ includeDatabase: false })
);

  try {
    await db.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await db.changeUser({ database: databaseName });

    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      phone VARCHAR(25) NULL,
      gender VARCHAR(20) NULL,
      age INT NULL,
      blood_group VARCHAR(10) NULL,
      allergies TEXT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'patient',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.query(`CREATE TABLE IF NOT EXISTS doctors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NULL UNIQUE,
      user_id INT NULL,
      specialty VARCHAR(100) NOT NULL,
      qualification VARCHAR(120) DEFAULT 'MBBS, MD',
      experience_years INT DEFAULT 5,
      fee DECIMAL(10,2) NOT NULL DEFAULT 500,
      available_days VARCHAR(150) NOT NULL DEFAULT 'Monday, Wednesday, Friday',
      available_time_start TIME DEFAULT '09:00:00',
      available_time_end TIME DEFAULT '17:00:00',
      slot_duration_minutes INT DEFAULT 30,
      image_url VARCHAR(255) NULL,
      bio TEXT NULL,
      rating DECIMAL(3,2) DEFAULT 4.90,
      review_count INT DEFAULT 0,
      INDEX(specialty), INDEX(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.query(`CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token_number VARCHAR(30) NULL,
      user_id INT NOT NULL,
      patient_name VARCHAR(120) NULL,
      patient_phone VARCHAR(25) NULL,
      patient_age INT NULL,
      patient_gender VARCHAR(20) NULL,
      doctor_id INT NOT NULL,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      type VARCHAR(30) DEFAULT 'In-Person',
      reason TEXT NULL,
      doctor_notes TEXT NULL,
      prescription TEXT NULL,
      payment_status VARCHAR(30) DEFAULT 'Confirmed',
      status VARCHAR(30) NOT NULL DEFAULT 'Booked',
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(user_id), INDEX(doctor_id), INDEX(appointment_date),
      INDEX(doctor_id, appointment_date, appointment_time, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    console.log(`Database '${databaseName}' and CareQueue tables are ready.`);
  } finally {
    await db.end();
  }
}

initializeDatabase().catch(error => {
  console.error("Database initialization failed:", error.message);
  process.exit(1);
});
