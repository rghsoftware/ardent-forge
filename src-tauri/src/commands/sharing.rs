use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    AccountabilityGroupRow, ConnectionActivityFeedEntry, DirectConnectionRow,
    GroupActivityFeedEntry, GroupInviteRow, GroupMemberRow,
};
use crate::utils::{now_unix, unix_to_iso, unix_to_iso_opt};

// ============================================================
// Accountability Group commands
// ============================================================

/// Creates a new accountability group and adds the creator as a COACH member.
#[tauri::command]
pub async fn create_group(
    pool: State<'_, SqlitePool>,
    name: String,
    description: Option<String>,
    data_retention_days: Option<i64>,
    user_id: String,
) -> Result<AccountabilityGroupRow, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let retention = data_retention_days.unwrap_or(30);

    let mut tx = pool.begin().await?;

    // Insert the group
    sqlx::query(
        "INSERT INTO accountability_groups \
         (id, user_id, name, description, data_retention_days, created_by, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&name)
    .bind(&description)
    .bind(retention)
    .bind(&user_id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Add creator as COACH member
    let member_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO group_members \
         (id, group_id, user_id, role, share_history_before_join, joined_at, created_at, updated_at) \
         VALUES (?, ?, ?, 'COACH', 1, ?, ?, ?)",
    )
    .bind(&member_id)
    .bind(&id)
    .bind(&user_id)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let row = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Lists all accountability groups the user is a member of.
#[tauri::command]
pub async fn get_groups(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<AccountabilityGroupRow>, AppError> {
    let rows = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT ag.* FROM accountability_groups ag \
         INNER JOIN group_members gm ON gm.group_id = ag.id \
         WHERE gm.user_id = ? \
         ORDER BY ag.created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Fetches a single accountability group by ID.
#[tauri::command]
pub async fn get_group(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<AccountabilityGroupRow>, AppError> {
    let row = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await?;

    Ok(row)
}

/// Updates an accountability group's mutable fields.
#[tauri::command]
pub async fn update_group(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    data_retention_days: Option<i64>,
) -> Result<AccountabilityGroupRow, AppError> {
    let now = now_unix();

    // Fetch current record
    let existing = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("AccountabilityGroup", &id))?;

    let final_name = name.unwrap_or(existing.name);
    let final_description = match description {
        Some(d) if d.is_empty() => None,  // explicit clear
        Some(d) => Some(d),               // update
        None => existing.description,     // keep existing
    };
    let final_retention = data_retention_days.unwrap_or(existing.data_retention_days);

    sqlx::query(
        "UPDATE accountability_groups \
         SET name = ?, description = ?, data_retention_days = ?, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&final_name)
    .bind(&final_description)
    .bind(final_retention)
    .bind(now)
    .bind(&id)
    .execute(pool.inner())
    .await?;

    let row = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Deletes an accountability group by ID. Cascades to members and invites.
/// Only the group owner (user_id on the group) can delete.
#[tauri::command]
pub async fn delete_group(
    pool: State<'_, SqlitePool>,
    id: String,
    user_id: String,
) -> Result<(), AppError> {
    // Verify caller is the group owner
    let group = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("AccountabilityGroup", &id))?;

    if group.user_id != user_id {
        return Err(AppError::unauthorized("Only the group owner can delete this group"));
    }

    let result = sqlx::query("DELETE FROM accountability_groups WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("AccountabilityGroup", &id));
    }

    Ok(())
}

// ============================================================
// Group Member commands
// ============================================================

/// Lists all members of a group.
#[tauri::command]
pub async fn get_group_members(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> Result<Vec<GroupMemberRow>, AppError> {
    let rows = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at ASC",
    )
    .bind(&group_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Removes a member from a group.
/// Caller must be a coach in the group, or the user removing themselves.
#[tauri::command]
pub async fn remove_group_member(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
    caller_id: String,
) -> Result<(), AppError> {
    // Allow self-removal without coach check
    if caller_id != user_id {
        // Verify caller is a coach
        let caller_member = sqlx::query_as::<_, GroupMemberRow>(
            "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
        )
        .bind(&group_id)
        .bind(&caller_id)
        .fetch_optional(pool.inner())
        .await?;

        match caller_member {
            Some(m) if m.role == "COACH" => {}
            _ => return Err(AppError::unauthorized("Only coaches can remove other members")),
        }
    }

    let result = sqlx::query("DELETE FROM group_members WHERE group_id = ? AND user_id = ?")
        .bind(&group_id)
        .bind(&user_id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("GroupMember", &format!("{group_id}/{user_id}")));
    }

    Ok(())
}

/// Updates a group member's role.
/// Caller must be a coach. Cannot escalate own role to COACH.
#[tauri::command]
pub async fn update_member_role(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
    role: String,
    caller_id: String,
) -> Result<GroupMemberRow, AppError> {
    let now = now_unix();

    // Validate role
    if role != "COACH" && role != "MEMBER" {
        return Err(AppError::validation("role", "Role must be COACH or MEMBER"));
    }

    // Prevent self-escalation to COACH
    if caller_id == user_id && role == "COACH" {
        return Err(AppError::validation("role", "Cannot promote yourself to coach"));
    }

    // Verify caller is a coach in the group
    let caller_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&caller_id)
    .fetch_optional(pool.inner())
    .await?;

    match caller_member {
        Some(m) if m.role == "COACH" => {}
        _ => return Err(AppError::unauthorized("Only coaches can update member roles")),
    }

    // If promoting to COACH, check coach limit (max 3)
    if role == "COACH" {
        let coach_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM group_members WHERE group_id = ? AND role = 'COACH'")
                .bind(&group_id)
                .fetch_one(pool.inner())
                .await?;

        if coach_count.0 >= 3 {
            return Err(AppError::validation(
                "role",
                "Group has reached the maximum of 3 coaches",
            ));
        }
    }

    sqlx::query("UPDATE group_members SET role = ?, updated_at = ? WHERE group_id = ? AND user_id = ?")
        .bind(&role)
        .bind(now)
        .bind(&group_id)
        .bind(&user_id)
        .execute(pool.inner())
        .await?;

    let row = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&user_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("GroupMember", &format!("{group_id}/{user_id}")))?;

    Ok(row)
}

// ============================================================
// Group Invite commands
// ============================================================

/// Creates a new invite code for a group. Expires in 7 days.
#[tauri::command]
pub async fn create_invite(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
) -> Result<GroupInviteRow, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let expires_at = now + (7 * 24 * 60 * 60); // 7 days

    // Generate AF-XXXXXXXX code
    let raw = Uuid::new_v4().to_string().replace('-', "").to_uppercase();
    let code = format!("AF-{}", &raw[..8]);

    sqlx::query(
        "INSERT INTO group_invites \
         (id, group_id, code, created_by, expires_at, is_active, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&group_id)
    .bind(&code)
    .bind(&user_id)
    .bind(expires_at)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await?;

    let row = sqlx::query_as::<_, GroupInviteRow>(
        "SELECT * FROM group_invites WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Lists active, non-expired invites for a group.
#[tauri::command]
pub async fn get_group_invites(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> Result<Vec<GroupInviteRow>, AppError> {
    let now = now_unix();

    let rows = sqlx::query_as::<_, GroupInviteRow>(
        "SELECT * FROM group_invites \
         WHERE group_id = ? AND is_active = 1 AND expires_at > ? \
         ORDER BY created_at DESC",
    )
    .bind(&group_id)
    .bind(now)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Revokes an invite code by setting is_active to 0.
/// Caller must be a coach in the invite's group.
#[tauri::command]
pub async fn revoke_invite(
    pool: State<'_, SqlitePool>,
    invite_id: String,
    user_id: String,
) -> Result<(), AppError> {
    let now = now_unix();

    // Fetch the invite to get its group_id
    let invite = sqlx::query_as::<_, GroupInviteRow>(
        "SELECT * FROM group_invites WHERE id = ?",
    )
    .bind(&invite_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("GroupInvite", &invite_id))?;

    // Verify caller is a coach in the invite's group
    let caller_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&invite.group_id)
    .bind(&user_id)
    .fetch_optional(pool.inner())
    .await?;

    match caller_member {
        Some(m) if m.role == "COACH" => {}
        _ => return Err(AppError::unauthorized("Only coaches can revoke invites")),
    }

    let result = sqlx::query("UPDATE group_invites SET is_active = 0, updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&invite_id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("GroupInvite", &invite_id));
    }

    Ok(())
}

/// Joins a group by invite code. Validates code, expiration, group size, and user group limit.
#[tauri::command]
pub async fn join_group_by_code(
    pool: State<'_, SqlitePool>,
    code: String,
    user_id: String,
) -> Result<GroupMemberRow, AppError> {
    let now = now_unix();

    // Find valid invite
    let invite = sqlx::query_as::<_, GroupInviteRow>(
        "SELECT * FROM group_invites WHERE code = ? AND is_active = 1 AND expires_at > ?",
    )
    .bind(&code)
    .bind(now)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::validation("code", "Invalid or expired invite code"))?;

    // Check if user is already a member of this group
    let existing_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&invite.group_id)
    .bind(&user_id)
    .fetch_optional(pool.inner())
    .await?;

    if existing_member.is_some() {
        return Err(AppError::validation("code", "You are already a member of this group"));
    }

    // Check user group limit (max 5)
    let user_group_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM group_members WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(pool.inner())
            .await?;

    if user_group_count.0 >= 5 {
        return Err(AppError::validation(
            "user_id",
            "Maximum group limit (5) reached",
        ));
    }

    // Check group size limit (max 20)
    let member_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM group_members WHERE group_id = ?")
            .bind(&invite.group_id)
            .fetch_one(pool.inner())
            .await?;

    if member_count.0 >= 20 {
        return Err(AppError::validation(
            "group_id",
            "Group has reached the maximum of 20 members",
        ));
    }

    // Insert member
    let member_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO group_members \
         (id, group_id, user_id, role, share_history_before_join, joined_at, created_at, updated_at) \
         VALUES (?, ?, ?, 'MEMBER', 0, ?, ?, ?)",
    )
    .bind(&member_id)
    .bind(&invite.group_id)
    .bind(&user_id)
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await?;

    let row = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE id = ?",
    )
    .bind(&member_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

// ============================================================
// Direct Connection commands
// ============================================================

/// Creates a new connection request (status = PENDING).
#[tauri::command]
pub async fn request_connection(
    pool: State<'_, SqlitePool>,
    requester_id: String,
    recipient_id: String,
) -> Result<DirectConnectionRow, AppError> {
    if requester_id == recipient_id {
        return Err(AppError::validation(
            "recipient_id",
            "Cannot connect with yourself",
        ));
    }

    // Bidirectional duplicate check: (A,B) or (B,A)
    let existing = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections \
         WHERE (requester_id = ? AND recipient_id = ?) \
            OR (requester_id = ? AND recipient_id = ?)",
    )
    .bind(&requester_id)
    .bind(&recipient_id)
    .bind(&recipient_id)
    .bind(&requester_id)
    .fetch_optional(pool.inner())
    .await?;

    if existing.is_some() {
        return Err(AppError::conflict("A connection between these users already exists"));
    }

    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    sqlx::query(
        "INSERT INTO direct_connections \
         (id, requester_id, recipient_id, status, requester_grants_write, \
          recipient_grants_write, created_at, updated_at) \
         VALUES (?, ?, ?, 'PENDING', 0, 0, ?, ?)",
    )
    .bind(&id)
    .bind(&requester_id)
    .bind(&recipient_id)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await?;

    let row = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Lists all ACTIVE connections for a user.
#[tauri::command]
pub async fn get_connections(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<DirectConnectionRow>, AppError> {
    let rows = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections \
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'ACTIVE' \
         ORDER BY accepted_at DESC",
    )
    .bind(&user_id)
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Lists all PENDING connections for a user.
#[tauri::command]
pub async fn get_pending_connections(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<DirectConnectionRow>, AppError> {
    let rows = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections \
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'PENDING' \
         ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Accepts a connection request. Only the recipient can accept.
#[tauri::command]
pub async fn accept_connection(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
) -> Result<DirectConnectionRow, AppError> {
    let now = now_unix();

    // Fetch and verify caller is the recipient
    let existing = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    if existing.recipient_id != user_id {
        return Err(AppError::unauthorized("Only the recipient can accept a connection request"));
    }

    let result = sqlx::query(
        "UPDATE direct_connections \
         SET status = 'ACTIVE', accepted_at = ?, updated_at = ? \
         WHERE id = ? AND status = 'PENDING'",
    )
    .bind(now)
    .bind(now)
    .bind(&connection_id)
    .execute(pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::validation("connection_id", "Connection is not in PENDING status"));
    }

    let row = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Declines a connection request. Only the recipient can decline.
#[tauri::command]
pub async fn decline_connection(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
) -> Result<DirectConnectionRow, AppError> {
    let now = now_unix();

    // Fetch and verify caller is the recipient
    let existing = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    if existing.recipient_id != user_id {
        return Err(AppError::unauthorized("Only the recipient can decline a connection request"));
    }

    let result = sqlx::query(
        "UPDATE direct_connections SET status = 'DECLINED', updated_at = ? WHERE id = ? AND status = 'PENDING'",
    )
    .bind(now)
    .bind(&connection_id)
    .execute(pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::validation("connection_id", "Connection is not in PENDING status"));
    }

    let row = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Removes (deletes) a connection.
/// Caller must be either the requester or the recipient.
#[tauri::command]
pub async fn remove_connection(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
) -> Result<(), AppError> {
    // Verify caller is a participant
    let existing = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    if existing.requester_id != user_id && existing.recipient_id != user_id {
        return Err(AppError::unauthorized("Only connection participants can remove a connection"));
    }

    let result = sqlx::query("DELETE FROM direct_connections WHERE id = ?")
        .bind(&connection_id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("DirectConnection", &connection_id));
    }

    Ok(())
}

/// Updates write access for a connection. Determines direction based on user_id.
/// Caller must be either the requester or the recipient.
#[tauri::command]
pub async fn update_connection_write_access(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
    grants_write: bool,
) -> Result<DirectConnectionRow, AppError> {
    let now = now_unix();
    let grants_write_int: i64 = if grants_write { 1 } else { 0 };

    // Fetch existing to determine direction
    let existing = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    // Explicit auth check: caller must be a participant
    if existing.requester_id == user_id {
        sqlx::query(
            "UPDATE direct_connections SET requester_grants_write = ?, updated_at = ? WHERE id = ?",
        )
        .bind(grants_write_int)
        .bind(now)
        .bind(&connection_id)
        .execute(pool.inner())
        .await?;
    } else if existing.recipient_id == user_id {
        sqlx::query(
            "UPDATE direct_connections SET recipient_grants_write = ?, updated_at = ? WHERE id = ?",
        )
        .bind(grants_write_int)
        .bind(now)
        .bind(&connection_id)
        .execute(pool.inner())
        .await?;
    } else {
        return Err(AppError::unauthorized("Only connection participants can update write access"));
    }

    let row = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections WHERE id = ?",
    )
    .bind(&connection_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

// ============================================================
// Activity Feed commands
// ============================================================

/// Minimal row for workout log feed queries (no private fields).
#[derive(Debug, sqlx::FromRow)]
struct FeedWorkoutRow {
    id: String,
    user_id: Option<String>,
    title: Option<String>,
    started_at: i64,
    completed_at: Option<i64>,
}

/// Row for exercise count aggregation.
/// Note: counts logged_activity_groups (supersets/circuits), not individual exercises.
#[derive(Debug, sqlx::FromRow)]
struct ExerciseCountRow {
    workout_log_id: String,
    cnt: i64,
}

/// Returns the group activity feed: recent completed workouts from fellow group members.
/// Excludes private fields (perceived_difficulty, bodyweight_at_session, overall_notes).
/// Respects each member's share_history_before_join (SH-9: the data owner controls visibility).
#[tauri::command]
pub async fn get_group_activity_feed(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<GroupActivityFeedEntry>, AppError> {
    let feed_limit = limit.unwrap_or(20);

    // Verify viewer is a member of the group
    let _viewer_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&user_id)
    .fetch_optional(pool.inner())
    .await?
    .ok_or_else(|| AppError::unauthorized("You are not a member of this group"))?;

    // Get peer members (excluding self)
    let peer_members = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id != ?",
    )
    .bind(&group_id)
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    if peer_members.is_empty() {
        return Ok(Vec::new());
    }

    // Build per-member maps: role and SH-9 history visibility
    let member_ids: Vec<String> = peer_members.iter().map(|m| m.user_id.clone()).collect();
    let role_map: std::collections::HashMap<String, String> = peer_members
        .iter()
        .map(|m| (m.user_id.clone(), m.role.clone()))
        .collect();

    // SH-9: Map each member to their joined_at if they do NOT share history before join.
    // The data owner's flag controls visibility, not the viewer's.
    let history_cutoff_map: std::collections::HashMap<String, Option<i64>> = peer_members
        .iter()
        .map(|m| {
            let cutoff = if m.share_history_before_join == 0 {
                m.joined_at // workouts before this timestamp are hidden
            } else {
                None // no cutoff, all history visible
            };
            (m.user_id.clone(), cutoff)
        })
        .collect();

    // Build the IN clause placeholders
    let placeholders = member_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    // Query all completed workouts from peer members (filter SH-9 post-fetch per owner)
    let mut conditions = vec![
        format!("user_id IN ({placeholders})"),
        "completed_at IS NOT NULL".to_string(),
    ];

    if before.is_some() {
        conditions.push("started_at < ?".to_string());
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT id, user_id, title, started_at, completed_at \
         FROM workout_logs WHERE {where_clause} \
         ORDER BY started_at DESC LIMIT ?"
    );

    let mut query = sqlx::query_as::<_, FeedWorkoutRow>(&sql);

    for mid in &member_ids {
        query = query.bind(mid);
    }
    if let Some(b) = before {
        query = query.bind(b);
    }
    query = query.bind(feed_limit);

    let logs = query.fetch_all(pool.inner()).await?;

    if logs.is_empty() {
        return Ok(Vec::new());
    }

    // SH-9: Filter logs per data owner's share_history_before_join setting
    let filtered_logs: Vec<FeedWorkoutRow> = logs
        .into_iter()
        .filter(|log| {
            let uid = log.user_id.as_deref().unwrap_or_default();
            match history_cutoff_map.get(uid) {
                Some(Some(cutoff)) => log.started_at >= *cutoff,
                _ => true, // no cutoff or unknown member, allow
            }
        })
        .collect();

    if filtered_logs.is_empty() {
        return Ok(Vec::new());
    }

    // Get exercise counts
    let log_ids: Vec<String> = filtered_logs.iter().map(|l| l.id.clone()).collect();
    let log_placeholders = log_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let count_sql = format!(
        "SELECT workout_log_id, COUNT(*) as cnt \
         FROM logged_activity_groups \
         WHERE workout_log_id IN ({log_placeholders}) \
         GROUP BY workout_log_id"
    );
    let mut count_query = sqlx::query_as::<_, ExerciseCountRow>(&count_sql);
    for lid in &log_ids {
        count_query = count_query.bind(lid);
    }
    let counts = count_query.fetch_all(pool.inner()).await?;
    let count_map: std::collections::HashMap<String, i64> = counts
        .into_iter()
        .map(|c| (c.workout_log_id, c.cnt))
        .collect();

    let entries = filtered_logs
        .into_iter()
        .map(|log| {
            let uid = log.user_id.clone().unwrap_or_default();
            let started_iso = unix_to_iso(log.started_at);
            let completed_iso = unix_to_iso_opt(log.completed_at);

            let duration_seconds = log
                .completed_at
                .map(|ca| ca - log.started_at);

            GroupActivityFeedEntry {
                id: log.id.clone(),
                user_id: uid.clone(),
                title: log.title,
                started_at: started_iso,
                completed_at: completed_iso,
                duration_seconds,
                exercise_count: *count_map.get(&log.id).unwrap_or(&0),
                group_id: group_id.clone(),
                member_role: role_map.get(&uid).cloned().unwrap_or_else(|| "MEMBER".to_string()),
            }
        })
        .collect();

    Ok(entries)
}

/// Returns the connection activity feed: recent completed workouts from connected peers.
/// Excludes private fields.
#[tauri::command]
pub async fn get_connection_activity_feed(
    pool: State<'_, SqlitePool>,
    user_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<ConnectionActivityFeedEntry>, AppError> {
    let feed_limit = limit.unwrap_or(20);

    // Get active connections
    let connections = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections \
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'ACTIVE'",
    )
    .bind(&user_id)
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    if connections.is_empty() {
        return Ok(Vec::new());
    }

    // Build peer -> connection_id map
    let mut connection_map: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut peer_ids: Vec<String> = Vec::new();

    for conn in &connections {
        let peer_id = if conn.requester_id == user_id {
            conn.recipient_id.clone()
        } else {
            conn.requester_id.clone()
        };
        peer_ids.push(peer_id.clone());
        connection_map.insert(peer_id, conn.id.clone());
    }

    // Build the IN clause
    let placeholders = peer_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    let mut conditions = vec![
        format!("user_id IN ({placeholders})"),
        "completed_at IS NOT NULL".to_string(),
    ];

    if before.is_some() {
        conditions.push("started_at < ?".to_string());
    }

    let where_clause = conditions.join(" AND ");
    let sql = format!(
        "SELECT id, user_id, title, started_at, completed_at \
         FROM workout_logs WHERE {where_clause} \
         ORDER BY started_at DESC LIMIT ?"
    );

    let mut query = sqlx::query_as::<_, FeedWorkoutRow>(&sql);
    for pid in &peer_ids {
        query = query.bind(pid);
    }
    if let Some(b) = before {
        query = query.bind(b);
    }
    query = query.bind(feed_limit);

    let logs = query.fetch_all(pool.inner()).await?;

    if logs.is_empty() {
        return Ok(Vec::new());
    }

    // Get exercise counts
    let log_ids: Vec<String> = logs.iter().map(|l| l.id.clone()).collect();
    let log_placeholders = log_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let count_sql = format!(
        "SELECT workout_log_id, COUNT(*) as cnt \
         FROM logged_activity_groups \
         WHERE workout_log_id IN ({log_placeholders}) \
         GROUP BY workout_log_id"
    );
    let mut count_query = sqlx::query_as::<_, ExerciseCountRow>(&count_sql);
    for lid in &log_ids {
        count_query = count_query.bind(lid);
    }
    let counts = count_query.fetch_all(pool.inner()).await?;
    let count_map: std::collections::HashMap<String, i64> = counts
        .into_iter()
        .map(|c| (c.workout_log_id, c.cnt))
        .collect();

    let entries = logs
        .into_iter()
        .map(|log| {
            let uid = log.user_id.clone().unwrap_or_default();
            let started_iso = unix_to_iso(log.started_at);
            let completed_iso = unix_to_iso_opt(log.completed_at);

            let duration_seconds = log
                .completed_at
                .map(|ca| ca - log.started_at);

            ConnectionActivityFeedEntry {
                id: log.id.clone(),
                user_id: uid.clone(),
                title: log.title,
                started_at: started_iso,
                completed_at: completed_iso,
                duration_seconds,
                exercise_count: *count_map.get(&log.id).unwrap_or(&0),
                connection_id: connection_map
                    .get(&uid)
                    .cloned()
                    .unwrap_or_default(),
            }
        })
        .collect();

    Ok(entries)
}
