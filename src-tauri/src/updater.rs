use serde::{Deserialize, Serialize};

const GITHUB_REPO: &str = "csteamengine/niblet";
const GITHUB_API_URL: &str = "https://api.github.com/repos";

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_url: String,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn parse_version(version: &str) -> Option<(u32, u32, u32)> {
    let v = version.trim_start_matches('v');
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() >= 3 {
        let major = parts[0].parse().ok()?;
        let minor = parts[1].parse().ok()?;
        let patch = parts[2].split('-').next()?.parse().ok()?;
        Some((major, minor, patch))
    } else {
        None
    }
}

fn is_newer_version(current: &str, latest: &str) -> bool {
    match (parse_version(current), parse_version(latest)) {
        (Some((c_maj, c_min, c_patch)), Some((l_maj, l_min, l_patch))) => {
            (l_maj, l_min, l_patch) > (c_maj, c_min, c_patch)
        }
        _ => false,
    }
}

fn get_platform_download_url(assets: &[GitHubAsset]) -> Option<String> {
    let pattern = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "_aarch64.dmg"
        } else {
            "_x64.dmg"
        }
    } else if cfg!(target_os = "windows") {
        "_x64-setup.exe"
    } else {
        "_amd64.deb"
    };

    assets
        .iter()
        .find(|a| a.name.ends_with(pattern))
        .map(|a| a.browser_download_url.clone())
}

pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let url = format!("{}/{}/releases/latest", GITHUB_API_URL, GITHUB_REPO);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Niblet-App")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API returned status: {}", response.status()));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    let current_version = get_current_version();
    let latest_version = release.tag_name.clone();
    let has_update = is_newer_version(&current_version, &latest_version);
    let download_url = get_platform_download_url(&release.assets);

    Ok(UpdateInfo {
        current_version,
        latest_version,
        has_update,
        release_url: release.html_url,
        release_notes: release.body,
        download_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_parsing() {
        assert_eq!(parse_version("0.1.1"), Some((0, 1, 1)));
        assert_eq!(parse_version("v0.1.1"), Some((0, 1, 1)));
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("v1.0.0-beta"), Some((1, 0, 0)));
    }

    #[test]
    fn test_version_comparison() {
        assert!(is_newer_version("0.1.0", "0.1.1"));
        assert!(is_newer_version("0.1.1", "0.2.0"));
        assert!(is_newer_version("0.1.1", "1.0.0"));
        assert!(!is_newer_version("0.1.1", "0.1.1"));
        assert!(!is_newer_version("0.1.2", "0.1.1"));
    }
}
