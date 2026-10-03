-- Phase 3: shop orders and Connect-form messages.

CREATE TABLE orders (
  id {{PK}},
  order_number VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  governorate VARCHAR(80) NOT NULL,
  address {{TEXT}} NOT NULL,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cod',
  payment_status VARCHAR(10) NOT NULL DEFAULT 'unpaid',
  payment_ref VARCHAR(100) NULL,
  items {{TEXT}} NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  unpriced INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  stock_held TINYINT NOT NULL DEFAULT 1,
  notes {{TEXT}} NULL,
  mail_status VARCHAR(10) NOT NULL DEFAULT 'skipped',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_orders_status ON orders (status, id);
CREATE INDEX idx_orders_created ON orders (created_at);

CREATE TABLE messages (
  id {{PK}},
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NULL,
  topic VARCHAR(20) NOT NULL DEFAULT 'general',
  message {{TEXT}} NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'unread',
  notes {{TEXT}} NULL,
  routed_to VARCHAR(190) NULL,
  mail_status VARCHAR(10) NOT NULL DEFAULT 'skipped',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
){{ENGINE}};

CREATE INDEX idx_messages_status ON messages (status, id);
