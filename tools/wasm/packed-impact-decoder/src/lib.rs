use std::collections::{HashMap, HashSet};
use std::str;
use wasm_bindgen::prelude::*;

mod dense_scores;
mod packed_format;
mod score_entries;
use dense_scores::DenseScores;
use packed_format::{Cursor, PackedFormat, Stats};
use score_entries::{score_entries_to_f64, sorted_score_entries, top_doc_ids};

struct ImpactBlock {
    key: String,
    impact: f64,
    ids: Vec<u64>,
}

struct ApplyStats {
    impact_blocks_visited: u64,
    impact_blocks_pruned: u64,
    postings_visited: u64,
    postings_pruned: u64,
    competitive_threshold: f64,
}

fn json_string(value: &str) -> Result<String, JsValue> {
    serde_json::to_string(value).map_err(|error| JsValue::from_str(&error.to_string()))
}

fn metadata_prefix(metadata: &str) -> Result<String, JsValue> {
    let trimmed = metadata.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Err(JsValue::from_str("metadata is not a JSON object"));
    }
    Ok(trimmed[..trimmed.len() - 1].to_string())
}

fn append_fields_json(cursor: &mut Cursor<'_>, output: &mut String) -> Result<Stats, JsValue> {
    let field_count = cursor.read_varint()?;
    let mut stats = Stats {
        field_count,
        posting_count: 0,
        max_doc_id: 0,
    };
    for field_index in 0..field_count {
        if field_index > 0 {
            output.push(',');
        }
        let field = (cursor.read_byte()? as char).to_string();
        output.push_str(&json_string(&field)?);
        output.push_str(":[");

        let doc_count = cursor.read_varint()?;
        stats.posting_count += doc_count;
        let mut previous = 0_u64;
        for doc_offset in 0..doc_count {
            if doc_offset > 0 {
                output.push(',');
            }
            let delta = cursor.read_varint()?;
            let doc_id = if doc_offset == 0 {
                delta
            } else {
                previous
                    .checked_add(delta)
                    .ok_or_else(|| JsValue::from_str("doc id overflow"))?
            };
            output.push_str(&doc_id.to_string());
            stats.max_doc_id = stats.max_doc_id.max(doc_id);
            previous = doc_id;
        }
        output.push(']');
    }
    Ok(stats)
}

fn scan_fields(cursor: &mut Cursor<'_>) -> Result<Stats, JsValue> {
    let field_count = cursor.read_varint()?;
    let mut stats = Stats {
        field_count,
        posting_count: 0,
        max_doc_id: 0,
    };
    for _ in 0..field_count {
        cursor.read_byte()?;
        let doc_count = cursor.read_varint()?;
        stats.posting_count += doc_count;
        let mut previous = 0_u64;
        for doc_offset in 0..doc_count {
            let delta = cursor.read_varint()?;
            let doc_id = if doc_offset == 0 {
                delta
            } else {
                previous
                    .checked_add(delta)
                    .ok_or_else(|| JsValue::from_str("doc id overflow"))?
            };
            stats.max_doc_id = stats.max_doc_id.max(doc_id);
            previous = doc_id;
        }
    }
    Ok(stats)
}

fn collect_fields(cursor: &mut Cursor<'_>) -> Result<HashMap<String, Vec<u64>>, JsValue> {
    let field_count = cursor.read_varint()?;
    let mut fields = HashMap::new();
    for _ in 0..field_count {
        let field = (cursor.read_byte()? as char).to_string();
        let doc_count = cursor.read_varint()?;
        let mut doc_ids = Vec::with_capacity(doc_count as usize);
        let mut previous = 0_u64;
        for doc_offset in 0..doc_count {
            let delta = cursor.read_varint()?;
            let doc_id = if doc_offset == 0 {
                delta
            } else {
                previous
                    .checked_add(delta)
                    .ok_or_else(|| JsValue::from_str("doc id overflow"))?
            };
            doc_ids.push(doc_id);
            previous = doc_id;
        }
        fields.insert(field, doc_ids);
    }
    Ok(fields)
}

fn read_directory(cursor: &mut Cursor<'_>) -> Result<Vec<(String, usize)>, JsValue> {
    let term_count = cursor.read_varint()?;
    let mut directory = Vec::with_capacity(term_count as usize);
    let mut payload_total = 0_usize;
    for _ in 0..term_count {
        let term_length = cursor.read_varint()? as usize;
        let term = str::from_utf8(cursor.read_bytes(term_length)?)
            .map_err(|error| JsValue::from_str(&error.to_string()))?
            .to_string();
        let payload_length = cursor.read_varint()? as usize;
        payload_total = payload_total
            .checked_add(payload_length)
            .ok_or_else(|| JsValue::from_str("payload length overflow"))?;
        directory.push((term, payload_length));
    }
    if cursor.offset + payload_total != cursor.data.len() {
        return Err(JsValue::from_str(
            "packed impact payload directory length mismatch",
        ));
    }
    Ok(directory)
}

fn field_impacts_from_metadata(metadata: &str) -> Result<(HashMap<String, f64>, usize), JsValue> {
    let value: serde_json::Value =
        serde_json::from_str(metadata).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let mut impacts = HashMap::new();
    if let Some(object) = value.get("field_impacts").and_then(|item| item.as_object()) {
        for (field, impact) in object {
            impacts.insert(field.to_string(), impact.as_f64().unwrap_or(8.0));
        }
    }
    let block_size = value
        .get("block_size")
        .and_then(|item| item.as_u64())
        .unwrap_or(32)
        .max(8) as usize;
    Ok((impacts, block_size))
}

fn term_impact(term: &str, field: &str, field_impacts: &HashMap<String, f64>) -> f64 {
    field_impacts.get(field).copied().unwrap_or(8.0) + (term.chars().count().min(8) as f64)
}

fn push_term_blocks(
    blocks: &mut Vec<ImpactBlock>,
    term: &str,
    fields: HashMap<String, Vec<u64>>,
    block_size: usize,
    field_impacts: &HashMap<String, f64>,
) {
    for (field, ids) in fields {
        let impact = term_impact(term, &field, field_impacts);
        for chunk in ids.chunks(block_size) {
            blocks.push(ImpactBlock {
                key: format!("{term}\0{field}"),
                impact,
                ids: chunk.to_vec(),
            });
        }
    }
}

fn suffix_unique_impact(blocks: &[ImpactBlock]) -> Vec<f64> {
    let mut suffix = vec![0.0; blocks.len() + 1];
    let mut seen = HashSet::new();
    let mut total = 0.0;
    for index in (0..blocks.len()).rev() {
        if seen.insert(blocks[index].key.clone()) {
            total += blocks[index].impact;
        }
        suffix[index] = total;
    }
    suffix
}

fn collect_packed_impact_blocks(
    bytes: &[u8],
    query_terms_json: &str,
) -> Result<(Vec<ImpactBlock>, u64), JsValue> {
    let query_terms: Vec<String> = serde_json::from_str(query_terms_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let selected_terms: HashSet<&str> = query_terms.iter().map(String::as_str).collect();
    collect_packed_impact_blocks_for_terms(bytes, &selected_terms)
}

fn collect_query_terms_utf8<'a>(
    query_terms_utf8: &'a [u8],
    query_term_offsets: &[u32],
) -> Result<Vec<&'a str>, JsValue> {
    if query_term_offsets.len() % 2 != 0 {
        return Err(JsValue::from_str("query term offsets must contain start/end pairs"));
    }
    let mut terms = Vec::with_capacity(query_term_offsets.len() / 2);
    for pair in query_term_offsets.chunks(2) {
        let start = pair[0] as usize;
        let end = pair[1] as usize;
        if start > end || end > query_terms_utf8.len() {
            return Err(JsValue::from_str("query term offset is out of bounds"));
        }
        let term = str::from_utf8(&query_terms_utf8[start..end])
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        if !term.is_empty() {
            terms.push(term);
        }
    }
    Ok(terms)
}

fn collect_packed_impact_blocks_utf8(
    bytes: &[u8],
    query_terms_utf8: &[u8],
    query_term_offsets: &[u32],
) -> Result<(Vec<ImpactBlock>, u64), JsValue> {
    let query_terms = collect_query_terms_utf8(query_terms_utf8, query_term_offsets)?;
    let selected_terms: HashSet<&str> = query_terms.into_iter().collect();
    collect_packed_impact_blocks_for_terms(bytes, &selected_terms)
}

fn collect_packed_impact_blocks_for_terms(
    bytes: &[u8],
    selected_terms: &HashSet<&str>,
) -> Result<(Vec<ImpactBlock>, u64), JsValue> {
    let mut cursor = Cursor::new(bytes);
    let format = cursor.read_magic()?;
    let metadata_length = cursor.read_u32_le()? as usize;
    let metadata_bytes = cursor.read_bytes(metadata_length)?;
    let metadata =
        str::from_utf8(metadata_bytes).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let (field_impacts, block_size) = field_impacts_from_metadata(metadata)?;
    let mut blocks = Vec::new();
    let mut matched_term_count = 0_u64;

    match format {
        PackedFormat::V1 => {
            let term_count = cursor.read_varint()?;
            for _ in 0..term_count {
                let term_length = cursor.read_varint()? as usize;
                let term = str::from_utf8(cursor.read_bytes(term_length)?)
                    .map_err(|error| JsValue::from_str(&error.to_string()))?
                    .to_string();
                if selected_terms.contains(term.as_str()) {
                    matched_term_count += 1;
                    let fields = collect_fields(&mut cursor)?;
                    push_term_blocks(&mut blocks, &term, fields, block_size, &field_impacts);
                } else {
                    scan_fields(&mut cursor)?;
                }
            }
        }
        PackedFormat::V2 => {
            let directory = read_directory(&mut cursor)?;
            for (term, payload_length) in directory {
                let end = cursor.offset + payload_length;
                let mut payload_cursor = Cursor::new(&cursor.data[cursor.offset..end]);
                if selected_terms.contains(term.as_str()) {
                    matched_term_count += 1;
                    let fields = collect_fields(&mut payload_cursor)?;
                    push_term_blocks(&mut blocks, &term, fields, block_size, &field_impacts);
                    if !payload_cursor.is_done() {
                        return Err(JsValue::from_str(
                            "trailing bytes in packed impact term payload",
                        ));
                    }
                }
                cursor.offset = end;
            }
        }
    }

    if !cursor.is_done() {
        return Err(JsValue::from_str("trailing bytes in packed impact index"));
    }

    blocks.sort_by(|left, right| {
        right
            .impact
            .partial_cmp(&left.impact)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.key.cmp(&right.key))
    });
    Ok((blocks, matched_term_count))
}

fn apply_impact_blocks_to_scores(
    blocks: &[ImpactBlock],
    target_candidates: usize,
    scores: &mut DenseScores,
) -> Result<ApplyStats, JsValue> {
    let suffix = suffix_unique_impact(blocks);
    let mut impact_blocks_visited = 0_u64;
    let mut impact_blocks_pruned = 0_u64;
    let mut postings_visited = 0_u64;
    let mut postings_pruned = 0_u64;
    let mut competitive = f64::NEG_INFINITY;
    let target = target_candidates.max(1);

    for (index, block) in blocks.iter().enumerate() {
        if scores.len() >= target && (!competitive.is_finite() || index % 32 == 0) {
            competitive = scores.competitive_threshold(target);
        }
        let max_possible_for_unseen_doc =
            block.impact + suffix.get(index + 1).copied().unwrap_or(0.0);
        let has_known_candidate = block.ids.iter().any(|doc_id| scores.contains(*doc_id));
        if !has_known_candidate
            && scores.len() >= target
            && max_possible_for_unseen_doc <= competitive
        {
            impact_blocks_pruned += 1;
            postings_pruned += block.ids.len() as u64;
            continue;
        }
        impact_blocks_visited += 1;
        for doc_id in &block.ids {
            postings_visited += 1;
            scores.add(*doc_id, block.impact)?;
        }
    }

    Ok(ApplyStats {
        impact_blocks_visited,
        impact_blocks_pruned,
        postings_visited,
        postings_pruned,
        competitive_threshold: if competitive.is_finite() { competitive } else { 0.0 },
    })
}

#[wasm_bindgen]
pub struct PackedImpactRetrievalSession {
    target_candidates: usize,
    scores: DenseScores,
    matched_term_count: u64,
    block_count: usize,
    impact_blocks_visited: u64,
    impact_blocks_pruned: u64,
    postings_visited: u64,
    postings_pruned: u64,
    competitive_threshold: f64,
}

#[wasm_bindgen]
impl PackedImpactRetrievalSession {
    #[wasm_bindgen(constructor)]
    pub fn new(target_candidates: usize) -> PackedImpactRetrievalSession {
        PackedImpactRetrievalSession {
            target_candidates: target_candidates.max(1),
            scores: DenseScores::default(),
            matched_term_count: 0,
            block_count: 0,
            impact_blocks_visited: 0,
            impact_blocks_pruned: 0,
            postings_visited: 0,
            postings_pruned: 0,
            competitive_threshold: 0.0,
        }
    }

    pub fn apply(&mut self, bytes: &[u8], query_terms_json: &str) -> Result<String, JsValue> {
        let (blocks, matched_term_count) = collect_packed_impact_blocks(bytes, query_terms_json)?;
        let stats =
            apply_impact_blocks_to_scores(&blocks, self.target_candidates, &mut self.scores)?;
        self.matched_term_count += matched_term_count;
        self.block_count += blocks.len();
        self.impact_blocks_visited += stats.impact_blocks_visited;
        self.impact_blocks_pruned += stats.impact_blocks_pruned;
        self.postings_visited += stats.postings_visited;
        self.postings_pruned += stats.postings_pruned;
        self.competitive_threshold = stats.competitive_threshold;

        Ok(serde_json::json!({
            "matched_term_count": matched_term_count,
            "block_count": blocks.len(),
            "candidate_count": self.scores.len(),
            "impact_blocks_visited": stats.impact_blocks_visited,
            "impact_blocks_pruned": stats.impact_blocks_pruned,
            "postings_visited": stats.postings_visited,
            "postings_pruned": stats.postings_pruned,
            "competitive_threshold": stats.competitive_threshold,
        })
        .to_string())
    }

    pub fn apply_terms_utf8(
        &mut self,
        bytes: &[u8],
        query_terms_utf8: &[u8],
        query_term_offsets: &[u32],
    ) -> Result<String, JsValue> {
        let (blocks, matched_term_count) =
            collect_packed_impact_blocks_utf8(bytes, query_terms_utf8, query_term_offsets)?;
        let stats =
            apply_impact_blocks_to_scores(&blocks, self.target_candidates, &mut self.scores)?;
        self.matched_term_count += matched_term_count;
        self.block_count += blocks.len();
        self.impact_blocks_visited += stats.impact_blocks_visited;
        self.impact_blocks_pruned += stats.impact_blocks_pruned;
        self.postings_visited += stats.postings_visited;
        self.postings_pruned += stats.postings_pruned;
        self.competitive_threshold = stats.competitive_threshold;

        Ok(serde_json::json!({
            "matched_term_count": matched_term_count,
            "block_count": blocks.len(),
            "candidate_count": self.scores.len(),
            "impact_blocks_visited": stats.impact_blocks_visited,
            "impact_blocks_pruned": stats.impact_blocks_pruned,
            "postings_visited": stats.postings_visited,
            "postings_pruned": stats.postings_pruned,
            "competitive_threshold": stats.competitive_threshold,
        })
        .to_string())
    }

    pub fn stats_json(&self) -> String {
        serde_json::json!({
            "matched_term_count": self.matched_term_count,
            "block_count": self.block_count,
            "candidate_count": self.scores.len(),
            "impact_blocks_visited": self.impact_blocks_visited,
            "impact_blocks_pruned": self.impact_blocks_pruned,
            "postings_visited": self.postings_visited,
            "postings_pruned": self.postings_pruned,
            "competitive_threshold": self.competitive_threshold,
        })
        .to_string()
    }

    pub fn scores_json(&self) -> String {
        serde_json::json!({
            "candidate_count": self.scores.len(),
            "score_entries": sorted_score_entries(&self.scores.entries()),
        })
        .to_string()
    }

    pub fn score_entries_f64(&self) -> Vec<f64> {
        let entries = sorted_score_entries(&self.scores.entries());
        score_entries_to_f64(&entries)
    }
}

#[wasm_bindgen]
pub fn decode_packed_impact_to_json(bytes: &[u8]) -> Result<String, JsValue> {
    let mut cursor = Cursor::new(bytes);
    let format = cursor.read_magic()?;

    let metadata_length = cursor.read_u32_le()? as usize;
    let metadata_bytes = cursor.read_bytes(metadata_length)?;
    let metadata =
        str::from_utf8(metadata_bytes).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let mut output = metadata_prefix(metadata)?;
    if output.len() > 1 {
        output.push(',');
    }
    output.push_str("\"terms\":{");

    match format {
        PackedFormat::V1 => {
            let term_count = cursor.read_varint()?;
            for term_index in 0..term_count {
                if term_index > 0 {
                    output.push(',');
                }
                let term_length = cursor.read_varint()? as usize;
                let term = str::from_utf8(cursor.read_bytes(term_length)?)
                    .map_err(|error| JsValue::from_str(&error.to_string()))?;
                output.push_str(&json_string(term)?);
                output.push_str(":{");
                append_fields_json(&mut cursor, &mut output)?;
                output.push('}');
            }
        }
        PackedFormat::V2 => {
            let directory = read_directory(&mut cursor)?;
            for (term_index, (term, payload_length)) in directory.iter().enumerate() {
                if term_index > 0 {
                    output.push(',');
                }
                output.push_str(&json_string(term)?);
                output.push_str(":{");
                let end = cursor.offset + payload_length;
                let mut payload_cursor = Cursor::new(&cursor.data[cursor.offset..end]);
                append_fields_json(&mut payload_cursor, &mut output)?;
                if !payload_cursor.is_done() {
                    return Err(JsValue::from_str(
                        "trailing bytes in packed impact term payload",
                    ));
                }
                cursor.offset = end;
                output.push('}');
            }
        }
    }
    output.push_str("}}");

    if !cursor.is_done() {
        return Err(JsValue::from_str("trailing bytes in packed impact index"));
    }
    Ok(output)
}

#[wasm_bindgen]
pub fn decode_packed_impact_stats(bytes: &[u8]) -> Result<String, JsValue> {
    let mut cursor = Cursor::new(bytes);
    let format = cursor.read_magic()?;
    let metadata_length = cursor.read_u32_le()? as usize;
    cursor.read_bytes(metadata_length)?;

    let term_count: u64;
    let mut field_count = 0_u64;
    let mut posting_count = 0_u64;
    let mut max_doc_id = 0_u64;

    match format {
        PackedFormat::V1 => {
            term_count = cursor.read_varint()?;
            for _ in 0..term_count {
                let term_length = cursor.read_varint()? as usize;
                cursor.read_bytes(term_length)?;
                let stats = scan_fields(&mut cursor)?;
                field_count += stats.field_count;
                posting_count += stats.posting_count;
                max_doc_id = max_doc_id.max(stats.max_doc_id);
            }
        }
        PackedFormat::V2 => {
            let directory = read_directory(&mut cursor)?;
            term_count = directory.len() as u64;
            for (_term, payload_length) in directory {
                let end = cursor.offset + payload_length;
                let mut payload_cursor = Cursor::new(&cursor.data[cursor.offset..end]);
                let stats = scan_fields(&mut payload_cursor)?;
                if !payload_cursor.is_done() {
                    return Err(JsValue::from_str(
                        "trailing bytes in packed impact term payload",
                    ));
                }
                cursor.offset = end;
                field_count += stats.field_count;
                posting_count += stats.posting_count;
                max_doc_id = max_doc_id.max(stats.max_doc_id);
            }
        }
    }

    if !cursor.is_done() {
        return Err(JsValue::from_str("trailing bytes in packed impact index"));
    }

    Ok(format!(
        "{{\"term_count\":{term_count},\"field_count\":{field_count},\"posting_count\":{posting_count},\"max_doc_id\":{max_doc_id}}}"
    ))
}

#[wasm_bindgen]
pub fn retrieve_packed_impact_topk_stats_utf8(
    bytes: &[u8],
    query_terms_utf8: &[u8],
    query_term_offsets: &[u32],
    target_candidates: usize,
) -> Result<String, JsValue> {
    let (blocks, matched_term_count) =
        collect_packed_impact_blocks_utf8(bytes, query_terms_utf8, query_term_offsets)?;
    let mut scores = DenseScores::default();
    let stats = apply_impact_blocks_to_scores(&blocks, target_candidates, &mut scores)?;

    Ok(serde_json::json!({
        "matched_term_count": matched_term_count,
        "block_count": blocks.len(),
        "candidate_count": scores.len(),
        "impact_blocks_visited": stats.impact_blocks_visited,
        "impact_blocks_pruned": stats.impact_blocks_pruned,
        "postings_visited": stats.postings_visited,
        "postings_pruned": stats.postings_pruned,
        "competitive_threshold": stats.competitive_threshold,
        "top_doc_ids": top_doc_ids(&scores.entries(), 20),
    })
    .to_string())
}

#[wasm_bindgen]
pub fn retrieve_packed_impact_topk_scores_utf8(
    bytes: &[u8],
    query_terms_utf8: &[u8],
    query_term_offsets: &[u32],
    target_candidates: usize,
) -> Result<String, JsValue> {
    let (blocks, matched_term_count) =
        collect_packed_impact_blocks_utf8(bytes, query_terms_utf8, query_term_offsets)?;
    let mut scores = DenseScores::default();
    let stats = apply_impact_blocks_to_scores(&blocks, target_candidates, &mut scores)?;
    let entries = scores.entries();

    Ok(serde_json::json!({
        "matched_term_count": matched_term_count,
        "block_count": blocks.len(),
        "candidate_count": scores.len(),
        "impact_blocks_visited": stats.impact_blocks_visited,
        "impact_blocks_pruned": stats.impact_blocks_pruned,
        "postings_visited": stats.postings_visited,
        "postings_pruned": stats.postings_pruned,
        "competitive_threshold": stats.competitive_threshold,
        "top_doc_ids": top_doc_ids(&entries, 20),
        "score_entries": sorted_score_entries(&entries),
    })
    .to_string())
}
