use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorKind {
    NotFound,
    Conflict,
    Validation,
    Database,
    Unauthorized,
    #[allow(dead_code)]
    Internal,
    Sync,
    #[allow(dead_code)]
    Network,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl AppError {
    pub fn not_found(entity: &str, id: &str) -> Self {
        Self {
            kind: ErrorKind::NotFound,
            message: format!("{entity} not found: {id}"),
            field: None,
        }
    }

    pub fn validation(field: &str, message: &str) -> Self {
        Self {
            kind: ErrorKind::Validation,
            message: message.to_string(),
            field: Some(field.to_string()),
        }
    }

    pub fn unauthorized(message: &str) -> Self {
        Self {
            kind: ErrorKind::Unauthorized,
            message: message.to_string(),
            field: None,
        }
    }

    pub fn conflict(message: &str) -> Self {
        Self {
            kind: ErrorKind::Conflict,
            message: message.to_string(),
            field: None,
        }
    }

    pub fn sync(message: &str) -> Self {
        Self {
            kind: ErrorKind::Sync,
            message: message.to_string(),
            field: None,
        }
    }

    #[allow(dead_code)]
    pub fn network(message: &str) -> Self {
        Self {
            kind: ErrorKind::Network,
            message: message.to_string(),
            field: None,
        }
    }

    pub fn database(e: sqlx::Error) -> Self {
        // Detect specific SQLite constraint errors
        if let sqlx::Error::Database(ref db_err) = e {
            let msg = db_err.message();
            if msg.contains("UNIQUE constraint") {
                return Self::conflict(msg);
            }
        }
        Self {
            kind: ErrorKind::Database,
            message: e.to_string(),
            field: None,
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        Self::database(e)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_found_contains_entity_and_id() {
        let err = AppError::not_found("Exercise", "abc-123");
        assert!(err.message.contains("Exercise"));
        assert!(err.message.contains("abc-123"));
        assert!(err.field.is_none());
    }

    #[test]
    fn validation_stores_field_name() {
        let err = AppError::validation("weight", "must be positive");
        assert_eq!(err.field.as_deref(), Some("weight"));
        assert!(err.message.contains("must be positive"));
    }

    #[test]
    fn unauthorized_has_no_field() {
        let err = AppError::unauthorized("token expired");
        assert!(err.message.contains("token expired"));
        assert!(err.field.is_none());
    }

    #[test]
    fn conflict_has_no_field() {
        let err = AppError::conflict("duplicate name");
        assert!(err.message.contains("duplicate name"));
        assert!(err.field.is_none());
    }

    #[test]
    fn sync_has_no_field() {
        let err = AppError::sync("version mismatch");
        assert!(err.message.contains("version mismatch"));
        assert!(err.field.is_none());
    }

    #[test]
    fn network_has_no_field() {
        let err = AppError::network("connection refused");
        assert!(err.message.contains("connection refused"));
        assert!(err.field.is_none());
    }

    #[test]
    fn display_impl_returns_message() {
        let err = AppError::not_found("Workout", "w-1");
        let displayed = format!("{err}");
        assert_eq!(displayed, err.message);
    }

    #[test]
    fn error_kind_serializes_screaming_snake_case() {
        let json = serde_json::to_string(&ErrorKind::NotFound).unwrap();
        assert_eq!(json, "\"NOT_FOUND\"");

        let json = serde_json::to_string(&ErrorKind::Database).unwrap();
        assert_eq!(json, "\"DATABASE\"");

        let json = serde_json::to_string(&ErrorKind::Validation).unwrap();
        assert_eq!(json, "\"VALIDATION\"");

        let json = serde_json::to_string(&ErrorKind::Unauthorized).unwrap();
        assert_eq!(json, "\"UNAUTHORIZED\"");

        let json = serde_json::to_string(&ErrorKind::Conflict).unwrap();
        assert_eq!(json, "\"CONFLICT\"");

        let json = serde_json::to_string(&ErrorKind::Internal).unwrap();
        assert_eq!(json, "\"INTERNAL\"");

        let json = serde_json::to_string(&ErrorKind::Sync).unwrap();
        assert_eq!(json, "\"SYNC\"");

        let json = serde_json::to_string(&ErrorKind::Network).unwrap();
        assert_eq!(json, "\"NETWORK\"");
    }

    #[test]
    fn app_error_serializes_without_field_when_none() {
        let err = AppError::not_found("Set", "s-1");
        let json = serde_json::to_string(&err).unwrap();
        assert!(!json.contains("\"field\""));
        assert!(json.contains("\"NOT_FOUND\""));
    }

    #[test]
    fn app_error_serializes_with_field_when_some() {
        let err = AppError::validation("reps", "too high");
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"field\":\"reps\""));
        assert!(json.contains("\"VALIDATION\""));
    }

    #[test]
    fn from_sqlx_row_not_found_produces_database_kind() {
        let sqlx_err = sqlx::Error::RowNotFound;
        let err = AppError::from(sqlx_err);
        let json = serde_json::to_string(&err.kind).unwrap();
        assert_eq!(json, "\"DATABASE\"");
    }
}
