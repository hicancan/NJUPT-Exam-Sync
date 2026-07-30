use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct Attachment {
    pub id: String,
    pub url: String,
    pub name: String,
    pub extension: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentKind {
    Page,
    Attachment,
    External,
}

#[derive(Clone, Debug)]
pub struct IndexDocument {
    pub id: String,
    pub source: String,
    pub source_name: String,
    pub url: String,
    pub title: String,
    pub content: String,
    pub published_at: Option<String>,
    pub updated_at: Option<String>,
    pub section: Option<String>,
    pub kind: DocumentKind,
    pub tags: Vec<String>,
    pub attachments: Vec<Attachment>,
}

#[derive(Clone, Debug)]
pub(crate) struct DocumentMeta {
    pub id: String,
    pub source: String,
    pub source_name: String,
    pub url: String,
    pub title: String,
    pub published_at: Option<String>,
    pub updated_at: Option<String>,
    pub section: Option<String>,
    pub kind: DocumentKind,
    pub facet: crate::query::SearchFacet,
    pub attachments: Vec<Attachment>,
    pub content_chunk: u32,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Posting {
    pub document: u32,
    pub title_hits: u16,
    pub body_hits: u16,
}
