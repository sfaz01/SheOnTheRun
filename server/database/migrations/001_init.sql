-- Phase 0: accounts, login protection and the audit trail.
-- Content tables (products, events, orders, …) arrive in later migrations.

CREATE TABLE users (
  id {{PK}},
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  totp_secret VARCHAR(64) NULL,
  totp_enabled TINYINT NOT NULL DEFAULT 0,
  totp_last_step BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
){{ENGINE}};

CREATE TABLE recovery_codes (
  id {{PK}},
  user_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at DATETIME NULL
){{ENGINE}};

CREATE INDEX idx_recovery_user ON recovery_codes (user_id);

CREATE TABLE login_attempts (
  id {{PK}},
  throttle_key VARCHAR(190) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  success TINYINT NOT NULL,
  created_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_attempts_key ON login_attempts (throttle_key, created_at);
CREATE INDEX idx_attempts_ip ON login_attempts (ip, created_at);

CREATE TABLE audit_log (
  id {{PK}},
  user_id INT NULL,
  action VARCHAR(60) NOT NULL,
  detail {{TEXT}} NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_audit_created ON audit_log (created_at);
