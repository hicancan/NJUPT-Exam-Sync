import { describe, expect, it } from 'vitest';
import type { TeachingMeeting } from '@njupt-search/academics-timetable';
import { alternatingWeekLabel, formatWeekNumbers, showAsInactiveAlternating } from './weekPattern';

const value = (weekNumbers: number[]) => ({ week_numbers: weekNumbers } as TeachingMeeting);

describe('teaching week patterns', () => {
    it('keeps the opposite alternating week visible as an inactive card', () => {
        const even = value([2, 4, 6, 8, 10, 12, 14, 16, 18]);
        expect(alternatingWeekLabel(even)).toBe('双周');
        expect(showAsInactiveAlternating(even, 1)).toBe(true);
        expect(showAsInactiveAlternating(even, 2)).toBe(false);
        expect(formatWeekNumbers(even.week_numbers)).toBe('第2–18周（双周）');
    });

    it('does not turn ordinary date ranges into gray alternating cards', () => {
        const ordinary = value([3, 4, 5, 6]);
        expect(alternatingWeekLabel(ordinary)).toBeNull();
        expect(showAsInactiveAlternating(ordinary, 2)).toBe(false);
        expect(formatWeekNumbers(ordinary.week_numbers)).toBe('第3–6周');
    });
});
