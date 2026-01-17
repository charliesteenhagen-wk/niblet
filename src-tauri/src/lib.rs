mod clipboard;
mod history;
mod hotkey;
mod storage;
mod updater;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State,
};

use clipboard::{calculate_text_stats, transform_text, TextStats, TextTransform};
use history::{
    add_entry, cleanup_old_entries, clear_history, delete_entry, export_history, get_entries,
    get_stats, init_database, search_entries, HistoryEntry, HistoryStats,
};
use hotkey::{get_default_hotkey, validate_hotkey};
use storage::{
    load_settings, load_snippets, save_settings, save_snippets, AppSettings, Snippet, SnippetsData,
};
use updater::{check_for_updates, UpdateInfo};

pub struct AppState {
    db: Mutex<Connection>,
    #[cfg(target_os = "macos")]
    previous_app: Mutex<Option<String>>,
}

// Settings commands
#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    load_settings().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_settings(settings: AppSettings) -> Result<(), String> {
    save_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_default_hotkey_cmd() -> String {
    get_default_hotkey()
}

#[tauri::command]
fn validate_hotkey_cmd(shortcut: String) -> bool {
    validate_hotkey(&shortcut)
}

// History commands
#[tauri::command]
fn add_history_entry(
    state: State<AppState>,
    content: String,
    language: Option<String>,
    tags: Option<String>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    add_entry(&conn, &content, language.as_deref(), tags.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_history(state: State<AppState>, limit: u32, offset: u32) -> Result<Vec<HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_entries(&conn, limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_history(state: State<AppState>, query: String, limit: u32) -> Result<Vec<HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    search_entries(&conn, &query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_history_entry(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    delete_entry(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_all_history(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    clear_history(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_history_stats(state: State<AppState>) -> Result<HistoryStats, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn cleanup_history(state: State<AppState>, max_entries: u32) -> Result<u32, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cleanup_old_entries(&conn, max_entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_all_history(state: State<AppState>) -> Result<Vec<HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    export_history(&conn).map_err(|e| e.to_string())
}

// Snippets commands
#[tauri::command]
fn get_snippets() -> Result<SnippetsData, String> {
    load_snippets().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_snippets_data(data: SnippetsData) -> Result<(), String> {
    save_snippets(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_snippet(
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<Snippet, String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let snippet = Snippet {
        id: uuid_v4(),
        name,
        content,
        tags,
        created_at: now.clone(),
        updated_at: now,
    };
    data.snippets.push(snippet.clone());
    save_snippets(&data).map_err(|e| e.to_string())?;
    Ok(snippet)
}

#[tauri::command]
fn update_snippet(
    id: String,
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    if let Some(snippet) = data.snippets.iter_mut().find(|s| s.id == id) {
        snippet.name = name;
        snippet.content = content;
        snippet.tags = tags;
        snippet.updated_at = chrono::Utc::now().to_rfc3339();
    }
    save_snippets(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_snippet(id: String) -> Result<(), String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    data.snippets.retain(|s| s.id != id);
    save_snippets(&data).map_err(|e| e.to_string())
}

// Text utility commands
#[tauri::command]
fn get_text_stats(text: String) -> TextStats {
    calculate_text_stats(&text)
}

#[tauri::command]
fn transform_text_cmd(text: String, transform: String) -> Result<String, String> {
    let transform_type = match transform.as_str() {
        "uppercase" => TextTransform::Uppercase,
        "lowercase" => TextTransform::Lowercase,
        "titlecase" => TextTransform::TitleCase,
        "sentencecase" => TextTransform::SentenceCase,
        "trim" => TextTransform::TrimWhitespace,
        "sort" => TextTransform::SortLines,
        "deduplicate" => TextTransform::RemoveDuplicateLines,
        "reverse" => TextTransform::ReverseLines,
        _ => return Err(format!("Unknown transform: {}", transform)),
    };
    Ok(transform_text(&text, transform_type))
}

#[tauri::command]
fn count_pattern_occurrences(text: String, pattern: String) -> usize {
    clipboard::count_occurrences(&text, &pattern)
}

// Update commands
#[tauri::command]
async fn check_for_app_updates() -> Result<UpdateInfo, String> {
    check_for_updates().await
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Window commands
#[tauri::command]
async fn show_window(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    log::info!("show_window called");

    // On macOS, remember the current frontmost app before showing Niblet
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg(r#"tell application "System Events" to get name of first process whose frontmost is true"#)
            .output()
            .ok();

        if let Some(o) = output {
            if let Ok(app_name) = String::from_utf8(o.stdout) {
                let app_name = app_name.trim().to_string();
                log::info!("Previous app detected: {}", app_name);
                if !app_name.is_empty() && app_name != "Niblet" {
                    *state.previous_app.lock().unwrap() = Some(app_name.clone());
                    log::info!("Stored previous app: {}", app_name);
                }
            }
        }
    }

    // Position window on the monitor where the cursor is
    #[cfg(target_os = "macos")]
    {
        use core_graphics::event::CGEvent;
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
        use tauri::PhysicalPosition;

        // Get cursor position using CoreGraphics
        if let Ok(source) = CGEventSource::new(CGEventSourceStateID::HIDSystemState) {
            if let Ok(event) = CGEvent::new(source) {
                let cursor_pos = event.location();
                log::info!("Cursor position: ({}, {})", cursor_pos.x, cursor_pos.y);

                // Get all monitors and find which one contains the cursor
                if let Ok(monitors) = window.available_monitors() {
                    for monitor in monitors {
                        let pos = monitor.position();
                        let size = monitor.size();

                        // Check if cursor is within this monitor's bounds
                        let in_x = cursor_pos.x >= pos.x as f64
                            && cursor_pos.x < (pos.x + size.width as i32) as f64;
                        let in_y = cursor_pos.y >= pos.y as f64
                            && cursor_pos.y < (pos.y + size.height as i32) as f64;

                        if in_x && in_y {
                            log::info!("Found active monitor: {:?}", monitor.name());

                            // Get window size
                            if let Ok(win_size) = window.outer_size() {
                                // Calculate center position on this monitor
                                let center_x = pos.x + (size.width as i32 - win_size.width as i32) / 2;
                                let center_y = pos.y + (size.height as i32 - win_size.height as i32) / 2;

                                log::info!("Centering window at ({}, {})", center_x, center_y);
                                let _ = window.set_position(PhysicalPosition::new(center_x, center_y));
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // On non-macOS, just center on primary monitor
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.center();
    }

    log::info!("Showing window...");
    window.show().map_err(|e| {
        log::error!("Failed to show window: {}", e);
        e.to_string()
    })?;

    // On macOS, set window level high enough to appear over full-screen apps
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
        use cocoa::base::id;

        if let Ok(ns_window) = window.ns_window() {
            let ns_window = ns_window as id;
            unsafe {
                // Set window level to appear over full-screen apps
                // NSScreenSaverWindowLevel = 1000, but we use a slightly lower value
                // to avoid interfering with actual screen savers
                const NS_POP_UP_MENU_WINDOW_LEVEL: i64 = 101;
                ns_window.setLevel_(NS_POP_UP_MENU_WINDOW_LEVEL);

                // Allow window to appear on all spaces including full-screen spaces
                let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary;
                ns_window.setCollectionBehavior_(behavior);

                log::info!("Set window level to {} with full-screen overlay behavior", NS_POP_UP_MENU_WINDOW_LEVEL);
            }
        }
    }

    log::info!("Setting focus...");
    window.set_focus().map_err(|e| {
        log::error!("Failed to set focus: {}", e);
        e.to_string()
    })?;

    log::info!("show_window completed successfully");
    Ok(())
}

#[tauri::command]
async fn hide_window(window: tauri::Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
async fn hide_and_paste(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    // Get the stored previous app
    #[cfg(target_os = "macos")]
    let previous_app: Option<String> = state.previous_app.lock().unwrap().clone();

    // Hide the window
    window.hide().map_err(|e| e.to_string())?;

    // On macOS, activate the previous app
    #[cfg(target_os = "macos")]
    {
        if let Some(app_name) = previous_app {
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(50));

                // Activate the previous app
                let script = format!(
                    r#"tell application "{}" to activate"#,
                    app_name
                );

                let _ = std::process::Command::new("osascript")
                    .arg("-e")
                    .arg(&script)
                    .output();
            });
        }
    }

    Ok(())
}

// Simple UUID v4 generator
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = duration.as_nanos();
    let pid = std::process::id() as u64;

    // Generate two pseudo-random u64 values
    let r1: u64 = (nanos as u64).wrapping_mul(0x517cc1b727220a95).wrapping_add(pid);
    let r2: u64 = ((nanos >> 64) as u64).wrapping_mul(0x2545F4914F6CDD1D).wrapping_add(pid.wrapping_mul(0x9E3779B97F4A7C15));

    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (r1 >> 32) as u32,
        (r1 >> 16) as u16 & 0xFFFF,
        r1 as u16 & 0x0FFF,
        ((r2 >> 48) as u16 & 0x3FFF) | 0x8000,
        r2 & 0xFFFFFFFFFFFF
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let db = init_database().expect("Failed to initialize database");
    #[cfg(target_os = "macos")]
    let app_state = AppState {
        db: Mutex::new(db),
        previous_app: Mutex::new(None),
    };
    #[cfg(not(target_os = "macos"))]
    let app_state = AppState { db: Mutex::new(db) };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            // Settings
            get_settings,
            update_settings,
            get_default_hotkey_cmd,
            validate_hotkey_cmd,
            // History
            add_history_entry,
            get_history,
            search_history,
            delete_history_entry,
            clear_all_history,
            get_history_stats,
            cleanup_history,
            export_all_history,
            // Snippets
            get_snippets,
            save_snippets_data,
            add_snippet,
            update_snippet,
            delete_snippet,
            // Text utilities
            get_text_stats,
            transform_text_cmd,
            count_pattern_occurrences,
            // Window
            show_window,
            hide_window,
            hide_and_paste,
            // Updates
            check_for_app_updates,
            get_app_version,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Center the window on startup
            window.center().ok();

            // Hide dock icon on macOS (make it a menubar-only app)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Create system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Niblet", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Niblet", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            // Build tray icon - menu shows on left-click
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                            }
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                window.show().ok();
                                window.set_focus().ok();
                                window.emit("open-settings", ()).ok();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
