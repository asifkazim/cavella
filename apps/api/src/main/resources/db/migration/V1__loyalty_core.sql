-- Loyalty core schema (ARCHITECTURE §4). Constraints here are the last line of defence:
-- they hold even if application code has a bug.

CREATE TABLE staff_user (
    id           uuid PRIMARY KEY,
    email        text        NOT NULL UNIQUE,
    display_name text        NOT NULL,
    role         text        NOT NULL CHECK (role IN ('CASHIER', 'OWNER')),
    active       boolean     NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE card (
    id                   uuid PRIMARY KEY,
    -- SHA-256 of the bearer token; the token itself is never stored (ADR-002).
    token_hash           bytea       NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    status               text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PREISSUED', 'ACTIVE', 'BLOCKED')),
    -- Projection of the ledger, updated in the same transaction as each event.
    stamp_progress       smallint    NOT NULL DEFAULT 0 CHECK (stamp_progress >= 0 AND stamp_progress < 32),
    rewards_available    integer     NOT NULL DEFAULT 0 CHECK (rewards_available >= 0),   -- BR-05
    lifetime_stamps      integer     NOT NULL DEFAULT 0 CHECK (lifetime_stamps >= 0),
    lifetime_redemptions integer     NOT NULL DEFAULT 0 CHECK (lifetime_redemptions >= 0),
    created_at           timestamptz NOT NULL,
    last_event_at        timestamptz
);

-- Append-only ledger: the audit truth (FR-A-02).
CREATE TABLE loyalty_event (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id         uuid        NOT NULL UNIQUE,
    card_id           uuid        NOT NULL REFERENCES card (id),
    type              text        NOT NULL CHECK (type IN ('STAMP', 'REDEEM')),
    quantity          smallint    NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    stamp_delta       smallint    NOT NULL,
    reward_delta      integer     NOT NULL,
    stamps_after      smallint    NOT NULL CHECK (stamps_after >= 0),
    rewards_after     integer     NOT NULL CHECK (rewards_after >= 0),
    stamps_per_reward smallint    NOT NULL CHECK (stamps_per_reward > 0),
    staff_user_id     uuid        NOT NULL REFERENCES staff_user (id),
    idempotency_key   uuid        NOT NULL,
    created_at        timestamptz NOT NULL,
    -- Second guard behind idempotency_record: one ledger entry per (staff, key).
    CONSTRAINT loyalty_event_staff_key_unique UNIQUE (staff_user_id, idempotency_key)
);

CREATE INDEX loyalty_event_card_created_idx  ON loyalty_event (card_id, created_at DESC);
CREATE INDEX loyalty_event_staff_created_idx ON loyalty_event (staff_user_id, created_at);
CREATE INDEX loyalty_event_created_idx       ON loyalty_event (created_at);

CREATE FUNCTION loyalty_event_append_only() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION 'loyalty_event is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

-- Row-level UPDATE/DELETE are always rejected. TRUNCATE is controlled by privileges: the
-- production application role is not granted TRUNCATE (ARCHITECTURE §4.3).
CREATE TRIGGER loyalty_event_no_update_delete
    BEFORE UPDATE OR DELETE ON loyalty_event
    FOR EACH ROW EXECUTE FUNCTION loyalty_event_append_only();

-- Remembers the outcome of each staff command (BR-06). The primary key serialises concurrent
-- duplicates: a second INSERT with the same key waits for the first transaction to finish.
CREATE TABLE idempotency_record (
    staff_user_id   uuid        NOT NULL REFERENCES staff_user (id),
    idem_key        uuid        NOT NULL,
    request_hash    bytea       NOT NULL CHECK (octet_length(request_hash) = 32),
    response_status smallint,
    response_body   jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (staff_user_id, idem_key)
);
