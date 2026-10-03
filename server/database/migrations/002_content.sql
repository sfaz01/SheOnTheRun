-- Phase 1: editable content (drafts), publish history, and admin invitations.

CREATE TABLE content (
  area VARCHAR(40) NOT NULL PRIMARY KEY,
  doc {{TEXT}} NOT NULL,
  rev INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL,
  updated_by INT NULL
){{ENGINE}};

CREATE TABLE publishes (
  id {{PK}},
  snapshot {{TEXT}} NOT NULL,
  note VARCHAR(200) NULL,
  user_id INT NULL,
  created_at DATETIME NOT NULL
){{ENGINE}};

CREATE TABLE invites (
  id {{PK}},
  email VARCHAR(190) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  created_by INT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_invites_email ON invites (email);
