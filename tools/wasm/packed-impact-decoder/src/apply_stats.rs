pub(crate) struct ApplyStats {
    pub(crate) impact_blocks_visited: u64,
    pub(crate) impact_blocks_pruned: u64,
    pub(crate) postings_visited: u64,
    pub(crate) postings_pruned: u64,
    pub(crate) competitive_threshold: f64,
}

impl ApplyStats {
    pub(crate) fn to_f64(
        &self,
        matched_term_count: u64,
        block_count: usize,
        candidate_count: usize,
    ) -> Vec<f64> {
        vec![
            matched_term_count as f64,
            block_count as f64,
            candidate_count as f64,
            self.impact_blocks_visited as f64,
            self.impact_blocks_pruned as f64,
            self.postings_visited as f64,
            self.postings_pruned as f64,
            self.competitive_threshold,
        ]
    }
}
