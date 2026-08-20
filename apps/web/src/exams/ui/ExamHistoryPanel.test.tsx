import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ExamClassHistory } from '@njupt-search/academics-exam/history';
import { ExamHistoryPanel } from './ExamHistoryPanel';
import { ExamHistorySummary } from './ExamHistorySummary';

describe('exam history product copy', () => {
    it('shows a baseline summary without engineering terminology', () => {
        const html = renderToStaticMarkup(
            <ExamHistorySummary
                manifest={{ observed_snapshot_count: 1 } as never}
                events={{
                    events: [{
                        status: 'baseline',
                        source_updated_at: '2026-06-10T08:14:13+00:00',
                    }],
                } as never}
                loading={false}
                error={null}
            />,
        );
        expect(html).toContain('已记录 1 次更新');
        expect(html).toContain('从本次考试安排开始记录后续变化');
        expect(html).not.toMatch(/snapshot|artifact|identity|manifest|diff|Git|hydration/);
    });

    it('shows class update counts and field-level changes without calling removal a cancellation', () => {
        const history: ExamClassHistory = {
            class_name: 'B240402',
            class_key: 'class-key',
            observed_snapshot_count: 3,
            affected_event_count: 2,
            current_record_count: 14,
            latest_affected_at: '2026-06-12T08:14:13+00:00',
            events: [
                {
                    snapshot_id: '1'.repeat(64), previous_snapshot_id: null,
                    source_updated_at: '2026-06-10T08:14:13+00:00', status: 'first_seen',
                    previous_record_count: 0, current_record_count: 14, changes: [],
                },
                {
                    snapshot_id: '2'.repeat(64), previous_snapshot_id: '1'.repeat(64),
                    source_updated_at: '2026-06-11T08:14:13+00:00', status: 'changed',
                    previous_record_count: 14, current_record_count: 14,
                    changes: [{
                        type: 'changed', history_key: 'history-1',
                        course_name: '算法分析与设计', course_code: 'JS113400S', teacher: '张三',
                        fields: [{ field: 'location', before: '教2-313', after: '教2-314' }],
                    }],
                },
                {
                    snapshot_id: '3'.repeat(64), previous_snapshot_id: '2'.repeat(64),
                    source_updated_at: '2026-06-12T08:14:13+00:00', status: 'removed',
                    previous_record_count: 14, current_record_count: 13,
                    changes: [{
                        type: 'removed', history_key: 'history-2',
                        course_name: '大学英语', course_code: 'WY1004T0S', teacher: '李四',
                        fields: [{ field: 'location', before: '教2-409', after: null }],
                    }],
                },
            ],
        };
        const html = renderToStaticMarkup(
            <ExamHistoryPanel history={history} className="B240402" loading={false} error={null} />,
        );
        expect(html).toContain('系统共更新 3 次，其中 2 次影响本班');
        expect(html).toContain('记录已移除');
        expect(html).toContain('考试地点由教2-409调整为未填写');
        expect(html).not.toContain('考试取消');
    });

    it('keeps history failures separate from the current exam query', () => {
        const html = renderToStaticMarkup(
            <ExamHistoryPanel
                history={null}
                className="B240402"
                loading={false}
                error="更新记录暂时无法显示，考试查询不受影响。"
            />,
        );
        expect(html).toContain('考试查询不受影响');
    });
});
