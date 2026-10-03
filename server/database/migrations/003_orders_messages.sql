-- Phase 3: orders, messages, stock tracking and inquiries.

CREATE TABLE orders (
  id {{PK}},
  order_number VARCHAR(32) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  governorate VARCHAR(80) NOT NULL,
  address {{TEXT}} NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Pay on delivery',
  payment_ref VARCHAR(100) NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  items {{TEXT}} NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  notes {{TEXT}} NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created ON orders (created_at);

CREATE TABLE messages (
  id {{PK}},
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  about VARCHAR(80) NOT NULL,
  inbox VARCHAR(190) NOT NULL,
  message {{TEXT}} NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'unread',
  notes {{TEXT}} NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_messages_status ON messages (status);
CREATE INDEX idx_messages_created ON messages (created_at);
