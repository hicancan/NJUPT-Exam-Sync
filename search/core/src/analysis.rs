use unicode_normalization::UnicodeNormalization;

#[derive(Clone, Debug)]
pub(crate) struct PhraseGroup {
    pub phrase: String,
    pub title_terms: Vec<String>,
    pub body_terms: Vec<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct QueryAnalysis {
    pub normalized: String,
    pub retrieval_terms: Vec<String>,
    pub phrase_groups: Vec<PhraseGroup>,
    pub preferred_sources: &'static [&'static str],
}

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

fn coverage_terms(value: &str, width: usize) -> Vec<String> {
    let tokens = analyze_query(value, width);
    let longest = tokens
        .iter()
        .map(|token| token.chars().count().min(width))
        .max()
        .unwrap_or(0);
    tokens
        .into_iter()
        .filter(|token| token.chars().count() == longest && token.chars().count() <= width)
        .collect()
}

fn alias_profile(normalized: &str) -> Option<(&'static [&'static str], &'static [&'static str])> {
    match normalized {
        "大创" => Some((
            &["大学生创新创业训练计划", "大学生创新训练计划"],
            &["cxcy", "jwc"],
        )),
        "四六级" | "四、六级" => Some((
            &[
                "全国大学英语四六级考试",
                "全国大学英语四六级口语考试",
                "全国大学英语四、六级考试",
                "大学英语四六级考试",
                "大学英语四六级口语考试",
                "大学英语四、六级考试",
                "四六级考试",
                "cet-4",
                "cet-6",
            ],
            &["jwc"],
        )),
        "计算机等级" | "计算机等级考试" => Some((
            &[
                "全国计算机等级考试",
                "江苏省高等学校计算机等级考试",
                "计算机等级考试",
            ],
            &["jwc"],
        )),
        _ => None,
    }
}

pub(crate) fn analyze_search_query(value: &str) -> QueryAnalysis {
    let normalized = normalize_text(value);
    let profile = alias_profile(&normalized);
    let phrases: Vec<String> = profile
        .map(|(values, _)| values.iter().map(|value| normalize_text(value)).collect())
        .unwrap_or_else(|| vec![normalized.clone()]);
    let mut retrieval_terms = analyze_query(&normalized, 4);
    for phrase in &phrases {
        retrieval_terms.extend(coverage_terms(phrase, 4));
    }
    retrieval_terms.sort();
    retrieval_terms.dedup();
    QueryAnalysis {
        normalized,
        retrieval_terms,
        phrase_groups: phrases
            .into_iter()
            .map(|phrase| PhraseGroup {
                title_terms: coverage_terms(&phrase, 4),
                body_terms: coverage_terms(&phrase, 2),
                phrase,
            })
            .collect(),
        preferred_sources: profile.map(|(_, sources)| sources).unwrap_or(&[]),
    }
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
    use super::{analyze_document, analyze_query, analyze_search_query, normalize_text};

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

    #[test]
    fn expands_product_aliases_without_precomputing_results() {
        let analysis = analyze_search_query("大创");
        assert!(analysis
            .phrase_groups
            .iter()
            .any(|group| group.phrase == "大学生创新创业训练计划"));
        assert!(analysis.retrieval_terms.contains(&"创新创业".to_string()));
    }
}
