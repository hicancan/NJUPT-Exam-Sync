import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TeachingMeeting, TeachingPeriod, TeachingWeek } from '@njupt-search/academics-timetable';
import { TimetableGrid } from './TimetableGrid';

const createMeeting = (meetingId: string, courseCode: string, courseName: string): TeachingMeeting => ({
    meeting_id: meetingId,
    teaching_class_id: meetingId,
    teaching_class_name: meetingId,
    course_code: courseCode,
    course_name: courseName,
    course_category: null,
    course_nature: null,
    teacher: null,
    teacher_title: null,
    instructor_role: null,
    campus: '仙林',
    space_family_id: null,
    space_unit_id: null,
    location: meetingId === 'lecture' ? '教3-409' : '教4-211(5)',
    location_type: null,
    weekday: 1,
    start_period: 6,
    end_period: 7,
    week_numbers: [1],
    teaching_method: null,
    assessment_method: null,
    exam_method: null,
    credits: null,
    class_hours: null,
    course_total_hours: null,
    class_hours_composition: null,
    weekly_hours: null,
    teaching_class_size: null,
    enrollment_count: null,
    capacity: null,
    enrollment_note: null,
    direction: null,
    online_information: null,
    scheduling_flag: null,
    class_ids: ['B250105'],
});

const week: TeachingWeek = { week: 1, start_date: '2026-08-31', end_date: '2026-09-06' };
const periods: TeachingPeriod[] = [
    { period: 6, start_time: '13:45', end_time: '14:30', day_part: '下午' },
    { period: 7, start_time: '14:35', end_time: '15:20', day_part: '下午' },
];

const renderGrid = (meetings: TeachingMeeting[]) => renderToStaticMarkup(
    <TimetableGrid
        meetings={meetings}
        week={week}
        periods={periods}
        tones={new Map(meetings.map(meeting => [meeting.course_code ?? meeting.course_name, 0]))}
        view="week"
        day={1}
        onOpen={() => undefined}
    />,
);

describe('TimetableGrid overlap copy', () => {
    it('labels simultaneous instances of one course as parallel arrangements', () => {
        const html = renderGrid([
            createMeeting('lecture', 'TX100011S', '信号与系统（混合式）'),
            createMeeting('flipped', 'TX100011S', '信号与系统（混合式）'),
        ]);
        expect(html).toContain('并行 2 项');
        expect(html).toContain('同一课程共有2项并行安排');
        expect(html).not.toMatch(/\u51b2\u7a81/u);
    });

    it('labels different courses in the same periods as a time overlap', () => {
        const html = renderGrid([
            createMeeting('lecture', 'TX100011S', '信号与系统（混合式）'),
            createMeeting('network', 'JS1111X0S', '网络技术与应用（混合式）'),
        ]);
        expect(html).toContain('重叠 2 项');
        expect(html).toContain('共有2项时间重叠安排');
        expect(html).not.toMatch(/\u51b2\u7a81/u);
    });
});
