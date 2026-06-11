use std::cmp::Ordering;

pub(crate) fn top_doc_ids(scores: Vec<(u64, f64)>, limit: usize) -> Vec<u64> {
    let mut entries = sorted_score_entries(scores);
    entries.truncate(limit);
    entries.into_iter().map(|(doc_id, _score)| doc_id).collect()
}

pub(crate) fn sorted_score_entries(mut entries: Vec<(u64, f64)>) -> Vec<(u64, f64)> {
    entries.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.0.cmp(&right.0))
    });
    entries
}

pub(crate) fn top_doc_ids_from_sorted(entries: &[(u64, f64)], limit: usize) -> Vec<u64> {
    entries
        .iter()
        .take(limit)
        .map(|(doc_id, _score)| *doc_id)
        .collect()
}

pub(crate) fn score_entries_to_f64(entries: &[(u64, f64)]) -> Vec<f64> {
    let mut output = Vec::with_capacity(entries.len() * 2);
    for (doc_id, score) in entries {
        output.push(*doc_id as f64);
        output.push(*score);
    }
    output
}
