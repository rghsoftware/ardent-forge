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
// Commands (thin wrappers delegating to inner functions for testability)
// ============================================================

// ---- Accountability Group commands ----

#[tauri::command]
pub async fn create_group(
    pool: State<'_, SqlitePool>,
    name: String,
    description: Option<String>,
    data_retention_days: Option<i64>,
    user_id: String,
) -> Result<AccountabilityGroupRow, AppError> {
    create_group_inner(
        pool.inner(),
        name,
        description,
        data_retention_days,
        user_id,
    )
    .await
}

#[tauri::command]
pub async fn get_groups(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<AccountabilityGroupRow>, AppError> {
    get_groups_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn get_group(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<AccountabilityGroupRow>, AppError> {
    get_group_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn update_group(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    data_retention_days: Option<i64>,
) -> Result<AccountabilityGroupRow, AppError> {
    update_group_inner(pool.inner(), id, name, description, data_retention_days).await
}

#[tauri::command]
pub async fn delete_group(
    pool: State<'_, SqlitePool>,
    id: String,
    user_id: String,
) -> Result<(), AppError> {
    delete_group_inner(pool.inner(), id, user_id).await
}

// ---- Group Member commands ----

#[tauri::command]
pub async fn get_group_members(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> Result<Vec<GroupMemberRow>, AppError> {
    get_group_members_inner(pool.inner(), group_id).await
}

#[tauri::command]
pub async fn remove_group_member(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
    caller_id: String,
) -> Result<(), AppError> {
    remove_group_member_inner(pool.inner(), group_id, user_id, caller_id).await
}

#[tauri::command]
pub async fn update_member_role(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
    role: String,
    caller_id: String,
) -> Result<GroupMemberRow, AppError> {
    update_member_role_inner(pool.inner(), group_id, user_id, role, caller_id).await
}

// ---- Group Invite commands ----

#[tauri::command]
pub async fn create_invite(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
) -> Result<GroupInviteRow, AppError> {
    create_invite_inner(pool.inner(), group_id, user_id).await
}

#[tauri::command]
pub async fn get_group_invites(
    pool: State<'_, SqlitePool>,
    group_id: String,
) -> Result<Vec<GroupInviteRow>, AppError> {
    get_group_invites_inner(pool.inner(), group_id).await
}

#[tauri::command]
pub async fn revoke_invite(
    pool: State<'_, SqlitePool>,
    invite_id: String,
    user_id: String,
) -> Result<(), AppError> {
    revoke_invite_inner(pool.inner(), invite_id, user_id).await
}

#[tauri::command]
pub async fn join_group_by_code(
    pool: State<'_, SqlitePool>,
    code: String,
    user_id: String,
) -> Result<GroupMemberRow, AppError> {
    join_group_by_code_inner(pool.inner(), code, user_id).await
}

// ---- Direct Connection commands ----

#[tauri::command]
pub async fn request_connection(
    pool: State<'_, SqlitePool>,
    requester_id: String,
    recipient_id: String,
) -> Result<DirectConnectionRow, AppError> {
    request_connection_inner(pool.inner(), requester_id, recipient_id).await
}

#[tauri::command]
pub async fn get_connections(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<DirectConnectionRow>, AppError> {
    get_connections_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn get_pending_connections(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<DirectConnectionRow>, AppError> {
    get_pending_connections_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn accept_connection(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
) -> Result<DirectConnectionRow, AppError> {
    accept_connection_inner(pool.inner(), connection_id, user_id).await
}

#[tauri::command]
pub async fn decline_connection(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
) -> Result<DirectConnectionRow, AppError> {
    decline_connection_inner(pool.inner(), connection_id, user_id).await
}

#[tauri::command]
pub async fn remove_connection(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
) -> Result<(), AppError> {
    remove_connection_inner(pool.inner(), connection_id, user_id).await
}

#[tauri::command]
pub async fn update_connection_write_access(
    pool: State<'_, SqlitePool>,
    connection_id: String,
    user_id: String,
    grants_write: bool,
) -> Result<DirectConnectionRow, AppError> {
    update_connection_write_access_inner(pool.inner(), connection_id, user_id, grants_write).await
}

// ---- Activity Feed commands ----

#[tauri::command]
pub async fn get_group_activity_feed(
    pool: State<'_, SqlitePool>,
    group_id: String,
    user_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<GroupActivityFeedEntry>, AppError> {
    get_group_activity_feed_inner(pool.inner(), group_id, user_id, before, limit).await
}

#[tauri::command]
pub async fn get_connection_activity_feed(
    pool: State<'_, SqlitePool>,
    user_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<ConnectionActivityFeedEntry>, AppError> {
    get_connection_activity_feed_inner(pool.inner(), user_id, before, limit).await
}

// ============================================================
// Inner functions (testable, take &SqlitePool directly)
// ============================================================

// ---- Accountability Group inner functions ----

/// Creates a new accountability group and adds the creator as a COACH member.
pub(crate) async fn create_group_inner(
    pool: &SqlitePool,
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
    .fetch_one(pool)
    .await?;

    Ok(row)
}

/// Lists all accountability groups the user is a member of.
pub(crate) async fn get_groups_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Vec<AccountabilityGroupRow>, AppError> {
    let rows = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT ag.* FROM accountability_groups ag \
         INNER JOIN group_members gm ON gm.group_id = ag.id \
         WHERE gm.user_id = ? \
         ORDER BY ag.created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Fetches a single accountability group by ID.
pub(crate) async fn get_group_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<AccountabilityGroupRow>, AppError> {
    let row = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

/// Updates an accountability group's mutable fields.
pub(crate) async fn update_group_inner(
    pool: &SqlitePool,
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
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("AccountabilityGroup", &id))?;

    let final_name = name.unwrap_or(existing.name);
    let final_description = match description {
        Some(d) if d.is_empty() => None, // explicit clear
        Some(d) => Some(d),              // update
        None => existing.description,    // keep existing
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
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

/// Deletes an accountability group by ID. Cascades to members and invites.
/// Only the group owner (user_id on the group) can delete.
pub(crate) async fn delete_group_inner(
    pool: &SqlitePool,
    id: String,
    user_id: String,
) -> Result<(), AppError> {
    // Verify caller is the group owner
    let group = sqlx::query_as::<_, AccountabilityGroupRow>(
        "SELECT * FROM accountability_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("AccountabilityGroup", &id))?;

    if group.user_id != user_id {
        return Err(AppError::unauthorized(
            "Only the group owner can delete this group",
        ));
    }

    let result = sqlx::query("DELETE FROM accountability_groups WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("AccountabilityGroup", &id));
    }

    Ok(())
}

// ---- Group Member inner functions ----

/// Lists all members of a group.
pub(crate) async fn get_group_members_inner(
    pool: &SqlitePool,
    group_id: String,
) -> Result<Vec<GroupMemberRow>, AppError> {
    let rows = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at ASC",
    )
    .bind(&group_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Removes a member from a group.
/// Caller must be a coach in the group, or the user removing themselves.
pub(crate) async fn remove_group_member_inner(
    pool: &SqlitePool,
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
        .fetch_optional(pool)
        .await?;

        match caller_member {
            Some(m) if m.role == "COACH" => {}
            _ => {
                return Err(AppError::unauthorized(
                    "Only coaches can remove other members",
                ))
            }
        }
    }

    let result = sqlx::query("DELETE FROM group_members WHERE group_id = ? AND user_id = ?")
        .bind(&group_id)
        .bind(&user_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found(
            "GroupMember",
            &format!("{group_id}/{user_id}"),
        ));
    }

    Ok(())
}

/// Updates a group member's role.
/// Caller must be a coach. Cannot escalate own role to COACH.
pub(crate) async fn update_member_role_inner(
    pool: &SqlitePool,
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
        return Err(AppError::validation(
            "role",
            "Cannot promote yourself to coach",
        ));
    }

    // Verify caller is a coach in the group
    let caller_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&caller_id)
    .fetch_optional(pool)
    .await?;

    match caller_member {
        Some(m) if m.role == "COACH" => {}
        _ => {
            return Err(AppError::unauthorized(
                "Only coaches can update member roles",
            ))
        }
    }

    // If promoting to COACH, check coach limit (max 3)
    if role == "COACH" {
        let coach_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM group_members WHERE group_id = ? AND role = 'COACH'",
        )
        .bind(&group_id)
        .fetch_one(pool)
        .await?;

        if coach_count.0 >= 3 {
            return Err(AppError::validation(
                "role",
                "Group has reached the maximum of 3 coaches",
            ));
        }
    }

    sqlx::query(
        "UPDATE group_members SET role = ?, updated_at = ? WHERE group_id = ? AND user_id = ?",
    )
    .bind(&role)
    .bind(now)
    .bind(&group_id)
    .bind(&user_id)
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("GroupMember", &format!("{group_id}/{user_id}")))?;

    Ok(row)
}

// ---- Group Invite inner functions ----

/// Creates a new invite code for a group. Expires in 7 days.
pub(crate) async fn create_invite_inner(
    pool: &SqlitePool,
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
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, GroupInviteRow>("SELECT * FROM group_invites WHERE id = ?")
        .bind(&id)
        .fetch_one(pool)
        .await?;

    Ok(row)
}

/// Lists active, non-expired invites for a group.
pub(crate) async fn get_group_invites_inner(
    pool: &SqlitePool,
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
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Revokes an invite code by setting is_active to 0.
/// Caller must be a coach in the invite's group.
pub(crate) async fn revoke_invite_inner(
    pool: &SqlitePool,
    invite_id: String,
    user_id: String,
) -> Result<(), AppError> {
    let now = now_unix();

    // Fetch the invite to get its group_id
    let invite = sqlx::query_as::<_, GroupInviteRow>("SELECT * FROM group_invites WHERE id = ?")
        .bind(&invite_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::not_found("GroupInvite", &invite_id))?;

    // Verify caller is a coach in the invite's group
    let caller_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&invite.group_id)
    .bind(&user_id)
    .fetch_optional(pool)
    .await?;

    match caller_member {
        Some(m) if m.role == "COACH" => {}
        _ => return Err(AppError::unauthorized("Only coaches can revoke invites")),
    }

    let result = sqlx::query("UPDATE group_invites SET is_active = 0, updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&invite_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("GroupInvite", &invite_id));
    }

    Ok(())
}

/// Joins a group by invite code. Validates code, expiration, group size, and user group limit.
pub(crate) async fn join_group_by_code_inner(
    pool: &SqlitePool,
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
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::validation("code", "Invalid or expired invite code"))?;

    // Check if user is already a member of this group
    let existing_member = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&invite.group_id)
    .bind(&user_id)
    .fetch_optional(pool)
    .await?;

    if existing_member.is_some() {
        return Err(AppError::validation(
            "code",
            "You are already a member of this group",
        ));
    }

    // Check user group limit (max 5)
    let user_group_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM group_members WHERE user_id = ?")
            .bind(&user_id)
            .fetch_one(pool)
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
            .fetch_one(pool)
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
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, GroupMemberRow>("SELECT * FROM group_members WHERE id = ?")
        .bind(&member_id)
        .fetch_one(pool)
        .await?;

    Ok(row)
}

// ---- Direct Connection inner functions ----

/// Creates a new connection request (status = PENDING).
pub(crate) async fn request_connection_inner(
    pool: &SqlitePool,
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
    .fetch_optional(pool)
    .await?;

    if existing.is_some() {
        return Err(AppError::conflict(
            "A connection between these users already exists",
        ));
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
    .execute(pool)
    .await?;

    let row =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&id)
            .fetch_one(pool)
            .await?;

    Ok(row)
}

/// Lists all ACTIVE connections for a user.
pub(crate) async fn get_connections_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Vec<DirectConnectionRow>, AppError> {
    let rows = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections \
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'ACTIVE' \
         ORDER BY accepted_at DESC",
    )
    .bind(&user_id)
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Lists all PENDING connections for a user.
pub(crate) async fn get_pending_connections_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Vec<DirectConnectionRow>, AppError> {
    let rows = sqlx::query_as::<_, DirectConnectionRow>(
        "SELECT * FROM direct_connections \
         WHERE (requester_id = ? OR recipient_id = ?) AND status = 'PENDING' \
         ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Accepts a connection request. Only the recipient can accept.
pub(crate) async fn accept_connection_inner(
    pool: &SqlitePool,
    connection_id: String,
    user_id: String,
) -> Result<DirectConnectionRow, AppError> {
    let now = now_unix();

    // Fetch and verify caller is the recipient
    let existing =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    if existing.recipient_id != user_id {
        return Err(AppError::unauthorized(
            "Only the recipient can accept a connection request",
        ));
    }

    let result = sqlx::query(
        "UPDATE direct_connections \
         SET status = 'ACTIVE', accepted_at = ?, updated_at = ? \
         WHERE id = ? AND status = 'PENDING'",
    )
    .bind(now)
    .bind(now)
    .bind(&connection_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::validation(
            "connection_id",
            "Connection is not in PENDING status",
        ));
    }

    let row =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_one(pool)
            .await?;

    Ok(row)
}

/// Declines a connection request. Only the recipient can decline.
pub(crate) async fn decline_connection_inner(
    pool: &SqlitePool,
    connection_id: String,
    user_id: String,
) -> Result<DirectConnectionRow, AppError> {
    let now = now_unix();

    // Fetch and verify caller is the recipient
    let existing =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    if existing.recipient_id != user_id {
        return Err(AppError::unauthorized(
            "Only the recipient can decline a connection request",
        ));
    }

    let result = sqlx::query(
        "UPDATE direct_connections SET status = 'DECLINED', updated_at = ? WHERE id = ? AND status = 'PENDING'",
    )
    .bind(now)
    .bind(&connection_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::validation(
            "connection_id",
            "Connection is not in PENDING status",
        ));
    }

    let row =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_one(pool)
            .await?;

    Ok(row)
}

/// Removes (deletes) a connection.
/// Caller must be either the requester or the recipient.
pub(crate) async fn remove_connection_inner(
    pool: &SqlitePool,
    connection_id: String,
    user_id: String,
) -> Result<(), AppError> {
    // Verify caller is a participant
    let existing =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::not_found("DirectConnection", &connection_id))?;

    if existing.requester_id != user_id && existing.recipient_id != user_id {
        return Err(AppError::unauthorized(
            "Only connection participants can remove a connection",
        ));
    }

    let result = sqlx::query("DELETE FROM direct_connections WHERE id = ?")
        .bind(&connection_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("DirectConnection", &connection_id));
    }

    Ok(())
}

/// Updates write access for a connection. Determines direction based on user_id.
/// Caller must be either the requester or the recipient.
pub(crate) async fn update_connection_write_access_inner(
    pool: &SqlitePool,
    connection_id: String,
    user_id: String,
    grants_write: bool,
) -> Result<DirectConnectionRow, AppError> {
    let now = now_unix();
    let grants_write_int: i64 = if grants_write { 1 } else { 0 };

    // Fetch existing to determine direction
    let existing =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_optional(pool)
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
        .execute(pool)
        .await?;
    } else if existing.recipient_id == user_id {
        sqlx::query(
            "UPDATE direct_connections SET recipient_grants_write = ?, updated_at = ? WHERE id = ?",
        )
        .bind(grants_write_int)
        .bind(now)
        .bind(&connection_id)
        .execute(pool)
        .await?;
    } else {
        return Err(AppError::unauthorized(
            "Only connection participants can update write access",
        ));
    }

    let row =
        sqlx::query_as::<_, DirectConnectionRow>("SELECT * FROM direct_connections WHERE id = ?")
            .bind(&connection_id)
            .fetch_one(pool)
            .await?;

    Ok(row)
}

// ---- Activity Feed inner functions ----

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
pub(crate) async fn get_group_activity_feed_inner(
    pool: &SqlitePool,
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
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::unauthorized("You are not a member of this group"))?;

    // Get peer members (excluding self)
    let peer_members = sqlx::query_as::<_, GroupMemberRow>(
        "SELECT * FROM group_members WHERE group_id = ? AND user_id != ?",
    )
    .bind(&group_id)
    .bind(&user_id)
    .fetch_all(pool)
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

    let logs = query.fetch_all(pool).await?;

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
    let counts = count_query.fetch_all(pool).await?;
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

            let duration_seconds = log.completed_at.map(|ca| ca - log.started_at);

            GroupActivityFeedEntry {
                id: log.id.clone(),
                user_id: uid.clone(),
                title: log.title,
                started_at: started_iso,
                completed_at: completed_iso,
                duration_seconds,
                exercise_count: *count_map.get(&log.id).unwrap_or(&0),
                group_id: group_id.clone(),
                member_role: role_map
                    .get(&uid)
                    .cloned()
                    .unwrap_or_else(|| "MEMBER".to_string()),
            }
        })
        .collect();

    Ok(entries)
}

/// Returns the connection activity feed: recent completed workouts from connected peers.
/// Excludes private fields.
pub(crate) async fn get_connection_activity_feed_inner(
    pool: &SqlitePool,
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
    .fetch_all(pool)
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

    let logs = query.fetch_all(pool).await?;

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
    let counts = count_query.fetch_all(pool).await?;
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

            let duration_seconds = log.completed_at.map(|ca| ca - log.started_at);

            ConnectionActivityFeedEntry {
                id: log.id.clone(),
                user_id: uid.clone(),
                title: log.title,
                started_at: started_iso,
                completed_at: completed_iso,
                duration_seconds,
                exercise_count: *count_map.get(&log.id).unwrap_or(&0),
                connection_id: connection_map.get(&uid).cloned().unwrap_or_default(),
            }
        })
        .collect();

    Ok(entries)
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    const SHARING_DDL: &str = "\
        CREATE TABLE IF NOT EXISTS accountability_groups (\
            id TEXT PRIMARY KEY, \
            user_id TEXT NOT NULL, \
            name TEXT NOT NULL, \
            description TEXT, \
            data_retention_days INTEGER NOT NULL DEFAULT 30, \
            created_by TEXT NOT NULL, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS group_members (\
            id TEXT PRIMARY KEY, \
            group_id TEXT NOT NULL, \
            user_id TEXT NOT NULL, \
            role TEXT NOT NULL CHECK(role IN ('COACH', 'MEMBER')), \
            share_history_before_join INTEGER NOT NULL DEFAULT 0, \
            joined_at INTEGER, \
            created_at INTEGER, \
            updated_at INTEGER, \
            UNIQUE (group_id, user_id)\
        );\
        CREATE TABLE IF NOT EXISTS group_invites (\
            id TEXT PRIMARY KEY, \
            group_id TEXT NOT NULL, \
            code TEXT NOT NULL UNIQUE, \
            created_by TEXT NOT NULL, \
            expires_at INTEGER NOT NULL, \
            is_active INTEGER NOT NULL DEFAULT 1, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS direct_connections (\
            id TEXT PRIMARY KEY, \
            requester_id TEXT NOT NULL, \
            recipient_id TEXT NOT NULL, \
            status TEXT NOT NULL CHECK(status IN ('PENDING', 'ACTIVE', 'DECLINED')), \
            requester_grants_write INTEGER NOT NULL DEFAULT 0, \
            recipient_grants_write INTEGER NOT NULL DEFAULT 0, \
            accepted_at INTEGER, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS workout_logs (\
            id TEXT PRIMARY KEY, \
            user_id TEXT, \
            title TEXT, \
            started_at INTEGER NOT NULL, \
            completed_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS logged_activity_groups (\
            id TEXT PRIMARY KEY, \
            workout_log_id TEXT NOT NULL\
        );";

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory pool");

        for stmt in SHARING_DDL.split(';') {
            let trimmed = stmt.trim();
            if !trimmed.is_empty() {
                sqlx::query(trimmed)
                    .execute(&pool)
                    .await
                    .unwrap_or_else(|e| panic!("DDL failed: {e}\nSQL: {trimmed}"));
            }
        }

        pool
    }

    /// Seeds a group with the given user as owner/coach and returns the group row.
    async fn seed_group(pool: &SqlitePool, user_id: &str) -> AccountabilityGroupRow {
        create_group_inner(
            pool,
            "Test Group".into(),
            Some("A test group".into()),
            None,
            user_id.into(),
        )
        .await
        .expect("seed group")
    }

    /// Seeds an invite for a group and returns the invite row.
    async fn seed_invite(pool: &SqlitePool, group_id: &str, user_id: &str) -> GroupInviteRow {
        create_invite_inner(pool, group_id.into(), user_id.into())
            .await
            .expect("seed invite")
    }

    /// Seeds a pending connection and returns the row.
    async fn seed_pending_connection(
        pool: &SqlitePool,
        requester: &str,
        recipient: &str,
    ) -> DirectConnectionRow {
        request_connection_inner(pool, requester.into(), recipient.into())
            .await
            .expect("seed connection")
    }

    // -----------------------------------------------------------------------
    // create_group
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_group_returns_group_with_coach_member() {
        let pool = setup_test_db().await;

        let group = create_group_inner(
            &pool,
            "Iron Brotherhood".into(),
            Some("Lift heavy".into()),
            Some(60),
            "user-a".into(),
        )
        .await
        .unwrap();

        assert_eq!(group.name, "Iron Brotherhood");
        assert_eq!(group.description, Some("Lift heavy".into()));
        assert_eq!(group.data_retention_days, 60);
        assert_eq!(group.user_id, "user-a");
        assert_eq!(group.created_by, "user-a");

        // Verify creator was added as COACH
        let members = get_group_members_inner(&pool, group.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].role, "COACH");
        assert_eq!(members[0].user_id, "user-a");
    }

    #[tokio::test]
    async fn create_group_uses_default_retention() {
        let pool = setup_test_db().await;

        let group = seed_group(&pool, "user-a").await;

        assert_eq!(group.data_retention_days, 30);
    }

    // -----------------------------------------------------------------------
    // get_groups / get_group
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_groups_returns_user_groups() {
        let pool = setup_test_db().await;
        seed_group(&pool, "user-a").await;
        seed_group(&pool, "user-b").await;

        let groups = get_groups_inner(&pool, "user-a".into()).await.unwrap();
        assert_eq!(groups.len(), 1);
    }

    #[tokio::test]
    async fn get_group_returns_some_for_existing() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        let result = get_group_inner(&pool, group.id.clone()).await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().id, group.id);
    }

    #[tokio::test]
    async fn get_group_returns_none_for_missing() {
        let pool = setup_test_db().await;

        let result = get_group_inner(&pool, "nonexistent".into()).await.unwrap();
        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // update_group
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_group_changes_name_and_description() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        let updated = update_group_inner(
            &pool,
            group.id.clone(),
            Some("Renamed".into()),
            Some("New desc".into()),
            Some(90),
        )
        .await
        .unwrap();

        assert_eq!(updated.name, "Renamed");
        assert_eq!(updated.description, Some("New desc".into()));
        assert_eq!(updated.data_retention_days, 90);
    }

    #[tokio::test]
    async fn update_group_not_found() {
        let pool = setup_test_db().await;

        let err = update_group_inner(&pool, "nonexistent".into(), None, None, None)
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // delete_group
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn delete_group_removes_group() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        delete_group_inner(&pool, group.id.clone(), "user-a".into())
            .await
            .unwrap();

        let result = get_group_inner(&pool, group.id).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn delete_group_rejects_non_owner() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        let err = delete_group_inner(&pool, group.id, "user-b".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Only the group owner"));
    }

    // -----------------------------------------------------------------------
    // get_group_members / remove_group_member
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_group_members_returns_members() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        let members = get_group_members_inner(&pool, group.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].user_id, "user-a");
    }

    #[tokio::test]
    async fn remove_group_member_self_removal() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        // Add a second member directly via invite flow
        let invite = seed_invite(&pool, &group.id, "user-a").await;
        join_group_by_code_inner(&pool, invite.code, "user-b".into())
            .await
            .unwrap();

        // user-b removes themselves
        remove_group_member_inner(&pool, group.id.clone(), "user-b".into(), "user-b".into())
            .await
            .unwrap();

        let members = get_group_members_inner(&pool, group.id).await.unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].user_id, "user-a");
    }

    #[tokio::test]
    async fn remove_group_member_rejects_non_coach() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        // Add user-b as a member
        let invite = seed_invite(&pool, &group.id, "user-a").await;
        join_group_by_code_inner(&pool, invite.code, "user-b".into())
            .await
            .unwrap();

        // user-b (MEMBER) tries to remove user-a
        let err = remove_group_member_inner(&pool, group.id, "user-a".into(), "user-b".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Only coaches"));
    }

    // -----------------------------------------------------------------------
    // update_member_role
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_member_role_promotes_to_coach() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        // Add user-b
        let invite = seed_invite(&pool, &group.id, "user-a").await;
        join_group_by_code_inner(&pool, invite.code, "user-b".into())
            .await
            .unwrap();

        let updated = update_member_role_inner(
            &pool,
            group.id,
            "user-b".into(),
            "COACH".into(),
            "user-a".into(),
        )
        .await
        .unwrap();

        assert_eq!(updated.role, "COACH");
    }

    #[tokio::test]
    async fn update_member_role_rejects_self_promotion() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        // Add user-b
        let invite = seed_invite(&pool, &group.id, "user-a").await;
        join_group_by_code_inner(&pool, invite.code, "user-b".into())
            .await
            .unwrap();

        let err = update_member_role_inner(
            &pool,
            group.id,
            "user-b".into(),
            "COACH".into(),
            "user-b".into(),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Cannot promote yourself"));
    }

    #[tokio::test]
    async fn update_member_role_rejects_invalid_role() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        let err = update_member_role_inner(
            &pool,
            group.id,
            "user-a".into(),
            "ADMIN".into(),
            "user-a".into(),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Role must be COACH or MEMBER"));
    }

    // -----------------------------------------------------------------------
    // create_invite / get_group_invites / revoke_invite
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_invite_generates_af_code() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        let invite = create_invite_inner(&pool, group.id.clone(), "user-a".into())
            .await
            .unwrap();

        assert!(invite.code.starts_with("AF-"));
        assert_eq!(invite.code.len(), 11); // "AF-" + 8 chars
        assert_eq!(invite.is_active, 1);
        assert!(invite.expires_at > 0);
    }

    #[tokio::test]
    async fn get_group_invites_lists_active_only() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;

        // Create two invites, revoke one
        let inv1 = seed_invite(&pool, &group.id, "user-a").await;
        seed_invite(&pool, &group.id, "user-a").await;

        revoke_invite_inner(&pool, inv1.id, "user-a".into())
            .await
            .unwrap();

        let invites = get_group_invites_inner(&pool, group.id).await.unwrap();
        assert_eq!(invites.len(), 1);
    }

    #[tokio::test]
    async fn revoke_invite_rejects_non_coach() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;
        let invite = seed_invite(&pool, &group.id, "user-a").await;

        // user-b is not a member at all
        let err = revoke_invite_inner(&pool, invite.id, "user-b".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Only coaches"));
    }

    // -----------------------------------------------------------------------
    // join_group_by_code
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn join_group_by_code_adds_member() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;
        let invite = seed_invite(&pool, &group.id, "user-a").await;

        let member = join_group_by_code_inner(&pool, invite.code, "user-b".into())
            .await
            .unwrap();

        assert_eq!(member.role, "MEMBER");
        assert_eq!(member.user_id, "user-b");
        assert_eq!(member.share_history_before_join, 0);
    }

    #[tokio::test]
    async fn join_group_by_code_rejects_duplicate_member() {
        let pool = setup_test_db().await;
        let group = seed_group(&pool, "user-a").await;
        let invite = seed_invite(&pool, &group.id, "user-a").await;

        // user-a is already a member (coach)
        let err = join_group_by_code_inner(&pool, invite.code, "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("already a member"));
    }

    #[tokio::test]
    async fn join_group_by_code_rejects_invalid_code() {
        let pool = setup_test_db().await;

        let err = join_group_by_code_inner(&pool, "AF-INVALID".into(), "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Invalid or expired"));
    }

    // -----------------------------------------------------------------------
    // request_connection
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn request_connection_creates_pending() {
        let pool = setup_test_db().await;

        let conn = request_connection_inner(&pool, "user-a".into(), "user-b".into())
            .await
            .unwrap();

        assert_eq!(conn.status, "PENDING");
        assert_eq!(conn.requester_id, "user-a");
        assert_eq!(conn.recipient_id, "user-b");
        assert_eq!(conn.requester_grants_write, 0);
        assert_eq!(conn.recipient_grants_write, 0);
    }

    #[tokio::test]
    async fn request_connection_rejects_self_connection() {
        let pool = setup_test_db().await;

        let err = request_connection_inner(&pool, "user-a".into(), "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Cannot connect with yourself"));
    }

    #[tokio::test]
    async fn request_connection_rejects_duplicate() {
        let pool = setup_test_db().await;

        request_connection_inner(&pool, "user-a".into(), "user-b".into())
            .await
            .unwrap();

        // Same direction
        let err = request_connection_inner(&pool, "user-a".into(), "user-b".into())
            .await
            .unwrap_err();
        assert!(err.message.contains("already exists"));

        // Reverse direction
        let err = request_connection_inner(&pool, "user-b".into(), "user-a".into())
            .await
            .unwrap_err();
        assert!(err.message.contains("already exists"));
    }

    // -----------------------------------------------------------------------
    // accept_connection / decline_connection
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn accept_connection_sets_active() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let accepted = accept_connection_inner(&pool, conn.id, "user-b".into())
            .await
            .unwrap();

        assert_eq!(accepted.status, "ACTIVE");
        assert!(accepted.accepted_at.is_some());
    }

    #[tokio::test]
    async fn accept_connection_rejects_non_recipient() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let err = accept_connection_inner(&pool, conn.id, "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Only the recipient"));
    }

    #[tokio::test]
    async fn decline_connection_sets_declined() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let declined = decline_connection_inner(&pool, conn.id, "user-b".into())
            .await
            .unwrap();

        assert_eq!(declined.status, "DECLINED");
    }

    // -----------------------------------------------------------------------
    // get_connections / get_pending_connections
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_connections_returns_active_only() {
        let pool = setup_test_db().await;

        // Create and accept one connection
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;
        accept_connection_inner(&pool, conn.id, "user-b".into())
            .await
            .unwrap();

        // Create another connection (stays pending)
        seed_pending_connection(&pool, "user-a", "user-c").await;

        let active = get_connections_inner(&pool, "user-a".into()).await.unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].status, "ACTIVE");

        let pending = get_pending_connections_inner(&pool, "user-a".into())
            .await
            .unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].status, "PENDING");
    }

    // -----------------------------------------------------------------------
    // remove_connection
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn remove_connection_deletes_connection() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        remove_connection_inner(&pool, conn.id.clone(), "user-a".into())
            .await
            .unwrap();

        let pending = get_pending_connections_inner(&pool, "user-a".into())
            .await
            .unwrap();
        assert!(pending.is_empty());
    }

    #[tokio::test]
    async fn remove_connection_rejects_non_participant() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let err = remove_connection_inner(&pool, conn.id, "user-c".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("Only connection participants"));
    }

    // -----------------------------------------------------------------------
    // update_connection_write_access
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_write_access_for_requester() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let updated = update_connection_write_access_inner(&pool, conn.id, "user-a".into(), true)
            .await
            .unwrap();

        assert_eq!(updated.requester_grants_write, 1);
        assert_eq!(updated.recipient_grants_write, 0);
    }

    #[tokio::test]
    async fn update_write_access_for_recipient() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let updated = update_connection_write_access_inner(&pool, conn.id, "user-b".into(), true)
            .await
            .unwrap();

        assert_eq!(updated.requester_grants_write, 0);
        assert_eq!(updated.recipient_grants_write, 1);
    }

    #[tokio::test]
    async fn update_write_access_rejects_non_participant() {
        let pool = setup_test_db().await;
        let conn = seed_pending_connection(&pool, "user-a", "user-b").await;

        let err = update_connection_write_access_inner(&pool, conn.id, "user-c".into(), true)
            .await
            .unwrap_err();

        assert!(err.message.contains("Only connection participants"));
    }
}
