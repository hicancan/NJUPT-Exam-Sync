use njupt_search_core::{Query, SearchEngine as CoreSearchEngine};
use wasm_bindgen::prelude::*;

fn js_error(error: impl ToString) -> JsValue {
    JsValue::from_str(&error.to_string())
}

#[wasm_bindgen]
pub struct SearchEngine {
    inner: CoreSearchEngine,
}

#[wasm_bindgen]
impl SearchEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(
        documents: &[u8],
        document_bytes: u32,
        lexicon: &[u8],
        lexicon_bytes: u32,
    ) -> Result<SearchEngine, JsValue> {
        Ok(Self {
            inner: CoreSearchEngine::new(
                documents,
                document_bytes.into(),
                lexicon,
                lexicon_bytes.into(),
            )
            .map_err(js_error)?,
        })
    }

    pub fn load_postings_chunk(
        &mut self,
        chunk: u32,
        bytes: &[u8],
        decoded_bytes: u32,
    ) -> Result<(), JsValue> {
        self.inner
            .load_postings_chunk(chunk, bytes, decoded_bytes.into())
            .map_err(js_error)
    }

    pub fn load_content_chunk(
        &mut self,
        chunk: u32,
        bytes: &[u8],
        decoded_bytes: u32,
    ) -> Result<(), JsValue> {
        self.inner
            .load_content_chunk(chunk, bytes, decoded_bytes.into())
            .map_err(js_error)
    }

    pub fn required_posting_chunks(&self, query: &str) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.required_posting_chunks(query)).map_err(js_error)
    }

    pub fn required_content_chunks(&self, request_json: &str) -> Result<String, JsValue> {
        let request: Query = serde_json::from_str(request_json).map_err(js_error)?;
        serde_json::to_string(
            &self
                .inner
                .required_content_chunks(&request)
                .map_err(js_error)?,
        )
        .map_err(js_error)
    }

    pub fn filter_options(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.filter_options()).map_err(js_error)
    }

    pub fn document_count(&self) -> u32 {
        self.inner.document_count() as u32
    }

    pub fn search(&self, request_json: &str) -> Result<String, JsValue> {
        let request: Query = serde_json::from_str(request_json).map_err(js_error)?;
        let response = self.inner.search(&request).map_err(js_error)?;
        serde_json::to_string(&response).map_err(js_error)
    }
}
