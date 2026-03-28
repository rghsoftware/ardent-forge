use chrono::{TimeZone, Utc};

/// Convert a Unix epoch timestamp (seconds) to an ISO 8601 / RFC 3339 string.
/// Returns an empty string for nonsensical values (should not happen in practice).
pub fn unix_to_iso(ts: i64) -> String {
    Utc.timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

/// Convert an optional Unix epoch timestamp to an optional ISO 8601 string.
pub fn unix_to_iso_opt(ts: Option<i64>) -> Option<String> {
    ts.map(unix_to_iso)
}

/// Return the current Unix epoch timestamp in seconds.
pub fn now_unix() -> i64 {
    Utc::now().timestamp()
}
