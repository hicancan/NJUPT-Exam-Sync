import type { ExamHistoryClient } from './model/ExamHistoryClient';
import { useExamHistory } from './model/useExamHistory';
import { ExamHistorySummary } from './ui/ExamHistorySummary';

export function ExamHistoryLanding({ client }: { client: ExamHistoryClient }) {
    const history = useExamHistory(client);
    return (
        <ExamHistorySummary
            manifest={history.manifest}
            events={history.events}
            loading={history.loading}
            error={history.error}
        />
    );
}
