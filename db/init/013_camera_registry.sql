-- 013_camera_registry.sql
-- Camera registry: cameras + module assignments

CREATE TABLE IF NOT EXISTS cameras (
    camera_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_name VARCHAR(100) NOT NULL,
    lane_id VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    stream_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_heartbeat_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cameras_direction
        CHECK (direction IN ('ENTRY', 'EXIT')),
    CONSTRAINT chk_cameras_purpose
        CHECK (purpose IN ('plate', 'overview'))
);

CREATE TABLE IF NOT EXISTS camera_module_assignments (
    camera_id UUID NOT NULL,
    module_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    config_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (camera_id, module_type),
    CONSTRAINT fk_camera_module_camera
        FOREIGN KEY (camera_id)
        REFERENCES cameras (camera_id)
        ON DELETE CASCADE
);

-- One active camera per (lane_id, direction, purpose)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cameras_active_lane_dir_purpose
    ON cameras (lane_id, direction, purpose)
    WHERE is_active = true;

-- Fast lookup of active cameras by lane
CREATE INDEX IF NOT EXISTS idx_cameras_lane_active
    ON cameras (lane_id, is_active);
