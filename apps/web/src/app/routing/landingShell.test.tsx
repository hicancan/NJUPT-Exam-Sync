import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamLanding } from '@/exams/ExamLanding';
import { RoomsLanding } from '@/rooms/RoomsLanding';
import { RoomBuildingPicker } from '@/rooms/ui/RoomBuildingPicker';
import type { RoomOccupancyClient } from '@/rooms/model/RoomOccupancyClient';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import type { ExamHistoryClient } from '@/exams/model/ExamHistoryClient';
import { TimetableLanding } from '@/timetable/TimetableLanding';
import type { TeachingScheduleClient } from '@/timetable/model/TeachingScheduleClient';
import { ClassroomsLanding } from '@/classrooms/ClassroomsLanding';
import type { ClassroomAvailabilityClient } from '@/classrooms/model/ClassroomAvailabilityClient';
import type { SpaceClient, SpaceIndex } from '@/space/model/SpaceClient';

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

    it('renders the rooms shell before the manifest promise can resolve', () => {
        const never = new Promise<never>(() => undefined);
        const client = { initialize: () => never } as unknown as RoomOccupancyClient;
        const spaceClient = { initialize: () => never } as unknown as SpaceClient;
        const html = renderToStaticMarkup(
            <RoomsLanding client={client} spaceClient={spaceClient} savedRoom={null} onChange={() => undefined} onSubmit={() => undefined} />,
        );
        expect(html).toContain('考试教室查询');
        expect(html).toContain('输入楼栋或教室号，查看考试期间的教室占用情况。');
        expect(html).toContain('placeholder="输入楼栋或教室号"');
        expect(html).toContain('正在加载校区和楼栋');
        expect(html).toContain('grid-cols-[minmax(0,1fr)_88px]');
        expect(html).not.toContain('flex max-w-[500px] flex-col');
        expect(html).not.toMatch(/产品入口|索引到达|自动补充/);
    });

    it('renders one shared, touch-friendly building picker', () => {
        const html = renderToStaticMarkup(
            <RoomBuildingPicker
                heading="按楼栋查看"
                space={{
                    campuses: [{ campus_id: 'c1', name: '三牌楼' }, { campus_id: 'c2', name: '仙林' }],
                    buildings: [{ building_id: 'b1', campus_id: 'c1', name: '教东' }, { building_id: 'b2', campus_id: 'c2', name: '教2' }],
                    floors: [], families: [], manifest: {},
                } as unknown as SpaceIndex}
                onSelect={() => undefined}
            />,
        );
        expect(html).toContain('按楼栋查看');
        expect(html.match(/>教东<\/button>/g)).toHaveLength(1);
        expect(html.match(/>教2<\/button>/g)).toHaveLength(1);
        expect(html).toContain('inline-flex h-9 items-center');
    });

    it('renders the timetable shell without downloading a class shard', () => {
        const html = renderToStaticMarkup(<TimetableLanding client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as TeachingScheduleClient} savedClass="B240402" onOpenClass={() => undefined} />);
        expect(html).toContain('查询班级课表');
        expect(html).toContain('placeholder="输入班级号，例如 B240402"');
        expect(html).toContain('继续查看 B240402');
    });

    it('renders the classroom availability shell without waiting for occupancy data', () => {
        const html = renderToStaticMarkup(<ClassroomsLanding client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as ClassroomAvailabilityClient} onChange={() => undefined} />);
        expect(html).toContain('查询空教室');
        expect(html).toContain('课程与考试数据中没有发现占用');
        expect(html).not.toContain('一定空闲');
    });
});
