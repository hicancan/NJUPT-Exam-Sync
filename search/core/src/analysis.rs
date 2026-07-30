use unicode_normalization::UnicodeNormalization;

pub fn normalize_text(value: &str) -> String {
    normalize_with_mapping(value).text
}

pub(crate) struct NormalizedText {
    pub text: String,
    pub original_char_positions: Vec<usize>,
}

pub(crate) fn normalize_with_mapping(value: &str) -> NormalizedText {
    let mut text = String::new();
    let mut original_char_positions = Vec::new();
    let mut pending_space: Option<usize> = None;
    for (original_index, character) in value.chars().enumerate() {
        let normalized: String = character
            .to_string()
            .nfkc()
            .flat_map(char::to_lowercase)
            .collect();
        for normalized_character in normalized.chars() {
            if normalized_character.is_whitespace() {
                pending_space.get_or_insert(original_index);
                continue;
            }
            if !text.is_empty() {
                if let Some(space_index) = pending_space.take() {
                    text.push(' ');
                    original_char_positions.push(space_index);
                }
            } else {
                pending_space = None;
            }
            text.push(normalized_character);
            original_char_positions.push(original_index);
        }
    }
    NormalizedText {
        text,
        original_char_positions,
    }
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

fn flush_ascii(buffer: &mut String, tokens: &mut Vec<String>) {
    if buffer.len() >= 2 {
        tokens.push(std::mem::take(buffer));
    } else {
        buffer.clear();
    }
}

fn flush_cjk(buffer: &mut Vec<char>, max_n: usize, tokens: &mut Vec<String>) {
    if buffer.len() < 2 {
        buffer.clear();
        return;
    }
    let upper = max_n.min(buffer.len());
    for width in 2..=upper {
        for start in 0..=buffer.len() - width {
            tokens.push(buffer[start..start + width].iter().collect());
        }
    }
    buffer.clear();
}

fn analyzed_tokens(value: &str, max_cjk_n: usize) -> Vec<String> {
    let normalized = normalize_text(value);
    let mut tokens = Vec::new();
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
        if !tokens.iter().any(|token| token == &normalized) {
            tokens.push(normalized);
        }
    }
    tokens
}

pub fn analyze_query(value: &str, max_cjk_n: usize) -> Vec<String> {
    analyzed_tokens(value, max_cjk_n)
        .into_iter()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect()
}

pub fn analyze_document(value: &str, max_cjk_n: usize) -> Vec<String> {
    analyzed_tokens(value, max_cjk_n)
}

pub fn token_weight(token: &str) -> f32 {
    let length = token.chars().count().clamp(1, 8) as f32;
    length * length
}

#[cfg(test)]
mod tests {
    use super::{analyze_document, analyze_query, normalize_text};

    #[test]
    fn normalizes_and_builds_cjk_ngrams() {
        assert_eq!(normalize_text("  转专业\n通知  "), "转专业 通知");
        let values = analyze_query("转专业", 4);
        assert!(values.contains(&"转专业".to_string()));
        assert!(values.contains(&"转专".to_string()));
        assert!(values.contains(&"专业".to_string()));
    }

    #[test]
    fn document_analysis_keeps_repeated_terms_while_query_analysis_deduplicates() {
        assert_eq!(
            analyze_document("奖学金 奖学金", 4)
                .iter()
                .filter(|term| term.as_str() == "奖学金")
                .count(),
            2
        );
        assert_eq!(
            analyze_query("奖学金 奖学金", 4)
                .iter()
                .filter(|term| term.as_str() == "奖学金")
                .count(),
            1
        );
    }
}
