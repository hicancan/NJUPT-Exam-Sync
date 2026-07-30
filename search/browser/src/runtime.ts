import initWasm, { SearchEngine as WasmSearchEngine } from '../wasm/njupt_search_wasm.js';
import { ArtifactSource, type ArtifactRef, type SearchBundleManifest } from './artifacts';
import type { FilterOptions, Query, SearchResponse } from './model';

export class SearchRuntime {
    private readonly source: ArtifactSource;
    private readonly chunkBudgetBytes: number;
    private manifestValue: SearchBundleManifest | null = null;
    private documents: ArrayBuffer | null = null;
    private lexicon: ArrayBuffer | null = null;
    private engine: WasmSearchEngine | null = null;
    private loadedChunks = new Map<string, number>();
    private loadedChunkBytes = 0;
    private metadataBytes = 0;

    constructor(source: ArtifactSource, chunkBudgetBytes: number) {
        if (!Number.isSafeInteger(chunkBudgetBytes) || chunkBudgetBytes <= 0) {
            throw new Error('chunk budget must be a positive integer');
        }
        this.source = source;
        this.chunkBudgetBytes = chunkBudgetBytes;
    }

    async initialize(signal?: AbortSignal): Promise<{
        manifest: SearchBundleManifest;
        documentCount: number;
        filterOptions: FilterOptions;
    }> {
        await initWasm();
        const manifest = await this.source.manifest(signal);
        this.metadataBytes = (
            manifest.artifacts.documents.decoded_bytes
            + manifest.artifacts.lexicon.decoded_bytes
        );
        if (this.metadataBytes > this.chunkBudgetBytes) {
            throw new Error('search metadata exceeds the search memory budget');
        }
        const [documents, lexicon] = await Promise.all([
            this.source.bytes(manifest.artifacts.documents, signal),
            this.source.bytes(manifest.artifacts.lexicon, signal),
        ]);
        signal?.throwIfAborted();
        this.manifestValue = manifest;
        this.documents = documents;
        this.lexicon = lexicon;
        this.resetEngine();
        return {
            manifest,
            documentCount: this.requireEngine().document_count(),
            filterOptions: JSON.parse(this.requireEngine().filter_options()) as FilterOptions,
        };
    }

    private requireManifest(): SearchBundleManifest {
        if (!this.manifestValue) throw new Error('search runtime is not initialized');
        return this.manifestValue;
    }

    private requireEngine(): WasmSearchEngine {
        if (!this.engine) throw new Error('search runtime is not initialized');
        return this.engine;
    }

    private resetEngine(): void {
        if (!this.documents || !this.lexicon) throw new Error('search metadata is not loaded');
        this.engine?.free();
        this.engine = new WasmSearchEngine(
            new Uint8Array(this.documents),
            this.requireManifest().artifacts.documents.decoded_bytes,
            new Uint8Array(this.lexicon),
            this.requireManifest().artifacts.lexicon.decoded_bytes,
        );
        this.loadedChunks.clear();
        this.loadedChunkBytes = 0;
    }

    private references(kind: 'postings' | 'content', chunks: number[]): ArtifactRef[] {
        const references = this.requireManifest()[kind];
        return chunks.map(chunk => {
            const reference = references[chunk];
            if (!reference) throw new Error(`SearchBundle ${kind} chunk does not exist: ${chunk}`);
            return reference;
        });
    }

    private missingBytes(kind: 'postings' | 'content', chunks: number[]): number {
        return this.references(kind, chunks)
            .filter(reference => !this.loadedChunks.has(reference.path))
            .reduce((total, reference) => total + reference.decoded_bytes, 0);
    }

    private async loadChunks(
        kind: 'postings' | 'content',
        chunks: number[],
        signal?: AbortSignal,
    ): Promise<void> {
        const engine = this.requireEngine();
        const references = this.references(kind, chunks);
        await Promise.all(references.map(async (reference, index) => {
            if (this.loadedChunks.has(reference.path)) return;
            const bytes = await this.source.bytes(reference, signal);
            signal?.throwIfAborted();
            const chunk = chunks[index];
            if (chunk === undefined) throw new Error(`missing ${kind} chunk index`);
            if (kind === 'postings') {
                engine.load_postings_chunk(
                    chunk,
                    new Uint8Array(bytes),
                    reference.decoded_bytes,
                );
            } else {
                engine.load_content_chunk(
                    chunk,
                    new Uint8Array(bytes),
                    reference.decoded_bytes,
                );
            }
            this.loadedChunks.set(reference.path, reference.decoded_bytes);
            this.loadedChunkBytes += reference.decoded_bytes;
        }));
    }

    async search(query: Query, signal?: AbortSignal): Promise<SearchResponse> {
        if (query.query.trim().length < 2) {
            throw new Error('query must contain at least two characters');
        }
        let postingChunks = JSON.parse(
            this.requireEngine().required_posting_chunks(query.query),
        ) as number[];
        let requiredBytes = this.missingBytes('postings', postingChunks);
        if (this.metadataBytes + this.loadedChunkBytes + requiredBytes > this.chunkBudgetBytes) {
            this.resetEngine();
            postingChunks = JSON.parse(
                this.requireEngine().required_posting_chunks(query.query),
            ) as number[];
            requiredBytes = this.missingBytes('postings', postingChunks);
        }
        if (this.metadataBytes + requiredBytes > this.chunkBudgetBytes) {
            throw new Error('query postings exceed the search memory budget');
        }
        await this.loadChunks('postings', postingChunks, signal);

        let contentChunks = JSON.parse(
            this.requireEngine().required_content_chunks(JSON.stringify(query)),
        ) as number[];
        const contentBytes = this.missingBytes('content', contentChunks);
        if (this.metadataBytes + this.loadedChunkBytes + contentBytes > this.chunkBudgetBytes) {
            this.resetEngine();
            postingChunks = JSON.parse(
                this.requireEngine().required_posting_chunks(query.query),
            ) as number[];
            await this.loadChunks('postings', postingChunks, signal);
            contentChunks = JSON.parse(
                this.requireEngine().required_content_chunks(JSON.stringify(query)),
            ) as number[];
        }
        const workingSetBytes = (
            this.metadataBytes
            + this.loadedChunkBytes
            + this.missingBytes('content', contentChunks)
        );
        if (workingSetBytes > this.chunkBudgetBytes) {
            throw new Error('query working set exceeds the search memory budget');
        }
        await this.loadChunks('content', contentChunks, signal);
        signal?.throwIfAborted();
        return JSON.parse(this.requireEngine().search(JSON.stringify(query))) as SearchResponse;
    }

    dispose(): void {
        this.engine?.free();
        this.engine = null;
        this.loadedChunks.clear();
        this.loadedChunkBytes = 0;
    }
}
