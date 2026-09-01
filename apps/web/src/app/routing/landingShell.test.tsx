import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamLanding } from '@/exams/ExamLanding';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import type { ExamHistoryClient } from '@/exams/model/ExamHistoryClient';
import { TimetableLanding } from '@/timetable/TimetableLanding';
import type { TeachingScheduleClient } from '@/timetable/model/TeachingScheduleClient';
import { ClassroomsLanding } from '@/classrooms/ClassroomsLanding';
import type { ClassroomAvailabilityClient } from '@/classrooms/model/ClassroomAvailabilityClient';

describe('product landing shells', () => {
    it('renders the exam guide and explicit resume action without artifact data', () => {
        const html = renderToStaticMarkup(
            <ExamLanding
                client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as ExamSnapshotClient}
                historyClient={{ initialize: () => new Promise<never>(() => undefined) } as unknown as ExamHistoryClient}
                savedClass="B240402"
                onSubmit={() => undefined}
                onOpenClass={() => undefined}
            />,
        );
        expect(html).toContain('查询考试安排');
        expect(html).toContain('输入班级号，查看考试时间、地点和考场。');
        expect(html).toContain('placeholder="输入班级号"');
        expect(html).toContain('继续查看 B240402');
        expect(html).toContain('grid-cols-[minmax(0,1fr)_88px]');
        expect(html).not.toContain('flex-col gap-3 sm:flex-row');
        expect(html).not.toContain('正在读取更新记录');
    });

    it('renders the timetable shell without downloading a class shard', () => {
        const html = renderToStaticMarkup(<TimetableLanding client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as TeachingScheduleClient} savedClass="B240402" onOpenClass={() => undefined} />);
        expect(html).toContain('查询班级课表');
        expect(html).toContain('placeholder="输入班级号，例如 B240402"');
        expect(html).toContain('继续查看 B240402');
    });

    it('renders the classroom hierarchy shell without waiting for occupancy data', () => {
        const html = renderToStaticMarkup(<ClassroomsLanding client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as ClassroomAvailabilityClient} onChange={() => undefined} />);
        expect(html).toContain('>教室<');
        expect(html).toContain('按校区、楼栋和楼层逐级浏览');
        expect(html).not.toContain('一定空闲');
    });
});
