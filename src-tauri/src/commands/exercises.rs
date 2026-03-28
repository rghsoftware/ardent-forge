use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::ExerciseRow;
use crate::utils::now_unix;

#[derive(serde::Deserialize)]
pub struct ExerciseFilters {
    pub category: Option<String>,
    pub movement_pattern: Option<String>,
    pub search: Option<String>,
    pub is_custom: Option<bool>,
}

#[derive(serde::Deserialize)]
pub struct CreateExerciseInput {
    pub name: String,
    pub aliases: Option<String>,
    pub category: String,
    pub movement_pattern: Option<String>,
    pub muscle_groups: Option<String>,
    pub is_bilateral: Option<bool>,
    pub supports_1rm: Option<bool>,
    pub equipment_required: Option<String>,
}

const VALID_CATEGORIES: &[&str] = &[
    "BARBELL", "DUMBBELL", "KETTLEBELL", "BODYWEIGHT", "MACHINE",
    "CABLE", "CARDIO", "PLYOMETRIC", "LOADED_CARRY",
];

const VALID_MOVEMENT_PATTERNS: &[&str] = &[
    "SQUAT", "HINGE", "LUNGE", "PUSH", "PULL",
    "CARRY", "ROTATION", "FLEXION", "EXTENSION", "ISOMETRIC",
];

#[tauri::command]
pub async fn get_exercises(
    pool: State<'_, SqlitePool>,
    filters: Option<ExerciseFilters>,
) -> Result<Vec<ExerciseRow>, AppError> {
    let mut sql = String::from("SELECT * FROM exercises WHERE 1=1");
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref f) = filters {
        if let Some(ref cat) = f.category {
            sql.push_str(" AND category = ?");
            bind_values.push(cat.clone());
        }
        if let Some(ref mp) = f.movement_pattern {
            sql.push_str(" AND movement_pattern = ?");
            bind_values.push(mp.clone());
        }
        if let Some(ref search) = f.search {
            sql.push_str(" AND (name LIKE ? OR aliases LIKE ?)");
            let pattern = format!("%{search}%");
            bind_values.push(pattern.clone());
            bind_values.push(pattern);
        }
        if let Some(is_custom) = f.is_custom {
            sql.push_str(" AND is_custom = ?");
            bind_values.push(if is_custom { "1".into() } else { "0".into() });
        }
    }

    sql.push_str(" ORDER BY name");

    let mut query = sqlx::query_as::<_, ExerciseRow>(&sql);
    for val in &bind_values {
        query = query.bind(val);
    }

    let rows = query.fetch_all(pool.inner()).await?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_exercise(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<ExerciseRow>, AppError> {
    let row = sqlx::query_as::<_, ExerciseRow>("SELECT * FROM exercises WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await?;

    Ok(row)
}

#[tauri::command]
pub async fn create_exercise(
    pool: State<'_, SqlitePool>,
    exercise: CreateExerciseInput,
) -> Result<ExerciseRow, AppError> {
    // Input validation
    if exercise.name.trim().is_empty() || exercise.name.len() > 100 {
        return Err(AppError::validation("name", "Exercise name must be 1-100 characters"));
    }
    if !VALID_CATEGORIES.contains(&exercise.category.as_str()) {
        return Err(AppError::validation(
            "category",
            &format!("Invalid category: {}", exercise.category),
        ));
    }
    if let Some(ref mp) = exercise.movement_pattern {
        if !VALID_MOVEMENT_PATTERNS.contains(&mp.as_str()) {
            return Err(AppError::validation(
                "movement_pattern",
                &format!("Invalid movement pattern: {mp}"),
            ));
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let is_bilateral = exercise.is_bilateral.map(|b| if b { 1i32 } else { 0 });
    let supports_1rm = exercise.supports_1rm.map(|b| if b { 1i32 } else { 0 });

    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, \
         is_bilateral, supports_1rm, equipment_required, is_custom, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&exercise.name)
    .bind(&exercise.aliases)
    .bind(&exercise.category)
    .bind(&exercise.movement_pattern)
    .bind(&exercise.muscle_groups)
    .bind(is_bilateral)
    .bind(supports_1rm)
    .bind(&exercise.equipment_required)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, ExerciseRow>("SELECT * FROM exercises WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(row)
}
