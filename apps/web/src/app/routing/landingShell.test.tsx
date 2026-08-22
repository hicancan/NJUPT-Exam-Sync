import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamLanding } from '@/exams/ExamLanding';
import { RoomsLanding } from '@/rooms/RoomsLanding';
import type { RoomOccupancyClient } from '@/rooms/model/RoomOccupancyClient';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';
import type { ExamHistoryClient } from '@/exams/model/ExamHistoryClient';

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
        const html = renderToStaticMarkup(
            <RoomsLanding client={client} savedRoom={null} onChange={() => undefined} onSubmit={() => undefined} />,
        );
        expect(html).toContain('考试教室查询');
        expect(html).toContain('输入楼栋或教室号，查看考试期间的教室占用情况。');
        expect(html).toContain('placeholder="输入楼栋或教室号"');
        expect(html).toContain('正在加载校区和楼栋');
        expect(html).not.toMatch(/产品入口|索引到达|自动补充/);
    });
});
