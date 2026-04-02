use chrono::{TimeZone, Utc};

/// Convert a Unix epoch timestamp (seconds) to an ISO 8601 / RFC 3339 string.
/// Logs a warning and returns epoch zero for out-of-range values.
#[allow(dead_code)]
pub fn unix_to_iso(ts: i64) -> String {
    Utc.timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| {
            log::warn!("Invalid Unix timestamp: {ts}, returning epoch zero");
            "1970-01-01T00:00:00+00:00".to_string()
        })
}

/// Convert an optional Unix epoch timestamp to an optional ISO 8601 string.
#[allow(dead_code)]
pub fn unix_to_iso_opt(ts: Option<i64>) -> Option<String> {
    ts.map(unix_to_iso)
}

/// Return the current Unix epoch timestamp in seconds.
pub fn now_unix() -> i64 {
    Utc::now().timestamp()
}

/// Custom serde serializers that convert Unix epoch i64 timestamps to ISO 8601
/// strings during serialization. This allows Row structs to serve double duty:
/// sqlx::FromRow for DB reads (i64) and Serialize for Tauri IPC (ISO string).
pub mod serde_unix {
    use chrono::{TimeZone, Utc};
    use serde::{self, Serializer};

    pub fn serialize_required<S>(ts: &i64, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let iso = Utc
            .timestamp_opt(*ts, 0)
            .single()
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| {
                log::warn!("Invalid timestamp: {ts}");
                "1970-01-01T00:00:00+00:00".to_string()
            });
        serializer.serialize_str(&iso)
    }

    pub fn serialize_optional<S>(ts: &Option<i64>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match ts {
            Some(t) => serialize_required(t, serializer),
            None => serializer.serialize_none(),
        }
    }
}
