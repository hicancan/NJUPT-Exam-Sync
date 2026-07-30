use crate::analysis::normalize_text;

pub fn build_snippet(content: &str, title: &str, query: &str, matched_terms: &[String]) -> String {
    let source = if content.trim().is_empty() {
        title
    } else {
        content
    };
    let source_chars: Vec<char> = source.chars().collect();
    if source_chars.len() <= 180 {
        return source.trim().to_string();
    }

    let normalized = normalize_text(source);
    let mut needles = vec![normalize_text(query)];
    needles.extend(matched_terms.iter().map(|term| normalize_text(term)));
    let byte_position = needles
        .iter()
        .filter(|term| term.chars().count() >= 2)
        .find_map(|term| normalized.find(term));
    let char_position = byte_position
        .map(|byte| normalized[..byte].chars().count())
        .unwrap_or(0);
    let start = char_position.saturating_sub(45);
    let end = (start + 180).min(source_chars.len());
    let mut snippet: String = source_chars[start..end].iter().collect();
    snippet = snippet.trim().to_string();
    if start > 0 {
        snippet.insert(0, '…');
    }
    if end < source_chars.len() {
        snippet.push('…');
    }
    snippet
}
