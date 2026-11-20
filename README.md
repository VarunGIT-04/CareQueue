# CareQueue — Doctor Appointment & Care Management Platform

A full-stack healthcare appointment and clinic workflow simulator built with **Node.js, Express 5, MySQL, and modern JavaScript**. CareQueue supports patient, doctor, and administrator workflows.

---

## 🌟 Features

- **Patient accounts:** Register and sign in, update personal and health details, book appointments, view appointment status, cancel bookings, and read prescriptions.
- **Doctor directory:** Browse 18 demo doctors across General Medicine, Cardiology, Dermatology, Pediatrics, Neurology, and Orthopedics. Doctor portraits use consistent profile icons.
- **Schedule-aware booking:** View available slots by doctor's working days and hours. The booking endpoint checks the schedule, rejects past dates, and prevents booking an already occupied slot.
- **Doctor queue:** Doctors see all of their booked appointments, including future dates, in time order. A completed-visits filter provides read-only notes and prescriptions. Completing a visit advances to the next booked patient.
- **Admin workspace:** Review patient, doctor, and appointment card grids; open full doctor and patient profiles; filter doctors by specialty; search and filter records; cancel a booking; and add doctor accounts.
- **Light and dark themes:** Switch appearance from any page. The selected theme is remembered in the browser.
- **Seeded presentation data:** The setup scripts create patient, doctor, and admin demo accounts. The seed command adds example completed and upcoming appointments.
- **Responsive UI:** Branded CareQueue home, patient pages, doctor queue, and grid-based admin workspace.

---

## 🏗️ Technology Stack

- **Backend:** Node.js (v24+), Express.js (v5.3)
- **Database:** MySQL 8.0 with `mysql2/promise` connection pooling
- **Security & Sessions:** `bcrypt` password hashing, `express-session` with secure HTTP-only cookies
- **Frontend:** HTML5, CSS3, Modern ES6+ JavaScript, Bootstrap 5.3, Bootstrap Icons, FontAwesome Free
- **Architecture:** RESTful API with JSON payload contracts

---

## 🗄️ Database Architecture

The relational schema consists of:
1. `users`: Stores patient accounts (`id`, `name`, `email`, `password_hash`, `role`, `phone`, `gender`, `age`, `blood_group`, `allergies`, `created_at`).
2. `doctors`: Stores verified specialists (`id`, `name`, `specialty`, `qualification`, `experience_years`, `fee`, `available_days`, `available_time_start`, `available_time_end`, `slot_duration_minutes`, `image_url`, `bio`, `rating`, `review_count`).
3. `appointments`: Stores bookings (`id`, `user_id`, `doctor_id`, `appointment_date`, `appointment_time`, `type`, `reason`, `status`, `doctor_notes`, `prescription`, `payment_status`, `completed_at`, `created_at`).
4. `reviews`: Stores patient ratings (`id`, `appointment_id`, `user_id`, `doctor_id`, `rating`, `comment`, `created_at`).
5. `notifications`: Stores user alerts (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at`).

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **MySQL Server** (v8.0+) running locally on port 3306

### 2. Environment Variables (.env)
Ensure your `.env` contains:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=doctor_appointment_simulator
PORT=3000
SESSION_SECRET=your_secret_key
```

### 3. Run Migrations & Seed Data
```bash
# Create the database and base tables
npm run db:init

# Apply optional schema updates and indexes
npm run migrate

# Add demo accounts and 18 doctors across six departments
npm run setup

# Add sample completed visits and prescriptions
npm run seed
```

### 4. Start the Application
```bash
npm start
```
The server will start at: **http://localhost:3000**

---

## 🔑 Demo Account Credentials

| Role | Email | Password |
|---|---|---|
| **Patient / Demo User** | `varun22042@gmail.com` | `varun0560` |
| **Doctor / Demo User** | `rajesh.sharma@hospital.com` | `doctor123` |
| **Admin** | `admin@hospital.com` | `admin123` |

*Note: The setup command provisions the demo accounts. You can also register a patient account from the registration page. Demo passwords are for local presentation use only.*

---

## 🧪 Automated Testing
Run the comprehensive API endpoint verification suite:
```bash
node test-server.js
```
Validates database health, public stats, doctor availability slots, authentication, session cookies, appointment management, and doctor queue endpoints.

---

## 📂 Project Structure

```
├── .env                       # Environment configuration
├── migrate.js                 # Automatic DB schema migration
├── seed.js                    # Sample clinical data seeder
├── server.js                  # Express backend & REST API endpoints
├── test-server.js             # Automated API test suite
├── package.json               # Dependencies and scripts
└── public/
    ├── index.html             # Dynamic homepage with live stats & doctor showcase
    ├── login.html             # Login with demo quick-fill helper
    ├── register.html          # Registration with health & contact fields
    ├── portal.html            # Patient portal & clinic simulator UI
    ├── css/
    │   ├── portal.css         # Modern portal, video room, and slip styling
    │   └── style.css          # Core styles
    └── js/
        ├── app.js             # Homepage dynamic engine
        ├── auth.js            # Login & registration authentication handler
        └── portal.js          # Full simulator & portal client-side engine
```
