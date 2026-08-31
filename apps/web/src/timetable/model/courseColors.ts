import type { TeachingMeeting } from '@njupt-search/academics-timetable';

export const COURSE_TONE_COUNT = 24;

const hash = (value: string): number => {
    let result = 2166136261;
    for (const character of value) {
        result ^= character.codePointAt(0) ?? 0;
        result = Math.imul(result, 16777619);
    }
    return result >>> 0;
};

export const courseIdentity = (meeting: Pick<TeachingMeeting, 'course_code' | 'course_name'>): string => (
    meeting.course_code?.trim().toUpperCase() || meeting.course_name.trim().replace(/\s+/g, ' ')
);

export const allocateCourseTones = (meetings: TeachingMeeting[]): Map<string, number> => {
    const identities = [...new Set(meetings.map(courseIdentity))].sort((left, right) => left.localeCompare(right, 'zh-CN'));
    if (identities.length > COURSE_TONE_COUNT) {
        throw new Error(`当前班级有 ${identities.length} 门不同课程，超过 ${COURSE_TONE_COUNT} 个无碰撞颜色槽`);
    }
    const used = new Set<number>();
    const result = new Map<string, number>();
    for (const identity of identities) {
        const start = hash(identity) % COURSE_TONE_COUNT;
        let tone = start;
        while (used.has(tone)) tone = (tone + 1) % COURSE_TONE_COUNT;
        used.add(tone);
        result.set(identity, tone);
    }
    return result;
};
