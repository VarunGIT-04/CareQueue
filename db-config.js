
require("dotenv").config();

function getDbConfig({ includeDatabase = true } = {}) {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    // TiDB Cloud Starter requires TLS
    ssl: process.env.DB_SSL === "true"
      ? { minVersion: "TLSv1.2" }
      : undefined
  };

  if (includeDatabase) {
    config.database = process.env.DB_NAME;
  }

  return config;
}

module.exports = { getDbConfig };
