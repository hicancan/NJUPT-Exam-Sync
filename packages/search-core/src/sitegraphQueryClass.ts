import { normalizeSearchText } from './tokenizer';

export const HIGH_DOCUMENT_FREQUENCY_QUERY_TEXTS = ['考试', '通知', '学生', '申请', '南京邮电大学'] as const;
export const DYNAMIC_HIGH_DOCUMENT_FREQUENCY_QUERY_TEXTS = ['通知', '学生', '南京邮电大学'] as const;

const normalizedSet = (values: readonly string[]): ReadonlySet<string> => new Set(values.map(normalizeSearchText));

const HIGH_DOCUMENT_FREQUENCY_NORMALIZED_QUERIES = normalizedSet(HIGH_DOCUMENT_FREQUENCY_QUERY_TEXTS);
const DYNAMIC_HIGH_DOCUMENT_FREQUENCY_NORMALIZED_QUERIES = normalizedSet(DYNAMIC_HIGH_DOCUMENT_FREQUENCY_QUERY_TEXTS);

export const isDegenerateSitegraphQuery = (queryText: string): boolean => normalizeSearchText(queryText).length < 2;

export const isHighDocumentFrequencyNormalizedQuery = (normalizedQuery: string): boolean => {
    return HIGH_DOCUMENT_FREQUENCY_NORMALIZED_QUERIES.has(normalizedQuery);
};

export const isDynamicHighDocumentFrequencyNormalizedQuery = (normalizedQuery: string): boolean => {
    return DYNAMIC_HIGH_DOCUMENT_FREQUENCY_NORMALIZED_QUERIES.has(normalizedQuery);
};
