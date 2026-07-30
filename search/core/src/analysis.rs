use std::collections::BTreeSet;
use unicode_normalization::UnicodeNormalization;

pub fn normalize_text(value: &str) -> String {
    let normalized: String = value.nfkc().flat_map(char::to_lowercase).collect();
    normalized.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_cjk(character: char) -> bool {
    matches!(
        character as u32,
        0x3400..=0x4DBF
            | 0x4E00..=0x9FFF
            | 0xF900..=0xFAFF
            | 0x20000..=0x2FA1F
    )
}

fn flush_ascii(buffer: &mut String, tokens: &mut BTreeSet<String>) {
    if buffer.len() >= 2 {
        tokens.insert(std::mem::take(buffer));
    } else {
        buffer.clear();
    }
}

fn flush_cjk(buffer: &mut Vec<char>, max_n: usize, tokens: &mut BTreeSet<String>) {
    if buffer.len() < 2 {
        buffer.clear();
        return;
    }
    let upper = max_n.min(buffer.len());
    for width in 2..=upper {
        for start in 0..=buffer.len() - width {
            tokens.insert(buffer[start..start + width].iter().collect());
        }
    }
    buffer.clear();
}

pub fn tokens(value: &str, max_cjk_n: usize) -> Vec<String> {
    let normalized = normalize_text(value);
    let mut tokens = BTreeSet::new();
    let mut ascii = String::new();
    let mut cjk = Vec::new();
    for character in normalized.chars() {
        if is_cjk(character) {
            flush_ascii(&mut ascii, &mut tokens);
            cjk.push(character);
        } else if character.is_alphanumeric() {
            flush_cjk(&mut cjk, max_cjk_n, &mut tokens);
            ascii.push(character);
        } else {
            flush_ascii(&mut ascii, &mut tokens);
            flush_cjk(&mut cjk, max_cjk_n, &mut tokens);
        }
    }
    flush_ascii(&mut ascii, &mut tokens);
    flush_cjk(&mut cjk, max_cjk_n, &mut tokens);
    if normalized.chars().count() >= 2 && normalized.chars().count() <= 32 {
        tokens.insert(normalized);
    }
    tokens.into_iter().collect()
}

pub fn token_weight(token: &str) -> f32 {
    let length = token.chars().count().clamp(1, 8) as f32;
    length * length
}

#[cfg(test)]
mod tests {
    use super::{normalize_text, tokens};

    #[test]
    fn normalizes_and_builds_cjk_ngrams() {
        assert_eq!(normalize_text("  转专业\n通知  "), "转专业 通知");
        let values = tokens("转专业", 4);
        assert!(values.contains(&"转专业".to_string()));
        assert!(values.contains(&"转专".to_string()));
        assert!(values.contains(&"专业".to_string()));
    }
}
