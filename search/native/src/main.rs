mod bundle;
mod corpus;

use anyhow::{bail, Context, Result};
use bundle::{load_engine, write_bundle};
use corpus::read_corpus;
use njupt_search_core::{compile_search_bundle, Query};
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
    let bundle =
        compile_search_bundle(corpus.documents, &corpus.snapshot_id).map_err(anyhow::Error::msg)?;
    let report = write_bundle(&output, &bundle)?;
    println!(
        "{}",
        serde_json::json!({
            "bundle_id": bundle.manifest.bundle_id,
            "corpus_snapshot_id": bundle.manifest.corpus_snapshot_id,
            "documents": bundle.document_count,
            "lexicon_terms": bundle.lexicon_terms,
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
    let request = if let Ok(value) = argument(args, "--request-json") {
        serde_json::from_str::<Query>(&value).context("invalid --request-json")?
    } else {
        let query = argument(args, "--query")?;
        let limit = argument(args, "--limit")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(30);
        Query {
            query,
            limit,
            sort: Default::default(),
            filters: Default::default(),
        }
    };
    let (_manifest, engine) = load_engine(&bundle)?;
    let response = engine.search(&request).map_err(anyhow::Error::msg)?;
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
        let started = Instant::now();
        let request = Query {
            query: query.clone(),
            limit: 30,
            sort: Default::default(),
            filters: Default::default(),
        };
        let preparation = engine.begin_query(&request).map_err(anyhow::Error::msg)?;
        let analyze_micros = started.elapsed().as_micros() as u64;
        let ranking_started = Instant::now();
        let plan = engine
            .plan_query(&preparation)
            .map_err(anyhow::Error::msg)?;
        let rank_micros = ranking_started.elapsed().as_micros() as u64;
        let snippet_started = Instant::now();
        let response = engine
            .hydrate_results(&plan, 0, request.limit)
            .map_err(anyhow::Error::msg)?;
        let snippet_micros = snippet_started.elapsed().as_micros() as u64;
        measurements.push(serde_json::json!({
            "query": query,
            "elapsed_micros": started.elapsed().as_micros() as u64,
            "analyze_micros": analyze_micros,
            "rank_micros": rank_micros,
            "snippet_micros": snippet_micros,
            "candidates": response.total_candidates,
            "results": response.results.len(),
            "top_results": response.results.iter().map(|item| serde_json::json!({
                "id": item.id,
                "title": item.title,
                "source": item.source,
                "url": item.url,
                "published_at": item.published_at,
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
