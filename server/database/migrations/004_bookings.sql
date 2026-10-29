-- Consultation booking: the times Fatima is available (one small document, live the moment she saves)
-- and the requests clients make for those times.

CREATE TABLE availability (
  id INT NOT NULL PRIMARY KEY,
  doc {{TEXT}} NOT NULL,
  updated_at DATETIME NOT NULL
){{ENGINE}};

CREATE TABLE bookings (
  id {{PK}},
  booking_number VARCHAR(20) NOT NULL UNIQUE,
  slot_date VARCHAR(10) NOT NULL,
  slot_time VARCHAR(5) NOT NULL,
  place VARCHAR(12) NOT NULL,
  slot_key VARCHAR(20) NULL UNIQUE,
  service VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(190) NULL,
  note {{TEXT}} NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'new',
  admin_notes {{TEXT}} NULL,
  mail_status VARCHAR(10) NOT NULL DEFAULT 'skipped',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_bookings_slot ON bookings (slot_date, slot_time);
CREATE INDEX idx_bookings_status ON bookings (status, id);
