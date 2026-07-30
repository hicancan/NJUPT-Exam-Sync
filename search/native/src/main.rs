mod bundle;
mod corpus;

use anyhow::{bail, Context, Result};
use bundle::load_engine;
use corpus::read_corpus;
use njupt_search_core::{build_search_bundle, QueryRequest};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

fn argument(args: &[String], name: &str) -> Result<String> {
    let index = args
        .iter()
        .position(|value| value == name)
        .with_context(|| format!("missing {name}"))?;
    args.get(index + 1)
        .cloned()
        .with_context(|| format!("missing value for {name}"))
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    serde_json::from_slice(&fs::read(path)?).with_context(|| format!("invalid {}", path.display()))
}

fn build(args: &[String]) -> Result<()> {
    let corpus_path = PathBuf::from(argument(args, "--corpus")?);
    let output = PathBuf::from(argument(args, "--out")?);
    let started = Instant::now();
    let corpus = read_corpus(&corpus_path)?;
    let report = build_search_bundle(
        corpus.documents,
        &corpus.source_names,
        &corpus.snapshot_id,
        &output,
    )
    .map_err(anyhow::Error::msg)?;
    println!(
        "{}",
        serde_json::json!({
            "bundle_id": report.manifest.bundle_id,
            "documents": report.document_count,
            "lexicon_terms": report.lexicon_terms,
            "files": report.file_count,
            "bytes": report.total_bytes,
            "elapsed_ms": started.elapsed().as_millis(),
            "output": output,
        })
    );
    Ok(())
}

fn query(args: &[String]) -> Result<()> {
    let bundle = PathBuf::from(argument(args, "--bundle")?);
    let query = argument(args, "--query")?;
    let limit = argument(args, "--limit")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(30);
    let (_manifest, engine) = load_engine(&bundle)?;
    let response = engine
        .search(&QueryRequest {
            query,
            limit,
            sort: Default::default(),
            filters: Default::default(),
        })
        .map_err(anyhow::Error::msg)?;
    println!("{}", serde_json::to_string_pretty(&response)?);
    Ok(())
}

fn benchmark(args: &[String]) -> Result<()> {
    let bundle = PathBuf::from(argument(args, "--bundle")?);
    let queries_path = PathBuf::from(argument(args, "--queries")?);
    let queries: Vec<String> = read_json(&queries_path)?;
    let (_manifest, engine) = load_engine(&bundle)?;
    let mut measurements = Vec::new();
    for query in queries {
        let response = engine
            .search(&QueryRequest {
                query: query.clone(),
                limit: 30,
                sort: Default::default(),
                filters: Default::default(),
            })
            .map_err(anyhow::Error::msg)?;
        measurements.push(serde_json::json!({
            "query": query,
            "elapsed_micros": response.elapsed_micros,
            "candidates": response.total_candidates,
            "results": response.results.len(),
            "top_results": response.results.iter().map(|item| serde_json::json!({
                "id": item.id,
                "title": item.title,
                "source": item.source,
                "url": item.url,
            })).collect::<Vec<_>>(),
        }));
    }
    println!("{}", serde_json::to_string_pretty(&measurements)?);
    Ok(())
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("build-index") => build(&args[2..]),
        Some("query") => query(&args[2..]),
        Some("benchmark") => benchmark(&args[2..]),
        _ => bail!(
            "usage: njupt-search <build-index|query|benchmark> [--corpus PATH --out PATH | --bundle PATH]"
        ),
    }
}
