-- Users (for login and roles)
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'customer'))
);

-- Product categories
CREATE TABLE IF NOT EXISTS categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL
);

-- Products (version column is used for optimistic locking)
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120)  NOT NULL,
    description TEXT,
    price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock       INTEGER       NOT NULL CHECK (stock >= 0),
    category_id INTEGER REFERENCES categories(id),
    version     INTEGER       NOT NULL DEFAULT 1,
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Audit log (who did what)
CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    actor      VARCHAR(50),
    action     VARCHAR(20) NOT NULL,
    entity_id  INTEGER,
    details    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);