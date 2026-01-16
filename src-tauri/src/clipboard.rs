use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextStats {
    pub character_count: usize,
    pub word_count: usize,
    pub line_count: usize,
    pub paragraph_count: usize,
}

pub fn calculate_text_stats(text: &str) -> TextStats {
    let character_count = text.chars().count();
    let word_count = text.split_whitespace().count();
    let line_count = if text.is_empty() {
        0
    } else {
        text.lines().count()
    };

    // Count paragraphs (separated by blank lines)
    let paragraph_count = text
        .split("\n\n")
        .filter(|p| !p.trim().is_empty())
        .count();

    TextStats {
        character_count,
        word_count,
        line_count,
        paragraph_count,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TextTransform {
    Uppercase,
    Lowercase,
    TitleCase,
    SentenceCase,
    TrimWhitespace,
    SortLines,
    RemoveDuplicateLines,
    ReverseLines,
}

pub fn transform_text(text: &str, transform: TextTransform) -> String {
    match transform {
        TextTransform::Uppercase => text.to_uppercase(),
        TextTransform::Lowercase => text.to_lowercase(),
        TextTransform::TitleCase => to_title_case(text),
        TextTransform::SentenceCase => to_sentence_case(text),
        TextTransform::TrimWhitespace => text
            .lines()
            .map(|line| line.trim())
            .collect::<Vec<_>>()
            .join("\n"),
        TextTransform::SortLines => {
            let mut lines: Vec<&str> = text.lines().collect();
            lines.sort();
            lines.join("\n")
        }
        TextTransform::RemoveDuplicateLines => {
            let mut seen = std::collections::HashSet::new();
            text.lines()
                .filter(|line| seen.insert(*line))
                .collect::<Vec<_>>()
                .join("\n")
        }
        TextTransform::ReverseLines => {
            let lines: Vec<&str> = text.lines().collect();
            lines.into_iter().rev().collect::<Vec<_>>().join("\n")
        }
    }
}

fn to_title_case(text: &str) -> String {
    text.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str().to_lowercase().as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn to_sentence_case(text: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = true;

    for c in text.chars() {
        if capitalize_next && c.is_alphabetic() {
            result.push_str(&c.to_uppercase().to_string());
            capitalize_next = false;
        } else {
            result.push(c.to_lowercase().next().unwrap_or(c));
        }

        if c == '.' || c == '!' || c == '?' {
            capitalize_next = true;
        }
    }

    result
}

pub fn count_occurrences(text: &str, pattern: &str) -> usize {
    if pattern.is_empty() {
        return 0;
    }
    text.matches(pattern).count()
}
