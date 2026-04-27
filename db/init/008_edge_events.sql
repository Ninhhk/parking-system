CREATE TABLE IF NOT EXISTS edge_events (
    edge_event_id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    session_id INT,
    lane_id VARCHAR(100) NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    payload_json JSONB NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_retry_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_edge_events_session
        FOREIGN KEY (session_id)
        REFERENCES parkingsessions(session_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT chk_edge_events_status
        CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED')),
    CONSTRAINT chk_edge_events_retry_count
        CHECK (retry_count >= 0),
    CONSTRAINT chk_edge_events_max_retries
        CHECK (max_retries >= 0)
);

CREATE INDEX IF NOT EXISTS idx_edge_events_status_occurred_at
    ON edge_events (status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_events_lane_id_occurred_at
    ON edge_events (lane_id, occurred_at DESC);
