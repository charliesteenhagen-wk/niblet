use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

use crate::storage::get_app_data_dir;

#[derive(Error, Debug)]
pub enum HistoryError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub content: String,
    pub created_at: String,
    pub character_count: i32,
    pub word_count: i32,
    pub line_count: i32,
    pub language: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryStats {
    pub total_entries: i32,
    pub total_characters: i64,
    pub total_words: i64,
}

pub fn get_db_path() -> Result<PathBuf, HistoryError> {
    let dir = get_app_data_dir()?;
    Ok(dir.join("history.db"))
}

pub fn init_database() -> Result<Connection, HistoryError> {
    let path = get_db_path()?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(&path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            character_count INTEGER,
            word_count INTEGER,
            line_count INTEGER,
            language TEXT,
            tags TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_created_at ON history(created_at DESC)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tags ON history(tags)",
        [],
    )?;

    Ok(conn)
}

pub fn add_entry(
    conn: &Connection,
    content: &str,
    language: Option<&str>,
    tags: Option<&str>,
) -> Result<i64, HistoryError> {
    let character_count = content.chars().count() as i32;
    let word_count = content.split_whitespace().count() as i32;
    let line_count = content.lines().count() as i32;

    conn.execute(
        "INSERT INTO history (content, character_count, word_count, line_count, language, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![content, character_count, word_count, line_count, language, tags],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn get_entries(
    conn: &Connection,
    limit: u32,
    offset: u32,
) -> Result<Vec<HistoryEntry>, HistoryError> {
    let mut stmt = conn.prepare(
        "SELECT id, content, created_at, character_count, word_count, line_count, language, tags
         FROM history
         ORDER BY created_at DESC
         LIMIT ?1 OFFSET ?2",
    )?;

    let entries = stmt
        .query_map(rusqlite::params![limit, offset], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                character_count: row.get(3)?,
                word_count: row.get(4)?,
                line_count: row.get(5)?,
                language: row.get(6)?,
                tags: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

pub fn search_entries(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<HistoryEntry>, HistoryError> {
    let search_pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, content, created_at, character_count, word_count, line_count, language, tags
         FROM history
         WHERE content LIKE ?1 OR tags LIKE ?1
         ORDER BY created_at DESC
         LIMIT ?2",
    )?;

    let entries = stmt
        .query_map(rusqlite::params![search_pattern, limit], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                character_count: row.get(3)?,
                word_count: row.get(4)?,
                line_count: row.get(5)?,
                language: row.get(6)?,
                tags: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(entries)
}

pub fn delete_entry(conn: &Connection, id: i64) -> Result<(), HistoryError> {
    conn.execute("DELETE FROM history WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

pub fn clear_history(conn: &Connection) -> Result<(), HistoryError> {
    conn.execute("DELETE FROM history", [])?;
    Ok(())
}

pub fn get_stats(conn: &Connection) -> Result<HistoryStats, HistoryError> {
    let mut stmt = conn.prepare(
        "SELECT COUNT(*), COALESCE(SUM(character_count), 0), COALESCE(SUM(word_count), 0) FROM history",
    )?;

    let stats = stmt.query_row([], |row| {
        Ok(HistoryStats {
            total_entries: row.get(0)?,
            total_characters: row.get(1)?,
            total_words: row.get(2)?,
        })
    })?;

    Ok(stats)
}

pub fn cleanup_old_entries(conn: &Connection, max_entries: u32) -> Result<u32, HistoryError> {
    let result = conn.execute(
        "DELETE FROM history WHERE id NOT IN (
            SELECT id FROM history ORDER BY created_at DESC LIMIT ?1
        )",
        rusqlite::params![max_entries],
    )?;

    Ok(result as u32)
}

pub fn export_history(conn: &Connection) -> Result<Vec<HistoryEntry>, HistoryError> {
    get_entries(conn, u32::MAX, 0)
}
