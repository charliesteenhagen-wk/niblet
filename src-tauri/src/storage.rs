use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Failed to get app data directory")]
    NoAppDataDir,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Default for WindowPosition {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 650,
            height: 450,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub hotkey: String,
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub opacity: f32,
    pub tab_size: u32,
    pub line_wrap: bool,
    pub line_numbers: bool,
    pub show_status_bar: bool,
    pub max_history_entries: u32,
    pub auto_save_drafts: bool,
    pub launch_at_login: bool,
    pub default_language: String,
    pub window_position: WindowPosition,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hotkey: if cfg!(target_os = "macos") {
                "Command+Shift+Space".to_string()
            } else {
                "Control+Shift+Space".to_string()
            },
            theme: "dark".to_string(),
            font_family: "JetBrains Mono, Menlo, Monaco, Consolas, monospace".to_string(),
            font_size: 14,
            opacity: 0.95,
            tab_size: 4,
            line_wrap: true,
            line_numbers: false,
            show_status_bar: true,
            max_history_entries: 100,
            auto_save_drafts: true,
            launch_at_login: false,
            default_language: "plaintext".to_string(),
            window_position: WindowPosition::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub name: String,
    pub content: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SnippetsData {
    pub snippets: Vec<Snippet>,
}

pub fn get_app_data_dir() -> Result<PathBuf, StorageError> {
    dirs::data_dir()
        .map(|p| p.join("Niblet"))
        .ok_or(StorageError::NoAppDataDir)
}

pub fn ensure_app_data_dir() -> Result<PathBuf, StorageError> {
    let dir = get_app_data_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn load_settings() -> Result<AppSettings, StorageError> {
    let dir = ensure_app_data_dir()?;
    let path = dir.join("settings.json");

    if path.exists() {
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    } else {
        let settings = AppSettings::default();
        save_settings(&settings)?;
        Ok(settings)
    }
}

pub fn save_settings(settings: &AppSettings) -> Result<(), StorageError> {
    let dir = ensure_app_data_dir()?;
    let path = dir.join("settings.json");
    let content = serde_json::to_string_pretty(settings)?;
    fs::write(path, content)?;
    Ok(())
}

pub fn load_snippets() -> Result<SnippetsData, StorageError> {
    let dir = ensure_app_data_dir()?;
    let path = dir.join("snippets.json");

    if path.exists() {
        let content = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&content)?)
    } else {
        let data = SnippetsData::default();
        save_snippets(&data)?;
        Ok(data)
    }
}

pub fn save_snippets(data: &SnippetsData) -> Result<(), StorageError> {
    let dir = ensure_app_data_dir()?;
    let path = dir.join("snippets.json");
    let content = serde_json::to_string_pretty(data)?;
    fs::write(path, content)?;
    Ok(())
}
