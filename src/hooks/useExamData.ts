import { useState, useEffect } from 'react';
import { Exam, Manifest } from '@/types';
import { APP_CONFIG } from '@/constants';

interface UseExamDataResult {
    exams: Exam[];
    loading: boolean;
    error: string | null;
    sourceUrl: string | null;
    sourceTitle: string | null;
}

export function useExamData(): UseExamDataResult {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [sourceTitle, setSourceTitle] = useState<string | null>(null);

    useEffect(() => {
        const fetchOptions: RequestInit = { cache: 'no-cache' };

        Promise.all([
            fetch(APP_CONFIG.DATA_URLS.EXAMS, fetchOptions).then(r => r.json() as Promise<Exam[]>),
            fetch(APP_CONFIG.DATA_URLS.SUMMARY, fetchOptions).then(r => r.json() as Promise<Manifest>).catch(() => null)
        ])
            .then(([examsData, manifestData]) => {
                const sortedExams = [...examsData].sort((a, b) => {
                    if (a.start_timestamp && b.start_timestamp) {
                        return a.start_timestamp.localeCompare(b.start_timestamp);
                    }
                    return a.start_timestamp ? -1 : 1;
                });

                setExams(sortedExams);

                if (manifestData && manifestData.generated_at) {
                    setSourceUrl(manifestData.source_url || null);
                    setSourceTitle(manifestData.source_title || null);
                }

                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(`无法加载数据，请检查网络连接 (${APP_CONFIG.DATA_URLS.EXAMS})`);
                setLoading(false);
            });
    }, []);

    return { exams, loading, error, sourceUrl, sourceTitle };
}
