import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExamLanding } from '@/exams/ExamLanding';
import { RoomsLanding } from '@/rooms/RoomsLanding';
import type { RoomOccupancyClient } from '@/rooms/model/RoomOccupancyClient';
import type { ExamSnapshotClient } from '@/exams/model/ExamSnapshotClient';

describe('product landing shells', () => {
    it('renders the exam guide and explicit resume action without artifact data', () => {
        const html = renderToStaticMarkup(
            <ExamLanding
                client={{ initialize: () => new Promise<never>(() => undefined) } as unknown as ExamSnapshotClient}
                savedClass="B240402"
                onSubmit={() => undefined}
                onOpenClass={() => undefined}
            />,
        );
        expect(html).toContain('考试日程已就绪');
        expect(html).toContain('placeholder="例如 B240402"');
        expect(html).toContain('继续查看 B240402');
    });

    it('renders the rooms shell before the manifest promise can resolve', () => {
        const never = new Promise<never>(() => undefined);
        const client = { initialize: () => never } as unknown as RoomOccupancyClient;
        const html = renderToStaticMarkup(
            <RoomsLanding client={client} savedRoom={null} onChange={() => undefined} onSubmit={() => undefined} />,
        );
        expect(html).toContain('考试占用教室');
        expect(html).toContain('placeholder="例如 教2 或 教2-313"');
        expect(html).toContain('正在补充教室数据');
    });
});
