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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unix_to_iso_known_timestamp() {
        // 2023-11-14T22:13:20+00:00
        let iso = unix_to_iso(1700000000);
        assert!(iso.starts_with("2023-11-14"));
        assert!(iso.contains("22:13:20"));
    }

    #[test]
    fn unix_to_iso_epoch_zero() {
        let iso = unix_to_iso(0);
        assert!(iso.starts_with("1970-01-01"));
    }

    #[test]
    fn unix_to_iso_negative_timestamp() {
        // Before epoch -- chrono handles this fine (1969-12-31)
        let iso = unix_to_iso(-86400);
        assert!(iso.starts_with("1969-12-31"));
    }

    #[test]
    fn unix_to_iso_opt_some() {
        let result = unix_to_iso_opt(Some(1700000000));
        assert!(result.is_some());
        assert!(result.unwrap().starts_with("2023-11-14"));
    }

    #[test]
    fn unix_to_iso_opt_none() {
        let result = unix_to_iso_opt(None);
        assert!(result.is_none());
    }

    #[test]
    fn now_unix_returns_reasonable_value() {
        let ts = now_unix();
        // Should be after 2024-01-01 (1704067200) and before 2100-01-01 (4102444800)
        assert!(ts > 1704067200, "now_unix returned a timestamp before 2024");
        assert!(ts < 4102444800, "now_unix returned a timestamp after 2100");
    }

    #[test]
    fn now_unix_monotonic_within_call() {
        let t1 = now_unix();
        let t2 = now_unix();
        assert!(t2 >= t1, "second call should not be earlier than first");
    }

    // Test the serde_unix serializers via a helper struct
    #[derive(serde::Serialize, serde::Deserialize)]
    struct TestRequired {
        #[serde(serialize_with = "serde_unix::serialize_required")]
        ts: i64,
    }

    #[derive(serde::Serialize, serde::Deserialize)]
    struct TestOptional {
        #[serde(serialize_with = "serde_unix::serialize_optional")]
        ts: Option<i64>,
    }

    #[test]
    fn serde_unix_required_serializes_to_iso_string() {
        let val = TestRequired { ts: 1700000000 };
        let json = serde_json::to_string(&val).unwrap();
        assert!(json.contains("2023-11-14"));
        assert!(json.contains("22:13:20"));
    }

    #[test]
    fn serde_unix_optional_some_serializes_to_iso_string() {
        let val = TestOptional {
            ts: Some(1700000000),
        };
        let json = serde_json::to_string(&val).unwrap();
        assert!(json.contains("2023-11-14"));
    }

    #[test]
    fn serde_unix_optional_none_serializes_to_null() {
        let val = TestOptional { ts: None };
        let json = serde_json::to_string(&val).unwrap();
        assert!(json.contains("null"));
    }
}
