use wasm_bindgen::prelude::*;

#[derive(Default)]
pub(crate) struct DenseScores {
    values: Vec<f64>,
    present: Vec<bool>,
    touched: Vec<u64>,
}

impl DenseScores {
    fn ensure_doc(&mut self, doc_id: u64) -> Result<usize, JsValue> {
        let index: usize = doc_id
            .try_into()
            .map_err(|_| JsValue::from_str("doc id exceeds usize"))?;
        if index >= self.values.len() {
            let new_len = index
                .checked_add(1)
                .ok_or_else(|| JsValue::from_str("doc id length overflow"))?;
            self.values.resize(new_len, 0.0);
            self.present.resize(new_len, false);
        }
        Ok(index)
    }

    pub(crate) fn add(&mut self, doc_id: u64, score: f64) -> Result<(), JsValue> {
        let index = self.ensure_doc(doc_id)?;
        if !self.present[index] {
            self.present[index] = true;
            self.touched.push(doc_id);
        }
        self.values[index] += score;
        Ok(())
    }

    pub(crate) fn contains(&self, doc_id: u64) -> bool {
        let Ok(index) = usize::try_from(doc_id) else {
            return false;
        };
        self.present.get(index).copied().unwrap_or(false)
    }

    pub(crate) fn len(&self) -> usize {
        self.touched.len()
    }

    pub(crate) fn entries(&self) -> Vec<(u64, f64)> {
        let mut entries = Vec::with_capacity(self.touched.len());
        for doc_id in &self.touched {
            if let Ok(index) = usize::try_from(*doc_id) {
                let score = self.values.get(index).copied().unwrap_or(0.0);
                if score > 0.0 {
                    entries.push((*doc_id, score));
                }
            }
        }
        entries
    }

    pub(crate) fn competitive_threshold(&self, target: usize) -> f64 {
        if self.len() < target {
            return f64::NEG_INFINITY;
        }
        let mut values: Vec<f64> = self
            .touched
            .iter()
            .filter_map(|doc_id| usize::try_from(*doc_id).ok())
            .filter_map(|index| self.values.get(index).copied())
            .collect();
        values.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        values[target.saturating_sub(1)]
    }
}
