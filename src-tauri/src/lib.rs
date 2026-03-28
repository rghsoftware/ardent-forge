mod commands;
mod db;
mod error;
mod models;
mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let log_level = if cfg!(debug_assertions) {
          log::LevelFilter::Info
      } else {
          log::LevelFilter::Warn
      };
      app.handle().plugin(
          tauri_plugin_log::Builder::default()
              .level(log_level)
              .build(),
      )?;

      // Initialize the SQLite database and store the pool in managed state
      let pool = tauri::async_runtime::block_on(db::init_db(app))
          .unwrap_or_else(|e| panic!("Failed to initialize database: {e}"));
      app.manage(pool);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // Exercises
      commands::exercises::get_exercises,
      commands::exercises::get_exercise,
      commands::exercises::create_exercise,
      // Workout logs
      commands::workout_logs::get_workout_logs,
      commands::workout_logs::get_workout_logs_summary,
      commands::workout_logs::get_workout_log,
      commands::workout_logs::get_workout_log_full,
      commands::workout_logs::create_workout_log,
      commands::workout_logs::update_workout_log,
      commands::workout_logs::delete_workout_log,
      commands::workout_logs::create_logged_activity_group,
      commands::workout_logs::create_logged_activity,
      commands::workout_logs::create_logged_set,
      commands::workout_logs::update_logged_set,
      commands::workout_logs::get_recently_used_exercise_ids,
      commands::workout_logs::get_exercise_workout_history,
      commands::workout_logs::create_workout_log_full,
      // User profile
      commands::user_profile::get_user_profile,
      commands::user_profile::update_user_profile,
      commands::user_profile::save_one_rep_max,
      commands::user_profile::get_one_rep_max_history,
    ])
    .run(tauri::generate_context!())
    .unwrap_or_else(|e| panic!("Tauri application error: {e}"));
}
