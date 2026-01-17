use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: i64,
    pub content: String,
    pub content_type: String, // "text", "image", etc.
    pub created_at: String,
    pub preview: String, // First 100 chars for display
    pub char_count: i32,
}

/// Initialize the clipboard_history table in the database
pub fn init_clipboard_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS clipboard_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            content_type TEXT DEFAULT 'text',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            char_count INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_clipboard_created_at ON clipboard_history(created_at DESC)",
        [],
    )?;

    Ok(())
}

/// Add a new clipboard entry, avoiding duplicates of the most recent entry
pub fn add_clipboard_entry(
    conn: &Connection,
    content: &str,
    content_type: &str,
) -> Result<Option<i64>, rusqlite::Error> {
    // Skip empty content
    if content.trim().is_empty() {
        return Ok(None);
    }

    // Check if the most recent entry has the same content (avoid duplicates)
    let mut stmt = conn.prepare(
        "SELECT content FROM clipboard_history ORDER BY created_at DESC LIMIT 1",
    )?;

    let last_content: Option<String> = stmt
        .query_row([], |row| row.get(0))
        .ok();

    if let Some(last) = last_content {
        if last == content {
            return Ok(None); // Skip duplicate
        }
    }

    let char_count = content.chars().count() as i32;

    conn.execute(
        "INSERT INTO clipboard_history (content, content_type, char_count)
         VALUES (?1, ?2, ?3)",
        rusqlite::params![content, content_type, char_count],
    )?;

    Ok(Some(conn.last_insert_rowid()))
}

/// Get clipboard history entries
pub fn get_clipboard_entries(
    conn: &Connection,
    limit: u32,
) -> Result<Vec<ClipboardEntry>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, content, content_type, created_at, char_count
         FROM clipboard_history
         ORDER BY created_at DESC
         LIMIT ?1",
    )?;

    let entries = stmt
        .query_map(rusqlite::params![limit], |row| {
            let content: String = row.get(1)?;
            let preview = create_preview(&content, 100);
            Ok(ClipboardEntry {
                id: row.get(0)?,
                content,
                content_type: row.get(2)?,
                created_at: row.get(3)?,
                preview,
                char_count: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

/// Search clipboard history
pub fn search_clipboard_entries(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<ClipboardEntry>, rusqlite::Error> {
    let search_pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, content, content_type, created_at, char_count
         FROM clipboard_history
         WHERE content LIKE ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;

    let entries = stmt
        .query_map(rusqlite::params![search_pattern, limit], |row| {
            let content: String = row.get(1)?;
            let preview = create_preview(&content, 100);
            Ok(ClipboardEntry {
                id: row.get(0)?,
                content,
                content_type: row.get(2)?,
                created_at: row.get(3)?,
                preview,
                char_count: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

/// Delete a clipboard entry
pub fn delete_clipboard_entry(conn: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM clipboard_history WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

/// Clear all clipboard history
pub fn clear_clipboard_history(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM clipboard_history", [])?;
    Ok(())
}

/// Cleanup old entries, keeping only the most recent N entries
pub fn cleanup_clipboard_history(conn: &Connection, max_entries: u32) -> Result<u32, rusqlite::Error> {
    let result = conn.execute(
        "DELETE FROM clipboard_history WHERE id NOT IN (
            SELECT id FROM clipboard_history ORDER BY created_at DESC LIMIT ?1
        )",
        rusqlite::params![max_entries],
    )?;
    Ok(result as u32)
}

/// Create a preview string from content
fn create_preview(content: &str, max_len: usize) -> String {
    let single_line = content
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    if single_line.chars().count() <= max_len {
        single_line
    } else {
        format!("{}...", single_line.chars().take(max_len - 3).collect::<String>())
    }
}

/// Clipboard monitor state
pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
    last_content: Arc<Mutex<String>>,
}

impl ClipboardMonitor {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            last_content: Arc::new(Mutex::new(String::new())),
        }
    }

    /// Start monitoring the clipboard in the background
    pub fn start<F>(&self, on_new_content: F)
    where
        F: Fn(String) + Send + 'static,
    {
        if self.running.swap(true, Ordering::SeqCst) {
            // Already running
            return;
        }

        let running = self.running.clone();
        let last_content = self.last_content.clone();

        async_runtime::spawn(async move {
            while running.load(Ordering::SeqCst) {
                // Read clipboard using tauri's clipboard plugin
                if let Ok(content) = read_system_clipboard().await {
                    let mut last = last_content.lock().unwrap();
                    if !content.is_empty() && content != *last {
                        *last = content.clone();
                        drop(last); // Release lock before callback
                        on_new_content(content);
                    }
                }

                // Check every 500ms
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        });
    }

    /// Stop monitoring
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Check if monitor is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

/// Read clipboard content from system
async fn read_system_clipboard() -> Result<String, String> {
    // Use macOS pbpaste for clipboard reading
    #[cfg(target_os = "macos")]
    {
        let output = tokio::process::Command::new("pbpaste")
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            String::from_utf8(output.stdout).map_err(|e| e.to_string())
        } else {
            Err("Failed to read clipboard".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // For other platforms, we'd need platform-specific implementations
        Err("Clipboard monitoring not supported on this platform".to_string())
    }
}
