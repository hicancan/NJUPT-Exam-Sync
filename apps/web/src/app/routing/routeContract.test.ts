import { describe, expect, it } from 'vitest';
import {
    parseSavedClass,
    resolveQuickIntent,
    resolveRouteSubmission,
    resolveSubmission,
} from './routeContract';
import { buildPath, parseUrlState, routeFromPathname } from './useUrlState';

describe('product route contract', () => {
    it('routes product entry intents to canonical parameter-free landings', () => {
        expect(resolveQuickIntent({ kind: 'exam' })).toEqual({ route: 'exam' });
        expect(resolveQuickIntent({ kind: 'timetable' })).toEqual({ route: 'timetable' });
        expect(resolveQuickIntent({ kind: 'classrooms' })).toEqual({ route: 'classrooms' });
        expect(resolveSubmission('考试安排')).toEqual({ route: 'exam' });
        expect(resolveSubmission('考试占用教室')).toEqual({ route: 'classrooms' });
    });

    it('keeps class and room details explicit and shareable', () => {
        expect(resolveSubmission('B240402')).toEqual({ route: 'exam', params: { class: 'B240402' } });
        expect(resolveSubmission('B2404')).toEqual({ route: 'exam', params: { q: 'B2404' } });
        expect(resolveSubmission('教2-313')).toEqual({ route: 'classrooms', params: { q: '教2-313' } });
        expect(resolveSubmission('肖甫')).toEqual({ route: 'search', params: { q: '肖甫' } });
    });

    it('keeps the top search inside the active product domain', () => {
        expect(resolveRouteSubmission('search', 'B240402')).toEqual({ route: 'search', params: { q: 'B240402' } });
        expect(resolveRouteSubmission('exam', 'B240402')).toEqual({ route: 'exam', params: { class: 'B240402' } });
        expect(resolveRouteSubmission('timetable', 'B240402')).toEqual({ route: 'timetable', params: { class: 'B240402' } });
        expect(resolveRouteSubmission('classrooms', '教2')).toEqual({ route: 'classrooms', params: { q: '教2' } });
    });

    it('keeps saved state separate from primary intent routing', () => {
        expect(parseSavedClass('B240402')).toBe('B240402');
        expect(parseSavedClass('考试安排')).toBeNull();
    });

    it('round-trips clean landing and detail URLs for reload, back and forward state', () => {
        const urls = [
            ['/exam', ''],
            ['/exam', '?class=B240402'],
            ['/exam', '?q=B2404'],
            ['/search', '?q=%E8%82%96%E7%94%AB'],
            ['/timetable', '?class=B240402&week=13'],
            ['/classrooms', '?week=1&weekday=2&period=3&campus=%E4%BB%99%E6%9E%97'],
            ['/classrooms', '?date=2026-09-01&period=3&building=%E6%95%994'],
        ] as const;
        const states = urls.map(([pathname, search]) => parseUrlState(pathname, search));
        expect(states.map(state => state.route)).toEqual(['exam', 'exam', 'exam', 'search', 'timetable', 'classrooms', 'classrooms']);
        expect(states[0]?.qParam).toBeNull();
        expect(states[1]?.classParam).toBe('B240402');
        expect(states[4]).toMatchObject({ classParam: 'B240402', weekParam: '13' });
        expect(states[5]).toMatchObject({ weekParam: '1', weekdayParam: '2', periodParam: '3', campusParam: '仙林' });
        expect(states[6]).toMatchObject({ dateParam: '2026-09-01', periodParam: '3', buildingParam: '教4' });
        expect(buildPath({ route: 'exam' })).toBe('/exam');
    });

    it('accepts only the five current application paths', () => {
        expect(routeFromPathname('/')).toBe('home');
        expect(routeFromPathname('/search')).toBe('search');
        expect(routeFromPathname('/exam')).toBe('exam');
        expect(routeFromPathname('/timetable')).toBe('timetable');
        expect(routeFromPathname('/classrooms')).toBe('classrooms');
        expect(() => routeFromPathname('/rooms')).toThrow('Unsupported application route');
        expect(() => routeFromPathname('/missing')).toThrow('Unsupported application route');
    });
});
