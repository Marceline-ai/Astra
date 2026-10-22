-- ============================================================
-- Astra Beauty Salon — PostgreSQL schema (v1.0)
-- Основан на схеме из ТЗ + расширения для бизнес-логики:
--  * связь services <-> masters (мастер доступен услуге)
--  * поля админ-режима в bookings (comment, discount, prepayment)
--  * таблица login_attempts (защита от брутфорса, ТЗ п.4.1)
--  * роли: super_admin / admin / manager (ТЗ п.5.3) + client/master
--  * мягкие/жесткие удаления и статусы как в ТЗ п.4.3
-- ============================================================

CREATE TYPE user_role AS ENUM ('client', 'master', 'manager', 'admin', 'super_admin');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'canceled', 'no_show');
CREATE TYPE day_of_week AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');

-- 1. Пользователи
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    role user_role NOT NULL,
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL DEFAULT '',
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- 2. Клиенты
CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    loyalty_balance INT NOT NULL DEFAULT 0,
    notes TEXT
);

-- 3. Мастера
CREATE TABLE masters (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    speciality VARCHAR(100),
    bio TEXT,
    photo_url TEXT,
    rating_avg DECIMAL(2,1) NOT NULL DEFAULT 0.0
);

-- 4. Категории услуг (5 категорий ТЗ п.3.1)
CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0
);

-- 5. Услуги
CREATE TABLE services (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Какие услуги выполняет мастер (зависимость «Мастер ← Услуга» из ТЗ п.3.2)
CREATE TABLE master_services (
    master_id BIGINT NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (master_id, service_id)
);

-- 7. Базовое (повторяющееся) расписание мастеров
CREATE TABLE schedules (
    id BIGSERIAL PRIMARY KEY,
    master_id BIGINT NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    day_of_week day_of_week NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    CONSTRAINT chk_time CHECK (end_time > start_time)
);

-- 8. Исключения из расписания (отпуска/праздники/рабочие дни)
CREATE TABLE schedule_exceptions (
    id BIGSERIAL PRIMARY KEY,
    master_id BIGINT NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    is_working BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIME,
    end_time TIME,
    reason VARCHAR(255),
    UNIQUE(master_id, exception_date)
);

-- 9. Записи
CREATE TABLE bookings (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    master_id BIGINT NOT NULL REFERENCES masters(id) ON DELETE RESTRICT,
    service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    total_price DECIMAL(10,2) NOT NULL,
    comment TEXT,                       -- ручной режим админа (ТЗ п.4.5)
    discount_percent INT NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    is_prepaid BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(10) NOT NULL DEFAULT 'web',   -- web | admin
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_booking_time CHECK (end_at > start_at)
);

-- 10. Отзывы
CREATE TABLE reviews (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    master_id BIGINT NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Попытки входа (анти-брутфорс: блок после 5 неудачных попыток, ТЗ п.4.1)
CREATE TABLE login_attempts (
    id BIGSERIAL PRIMARY KEY,
    login_key VARCHAR(160) NOT NULL,    -- нормализованный логин
    ip VARCHAR(64),
    success BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_login_attempts_key ON login_attempts(login_key, attempted_at);

-- Индексы (из ТЗ + дополнительные для фильтров админки)
CREATE INDEX idx_bookings_master_date ON bookings(master_id, start_at);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start ON bookings(start_at);
CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_schedules_master ON schedules(master_id);
