#[derive(Debug, PartialEq)]
pub enum Winner {
    Local,
    Remote,
}

/// Last-write-wins conflict resolution based on updated_at timestamp.
/// Returns Remote if remote is strictly newer, Local otherwise.
pub fn resolve_conflict(local_updated_at: i64, remote_updated_at: i64) -> Winner {
    if remote_updated_at > local_updated_at {
        Winner::Remote
    } else {
        Winner::Local
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_newer_wins() {
        assert_eq!(resolve_conflict(100, 200), Winner::Remote);
    }

    #[test]
    fn local_newer_wins() {
        assert_eq!(resolve_conflict(200, 100), Winner::Local);
    }

    #[test]
    fn equal_timestamps_keep_local() {
        assert_eq!(resolve_conflict(100, 100), Winner::Local);
    }
}
