import { describe, expect, it } from 'vitest';
import type { TeachingMeeting } from '@njupt-search/academics-timetable';
import { allocateCourseTones, courseIdentity } from './courseColors';

const meeting = (code: string, name = code) => ({ course_code: code, course_name: name }) as TeachingMeeting;

describe('course colors', () => {
    it('keeps one course stable and avoids collisions inside one class', () => {
        const meetings = [meeting('A'), meeting('B'), meeting('A')];
        const firstMeeting = meetings[0];
        if (!firstMeeting) throw new Error('missing test meeting');
        const first = allocateCourseTones(meetings);
        const second = allocateCourseTones([...meetings].reverse());
        expect(first.get(courseIdentity(firstMeeting))).toBe(second.get('A'));
        expect(new Set(first.values()).size).toBe(2);
    });
});
