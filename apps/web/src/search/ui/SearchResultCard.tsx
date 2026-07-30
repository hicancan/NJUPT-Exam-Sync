import { Download, ExternalLink, FileText, Filter } from 'lucide-react';
import type { SearchResult } from '@njupt-search/search-browser';
import { FACET_LABELS } from './searchLabels';

const isExternalUrl = (url: string): boolean => /^https?:\/\//.test(url);

interface MatchHighlight {
    start: number;
    end: number;
}

function highlightRangesFromTerms(text: string, terms: string[]): MatchHighlight[] {
    const uniqueTerms = Array.from(new Set(terms.filter(term => term.length >= 2)))
        .sort((a, b) => b.length - a.length);
    if (uniqueTerms.length === 0) return [];

    const lowerText = text.toLocaleLowerCase('zh-CN');
    const ranges: MatchHighlight[] = [];
    for (const term of uniqueTerms) {
        const lowerTerm = term.toLocaleLowerCase('zh-CN');
        let index = lowerText.indexOf(lowerTerm);
        while (index >= 0) {
            const end = index + term.length;
            const overlaps = ranges.some(range => index < range.end && end > range.start);
            if (!overlaps) ranges.push({ start: index, end });
            index = lowerText.indexOf(lowerTerm, index + 1);
        }
    }
    return ranges.sort((a, b) => a.start - b.start);
}

function highlightedSegments(
    text: string,
    terms: string[]
): Array<{ text: string; highlighted: boolean }> {
    const ranges = highlightRangesFromTerms(text, terms)
        .filter(range => Number.isInteger(range.start)
            && Number.isInteger(range.end)
            && range.start >= 0
            && range.end > range.start
            && range.end <= text.length)
        .sort((a, b) => a.start - b.start);
    if (ranges.length === 0) return [{ text, highlighted: false }];

    const segments: Array<{ text: string; highlighted: boolean }> = [];
    let cursor = 0;
    for (const range of ranges) {
        if (range.start < cursor) continue;
        if (range.start > cursor) {
            segments.push({ text: text.slice(cursor, range.start), highlighted: false });
        }
        segments.push({ text: text.slice(range.start, range.end), highlighted: true });
        cursor = range.end;
    }
    if (cursor < text.length) {
        segments.push({ text: text.slice(cursor), highlighted: false });
    }
    return segments.filter(segment => segment.text.length > 0);
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
    return (
        <>
            {highlightedSegments(text, terms).map((segment, index) => segment.highlighted ? (
                <mark
                    key={`${segment.text}-${index}`}
                    data-testid="collection-result-highlight"
                    className="rounded bg-[#fff3bf] px-0.5 text-inherit dark:bg-[#5f4b18]"
                >
                    {segment.text}
                </mark>
            ) : (
                <span key={`${segment.text}-${index}`}>{segment.text}</span>
            ))}
        </>
    );
}

interface SearchResultCardProps {
    document: SearchResult;
}

export function SearchResultCard({ document }: SearchResultCardProps) {
    const date = document.updatedAt || document.publishedAt;
    const wrapperProps = {
        href: document.url,
        target: isExternalUrl(document.url) ? '_blank' : undefined,
        rel: isExternalUrl(document.url) ? 'noopener noreferrer' : undefined,
    };

    return (
        <a {...wrapperProps} className="block w-full text-left py-3 group border-b border-[#e8eaed] dark:border-[#3c4043] last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#70757a] dark:text-[#9aa0a6]">
                <span className="font-medium text-[#3c4043] dark:text-[#bdc1c6]">{FACET_LABELS[document.facet]}</span>
                <span>{document.sourceName}</span>
                <span>›</span>
                <span>{document.section || '未分类'}</span>
                {date ? <><span>›</span><span>{date.slice(0, 10)}</span></> : null}
            </div>

            <h3 className="mt-1 text-[20px] leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8] group-hover:underline break-words">
                {document.title}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#0b8043] dark:text-[#81c995]">
                <span className="truncate max-w-full">{document.url}</span>
                {document.kind === 'external' ? (
                    <span className="inline-flex items-center gap-1 text-[#5f6368] dark:text-[#9aa0a6]">
                        <ExternalLink size={13} />
                        仅入口记录
                    </span>
                ) : null}
                {document.kind === 'attachment' ? (
                    <span className="inline-flex items-center gap-1 text-[#5f6368] dark:text-[#9aa0a6]">
                        <Download size={13} />
                        元数据附件
                    </span>
                ) : null}
            </div>

            <p
                data-testid="collection-result-snippet"
                className="mt-2 text-[14px] text-[#4d5156] dark:text-[#bdc1c6] line-clamp-3 sm:line-clamp-2 break-words"
            >
                <HighlightedText
                    text={document.snippet}
                    terms={document.matchedTerms}
                />
            </p>

            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
                <span className="inline-flex items-center gap-1 rounded bg-[#f1f3f4] dark:bg-[#303134] px-2 py-1">
                    <Filter size={12} />
                    {document.section || '未分类'}
                </span>
                {document.attachments.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#e8f0fe] dark:bg-[#263850] px-2 py-1 text-[#1967d2] dark:text-[#8ab4f8]">
                        <FileText size={12} />
                        附件 {document.attachments.length}
                    </span>
                ) : null}
            </div>

            {document.attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {document.attachments.slice(0, 4).map(attachment => (
                        <span
                            key={`${attachment.id}-${attachment.url}`}
                            className="inline-flex items-center gap-1 max-w-full h-6 px-2 rounded bg-[#f8fafd] dark:bg-[#2d2f33] text-[12px] text-[#3c4043] dark:text-[#d2d5da]"
                        >
                            <FileText size={12} className="shrink-0" />
                            <span className="truncate">{attachment.name}</span>
                            {attachment.extension ? <span className="uppercase text-[#70757a] dark:text-[#9aa0a6]">{attachment.extension}</span> : null}
                        </span>
                    ))}
                </div>
            ) : null}

        </a>
    );
}
