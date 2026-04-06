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
    "BARBELL",
    "DUMBBELL",
    "KETTLEBELL",
    "BODYWEIGHT",
    "MACHINE",
    "CABLE",
    "CARDIO",
    "PLYOMETRIC",
    "LOADED_CARRY",
];

const VALID_MOVEMENT_PATTERNS: &[&str] = &[
    "SQUAT",
    "HINGE",
    "LUNGE",
    "PUSH",
    "PULL",
    "CARRY",
    "ROTATION",
    "FLEXION",
    "EXTENSION",
    "ISOMETRIC",
];

#[tauri::command]
pub async fn get_exercises(
    pool: State<'_, SqlitePool>,
    filters: Option<ExerciseFilters>,
) -> Result<Vec<ExerciseRow>, AppError> {
    get_exercises_inner(pool.inner(), filters).await
}

pub(crate) async fn get_exercises_inner(
    pool: &SqlitePool,
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

    let rows = query.fetch_all(pool).await?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_exercise(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<ExerciseRow>, AppError> {
    get_exercise_inner(pool.inner(), id).await
}

pub(crate) async fn get_exercise_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<ExerciseRow>, AppError> {
    let row = sqlx::query_as::<_, ExerciseRow>("SELECT * FROM exercises WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await?;

    Ok(row)
}

#[tauri::command]
pub async fn create_exercise(
    pool: State<'_, SqlitePool>,
    exercise: CreateExerciseInput,
) -> Result<ExerciseRow, AppError> {
    create_exercise_inner(pool.inner(), exercise).await
}

pub(crate) async fn create_exercise_inner(
    pool: &SqlitePool,
    exercise: CreateExerciseInput,
) -> Result<ExerciseRow, AppError> {
    // Input validation
    if exercise.name.trim().is_empty() || exercise.name.len() > 100 {
        return Err(AppError::validation(
            "name",
            "Exercise name must be 1-100 characters",
        ));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorKind;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS exercises (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                aliases TEXT,
                category TEXT NOT NULL,
                movement_pattern TEXT,
                muscle_groups TEXT,
                is_bilateral INTEGER,
                supports_1rm INTEGER,
                equipment_required TEXT,
                is_custom INTEGER DEFAULT 0,
                created_at INTEGER,
                updated_at INTEGER
            )",
        )
        .execute(&pool)
        .await
        .expect("ddl");
        pool
    }

    fn valid_input(name: &str) -> CreateExerciseInput {
        CreateExerciseInput {
            name: name.to_string(),
            aliases: None,
            category: "BARBELL".to_string(),
            movement_pattern: Some("SQUAT".to_string()),
            muscle_groups: None,
            is_bilateral: Some(true),
            supports_1rm: Some(true),
            equipment_required: None,
        }
    }

    #[tokio::test]
    async fn get_exercises_returns_empty_for_no_data() {
        let pool = setup_test_db().await;
        let result = get_exercises_inner(&pool, None).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn create_and_get_exercise() {
        let pool = setup_test_db().await;
        let created = create_exercise_inner(&pool, valid_input("Back Squat"))
            .await
            .unwrap();
        assert_eq!(created.name, "Back Squat");
        assert_eq!(created.category, "BARBELL");
        assert_eq!(created.is_custom, Some(1));

        let fetched = get_exercise_inner(&pool, created.id.clone()).await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().name, "Back Squat");
    }

    #[tokio::test]
    async fn get_exercise_returns_none_for_missing_id() {
        let pool = setup_test_db().await;
        let result = get_exercise_inner(&pool, "nonexistent".into())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn create_exercise_rejects_empty_name() {
        let pool = setup_test_db().await;
        let err = create_exercise_inner(&pool, valid_input("   "))
            .await
            .unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Validation));
        assert_eq!(err.field.as_deref(), Some("name"));
    }

    #[tokio::test]
    async fn create_exercise_rejects_invalid_category() {
        let pool = setup_test_db().await;
        let mut input = valid_input("Bench Press");
        input.category = "INVALID".to_string();
        let err = create_exercise_inner(&pool, input).await.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Validation));
        assert_eq!(err.field.as_deref(), Some("category"));
    }

    #[tokio::test]
    async fn create_exercise_rejects_invalid_movement_pattern() {
        let pool = setup_test_db().await;
        let mut input = valid_input("Deadlift");
        input.movement_pattern = Some("INVALID".to_string());
        let err = create_exercise_inner(&pool, input).await.unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Validation));
        assert_eq!(err.field.as_deref(), Some("movement_pattern"));
    }

    #[tokio::test]
    async fn get_exercises_filters_by_category() {
        let pool = setup_test_db().await;
        create_exercise_inner(&pool, valid_input("Back Squat"))
            .await
            .unwrap();

        let mut bw_input = valid_input("Push-Up");
        bw_input.category = "BODYWEIGHT".to_string();
        create_exercise_inner(&pool, bw_input).await.unwrap();

        let filters = Some(ExerciseFilters {
            category: Some("BODYWEIGHT".to_string()),
            movement_pattern: None,
            search: None,
            is_custom: None,
        });
        let result = get_exercises_inner(&pool, filters).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Push-Up");
    }

    #[tokio::test]
    async fn get_exercises_filters_by_search() {
        let pool = setup_test_db().await;
        create_exercise_inner(&pool, valid_input("Back Squat"))
            .await
            .unwrap();
        create_exercise_inner(&pool, valid_input("Front Squat"))
            .await
            .unwrap();
        create_exercise_inner(&pool, valid_input("Bench Press"))
            .await
            .unwrap();

        let filters = Some(ExerciseFilters {
            category: None,
            movement_pattern: None,
            search: Some("Squat".to_string()),
            is_custom: None,
        });
        let result = get_exercises_inner(&pool, filters).await.unwrap();
        assert_eq!(result.len(), 2);
    }
}
