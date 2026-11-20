
const session = require("express-session");

const SESSION_TABLE = "carequeue_sessions";
const DEFAULT_EXPIRY = 24 * 60 * 60 * 1000;

class MySQLSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, callback) {
    this.db.execute(
      `SELECT data FROM ${SESSION_TABLE}
       WHERE session_id = ? AND expires_at > ?`,
      [sid, Date.now()]
    )
      .then(([rows]) => {
        if (rows.length === 0) {
          return callback(null, null);
        }

        try {
          callback(null, JSON.parse(rows[0].data));
        } catch (error) {
          callback(error);
        }
      })
      .catch(callback);
  }

  set(sid, sess, callback) {
    const expiry = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).getTime()
      : Date.now() + DEFAULT_EXPIRY;

    const data = JSON.stringify(sess);

    this.db.execute(
      `INSERT INTO ${SESSION_TABLE}
       (session_id, expires_at, data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
       expires_at = VALUES(expires_at),
       data = VALUES(data)`,
      [sid, expiry, data]
    )
      .then(() => callback && callback(null))
      .catch(error => callback && callback(error));
  }

  destroy(sid, callback) {
    this.db.execute(
      `DELETE FROM ${SESSION_TABLE} WHERE session_id = ?`,
      [sid]
    )
      .then(() => callback && callback(null))
      .catch(error => callback && callback(error));
  }

  touch(sid, sess, callback) {
    const expiry = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).getTime()
      : Date.now() + DEFAULT_EXPIRY;

    this.db.execute(
      `UPDATE ${SESSION_TABLE}
       SET expires_at = ?
       WHERE session_id = ?`,
      [expiry, sid]
    )
      .then(() => callback && callback(null))
      .catch(error => callback && callback(error));
  }
}

async function initSessionTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${SESSION_TABLE} (
      session_id VARCHAR(128) PRIMARY KEY,
      expires_at BIGINT NOT NULL,
      data MEDIUMTEXT NOT NULL
    )
  `);

  await db.execute(
    `DELETE FROM ${SESSION_TABLE} WHERE expires_at <= ?`,
    [Date.now()]
  );
}

module.exports = {
  MySQLSessionStore,
  initSessionTable
};
