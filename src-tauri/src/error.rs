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
