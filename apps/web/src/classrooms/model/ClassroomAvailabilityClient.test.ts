import { describe, expect, it } from 'vitest';
import { resolveClassroomMoment } from './ClassroomAvailabilityClient';

const weeks = [
    { week: 1, start_date: '2026-08-31', end_date: '2026-09-06' },
    { week: 2, start_date: '2026-09-07', end_date: '2026-09-13' },
];

describe('classroom date routing', () => {
    it('maps a shareable date to the authoritative week and weekday', () => {
        expect(resolveClassroomMoment(weeks, { date: '2026-09-01' })).toEqual({
            date: '2026-09-01',
            week: 1,
            weekday: 2,
        });
    });

    it('keeps week and weekday routes deterministic', () => {
        expect(resolveClassroomMoment(weeks, { week: 2, weekday: 3 })).toEqual({
            date: '2026-09-09',
            week: 2,
            weekday: 3,
        });
    });

    it('rejects dates outside the published term', () => {
        expect(() => resolveClassroomMoment(weeks, { date: '2027-02-01' })).toThrow('当前学期不包含');
    });
});
