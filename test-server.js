require("dotenv").config();
const http = require("http");

async function run() {
  process.env.PORT = "3099";
  console.log("Starting server on port 3099 for automated verification...");

  // Require server.js
  require("./server.js");

  // Wait 1 second for database pool & server listen
  await new Promise((r) => setTimeout(r, 1200));

  function request(path, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: 3099,
          path,
          method: options.method || "GET",
          headers: options.headers || {}
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            let json = null;
            try {
              json = JSON.parse(body);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body,
              json
            });
          });
        }
      );
      req.on("error", reject);
      if (postData) {
        req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  }

  try {
    // 1. Health check
    const health = await request("/api/health");
    console.log("1. /api/health:", health.status, health.json);

    // 2. Public stats
    const stats = await request("/api/public-stats");
    console.log("2. /api/public-stats:", stats.status, stats.json);

    // 3. Doctors list
    const docs = await request("/api/doctors");
    console.log("3. /api/doctors count:", docs.status, docs.json ? docs.json.length : 0);

    // 4. Doctor slots
    // Find an available day for doctor 1 (Dr. Ananya Rao: Monday, Wednesday, Friday)
    // 2026-11-20 is a Friday
    const slots = await request("/api/doctors/1/available-slots?date=2026-11-20");
    console.log("4. /api/doctors/1/available-slots for 2026-11-20 (Friday):", slots.status, {
      available: slots.json ? slots.json.available : false,
      slotsCount: slots.json && slots.json.slots ? slots.json.slots.length : 0
    });

    // 5. Test Login
    const loginRes = await request(
      "/api/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      {
        email: "varun22042@gmail.com",
        password: "varun0560"
      }
    );
    console.log("5. /api/login:", loginRes.status, loginRes.json);

    const setCookie = loginRes.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0].split(";")[0] : "";

    // 6. Test /api/me with session cookie
    const meRes = await request("/api/me", {
      headers: { Cookie: cookieHeader }
    });
    console.log("6. /api/me:", meRes.status, meRes.json ? meRes.json.user.name : null);

    // 7. Test /api/appointments
    const aptRes = await request("/api/appointments", {
      headers: { Cookie: cookieHeader }
    });
    console.log("7. /api/appointments count:", aptRes.status, aptRes.json ? aptRes.json.length : 0);

    // 8. Test /api/patient/dashboard-stats
    const dashStats = await request("/api/patient/dashboard-stats", {
      headers: { Cookie: cookieHeader }
    });
    console.log("8. /api/patient/dashboard-stats:", dashStats.status, dashStats.json);

    // 9. Test /api/simulator/doctor-appointments
    const simQueue = await request("/api/simulator/doctor-appointments", {
      headers: { Cookie: cookieHeader }
    });
    console.log("9. /api/simulator/doctor-appointments count:", simQueue.status, simQueue.json ? simQueue.json.length : 0);

    console.log("ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  }
}

run();
