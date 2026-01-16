use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub key: String,
    pub modifiers: Vec<String>,
}

impl HotkeyConfig {
    pub fn from_shortcut_string(shortcut: &str) -> Self {
        let parts: Vec<&str> = shortcut.split('+').collect();
        let key = parts.last().unwrap_or(&"Space").to_string();
        let modifiers: Vec<String> = parts[..parts.len().saturating_sub(1)]
            .iter()
            .map(|s| s.to_string())
            .collect();

        Self { key, modifiers }
    }

    pub fn to_shortcut_string(&self) -> String {
        let mut parts = self.modifiers.clone();
        parts.push(self.key.clone());
        parts.join("+")
    }
}

pub fn get_default_hotkey() -> String {
    if cfg!(target_os = "macos") {
        "Command+Shift+Space".to_string()
    } else {
        "Control+Shift+Space".to_string()
    }
}

pub fn validate_hotkey(shortcut: &str) -> bool {
    let parts: Vec<&str> = shortcut.split('+').collect();

    if parts.is_empty() {
        return false;
    }

    let valid_modifiers = [
        "Command", "Cmd", "Control", "Ctrl", "Alt", "Option", "Shift", "Super", "Meta",
    ];

    let valid_keys = [
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
        "S", "T", "U", "V", "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Space",
        "Enter", "Tab", "Escape", "Backspace", "Delete", "Insert", "Home", "End", "PageUp",
        "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Grave", "Minus", "Equal",
        "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period",
        "Slash",
    ];

    // Check that the last part is a valid key
    let key = parts.last().unwrap();
    if !valid_keys.iter().any(|k| k.eq_ignore_ascii_case(key)) {
        return false;
    }

    // Check that all other parts are valid modifiers
    for part in &parts[..parts.len() - 1] {
        if !valid_modifiers.iter().any(|m| m.eq_ignore_ascii_case(part)) {
            return false;
        }
    }

    // Must have at least one modifier
    parts.len() > 1
}
