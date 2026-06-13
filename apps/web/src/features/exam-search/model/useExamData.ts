import { useState, useEffect } from 'react';
import { APP_CONFIG } from '@/app/config/constants';
import {
    assertManifestMatchesExams,
    parseExamData,
    parseManifest,
    resolveExamDataVersion
} from '@njupt-search/exam-core/contract';
import { fetchJson } from '@/shared/lib/fetch';
import { Exam, Manifest } from '@/shared/lib/contracts';

interface UseExamDataResult {
    exams: Exam[];
    loading: boolean;
    error: string | null;
    sourceUrl: string | null;
    sourceTitle: string | null;
    generatedAt: string | null;
    dataVersion: string | null;
    totalRecords: number | null;
}

interface LoadedExamData {
    exams: Exam[];
    sourceUrl: string | null;
    sourceTitle: string | null;
    generatedAt: string;
    dataVersion: string;
    totalRecords: number;
}

export const examDataUrlWithVersion = (url: string, dataVersion: string): string => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(dataVersion)}`;
};

export const examSummaryUrlWithNonce = (url: string, nonce = Date.now().toString(36)): string => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}fresh=${encodeURIComponent(nonce)}`;
};

export async function loadExamData(signal?: AbortSignal): Promise<LoadedExamData> {
    const summaryUrl = examSummaryUrlWithNonce(APP_CONFIG.DATA_URLS.SUMMARY);
    const manifestPayload = await fetchJson(summaryUrl, signal, 'exam-summary');
    const manifestData: Manifest = parseManifest(manifestPayload, APP_CONFIG.DATA_URLS.SUMMARY);
    const dataVersion = resolveExamDataVersion(manifestData);
    const examsPayload = await fetchJson(
        examDataUrlWithVersion(APP_CONFIG.DATA_URLS.EXAMS, dataVersion),
        signal,
        'exam-data-versioned'
    );
    const examsData = parseExamData(examsPayload, APP_CONFIG.DATA_URLS.EXAMS);
    assertManifestMatchesExams(manifestData, examsData);

    const sortedExams = [...examsData].sort((a, b) => {
        if (a.start_timestamp && b.start_timestamp) {
            return a.start_timestamp.localeCompare(b.start_timestamp);
        }
        return a.start_timestamp ? -1 : 1;
    });

    return {
        exams: sortedExams,
        sourceUrl: manifestData.source_url || null,
        sourceTitle: manifestData.source_title || null,
        generatedAt: manifestData.generated_at,
        dataVersion,
        totalRecords: manifestData.total_records,
    };
}

export function useExamData(enabled = true): UseExamDataResult {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [sourceTitle, setSourceTitle] = useState<string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);
    const [dataVersion, setDataVersion] = useState<string | null>(null);
    const [totalRecords, setTotalRecords] = useState<number | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();

        loadExamData(controller.signal)
            .then((loaded) => {
                setExams(loaded.exams);
                setSourceUrl(loaded.sourceUrl);
                setSourceTitle(loaded.sourceTitle);
                setGeneratedAt(loaded.generatedAt);
                setDataVersion(loaded.dataVersion);
                setTotalRecords(loaded.totalRecords);
                setLoading(false);
            })
            .catch(err => {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                console.error(err);
                setError(err instanceof Error ? err.message : '无法加载数据：未知错误');
                setLoading(false);
            });

        return () => controller.abort();
    }, [enabled]);

    return {
        exams,
        loading: enabled && loading,
        error: enabled ? error : null,
        sourceUrl,
        sourceTitle,
        generatedAt,
        dataVersion,
        totalRecords
    };
}
