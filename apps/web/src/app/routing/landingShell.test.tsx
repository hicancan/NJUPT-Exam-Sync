import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamLanding } from '@/exams/ExamLanding';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import type { ExamHistoryClient } from '@/exams/model/ExamHistoryClient';
import { TimetableLanding } from '@/timetable/TimetableLanding';
import type { TeachingScheduleClient } from '@/timetable/model/TeachingScheduleClient';
import { ClassroomsLanding } from '@/classrooms/ClassroomsLanding';
import type { ClassroomAvailabilityClient } from '@/classrooms/model/ClassroomAvailabilityClient';
import { SearchLanding } from '@/search/SearchLanding';
import { SEARCH_SCOPES } from '@/search/searchScopes';

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
        expect(html).toContain('placeholder="输入班级号"');
        expect(html).toContain('继续查看 B240402');
        expect(html).toContain('试一试');
    });

    it('renders the classroom hierarchy shell without waiting for occupancy data', () => {
        const html = renderToStaticMarkup(<ClassroomsLanding client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as ClassroomAvailabilityClient} onChange={() => undefined} />);
        expect(html).toContain('>教室<');
        expect(html).not.toContain('不提前加载');
        expect(html).not.toContain('逐级浏览');
        expect(html).not.toContain('一定空闲');
    });

    it('renders distinct community and materials search landings', () => {
        const community = renderToStaticMarkup(<SearchLanding scope={SEARCH_SCOPES.community} />);
        const materials = renderToStaticMarkup(<SearchLanding scope={SEARCH_SCOPES.materials} />);
        expect(community).toContain('南邮社区搜索');
        expect(community).toContain('南邮生存手册');
        expect(community).toContain('NJUPT-NAVI/NJUPT-Survival-Guide');
        expect(community).toContain('/community?q=%E6%A0%A1%E5%9B%AD%E7%BD%91');
        expect(community).toContain('开发环境');
        expect(materials).toContain('南邮资料搜索');
        expect(materials).toContain('历年试卷');
        expect(materials).toContain('NJUPTFreeExams/NJUPT-General-Free-Exams');
        expect(materials).toContain('/materials?q=%E9%AB%98%E7%AD%89%E6%95%B0%E5%AD%A6');
        expect(materials).toContain('数据结构');
    });
});
