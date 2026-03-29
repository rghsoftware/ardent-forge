mod commands;
mod db;
mod error;
mod models;
pub mod notification;
pub mod rest_timer;
pub mod session_reminder;
pub mod sync;
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
      app.handle().plugin(tauri_plugin_notification::init())?;
      app.handle().plugin(tauri_plugin_deep_link::init())?;

      // Initialize the SQLite database and store the pool in managed state
      let pool = tauri::async_runtime::block_on(db::init_db(app))
          .unwrap_or_else(|e| panic!("Failed to initialize database: {e}"));
      let sync_engine = sync::SyncEngine::new(pool.clone(), app.handle().clone());
      app.manage(pool);
      app.manage(rest_timer::RestTimerState::new());
      app.manage(session_reminder::SessionReminderState::new());
      app.manage(sync_engine);

      notification::register_channels(&app.handle());

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // App config
      commands::app_config::get_app_config,
      commands::app_config::set_app_config,
      commands::app_config::clear_app_config,
      commands::app_config::wipe_synced_data,
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
      // Session templates
      commands::session_templates::get_session_templates,
      commands::session_templates::get_session_template,
      commands::session_templates::get_session_template_full,
      commands::session_templates::create_session_template_full,
      commands::session_templates::update_session_template_full,
      commands::session_templates::delete_session_template,
      // Programs
      commands::programs::get_programs,
      commands::programs::get_program_full,
      commands::programs::create_program_full,
      commands::programs::update_program_full,
      commands::programs::delete_program,
      commands::programs::get_active_program,
      commands::programs::set_active_program,
      commands::programs::clear_active_program,
      // User profile
      commands::user_profile::get_user_profile,
      commands::user_profile::update_user_profile,
      commands::user_profile::save_one_rep_max,
      commands::user_profile::get_one_rep_max_history,
      // Rest timer
      commands::rest_timer::start_rest_timer,
      commands::rest_timer::skip_rest_timer,
      commands::rest_timer::adjust_rest_timer,
      // Guest migration
      commands::guest::migrate_guest_data,
      // Sync
      commands::sync::sync_set_auth,
      commands::sync::sync_clear_auth,
      commands::sync::sync_force_push,
      commands::sync::sync_force_pull,
      commands::sync::sync_get_status,
      // Notifications
      commands::notification::schedule_session_reminder,
      commands::notification::cancel_session_reminder,
    ])
    .run(tauri::generate_context!())
    .unwrap_or_else(|e| panic!("Tauri application error: {e}"));
}
