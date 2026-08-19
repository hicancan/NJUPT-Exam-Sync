import { describe, expect, it } from 'vitest';
import {
    parseSavedClass,
    parseSavedRoomRoute,
    resolveQuickIntent,
    resolveSubmission,
} from './routeContract';
import { buildHashPath, parseHashState } from './useUrlState';

describe('product route contract', () => {
    it('routes product entry intents to canonical parameter-free landings', () => {
        expect(resolveQuickIntent({ kind: 'exam' })).toEqual({ route: 'exam' });
        expect(resolveQuickIntent({ kind: 'rooms' })).toEqual({ route: 'rooms' });
        expect(resolveSubmission('考试安排')).toEqual({ route: 'exam' });
        expect(resolveSubmission('考试占用教室')).toEqual({ route: 'rooms' });
    });

    it('keeps class and room details explicit and shareable', () => {
        expect(resolveSubmission('B240402')).toEqual({ route: 'exam', params: { class: 'B240402' } });
        expect(resolveSubmission('B2404')).toEqual({ route: 'exam', params: { q: 'B2404' } });
        expect(resolveSubmission('教2-313')).toEqual({ route: 'rooms', params: { room: '教2-313' } });
        expect(resolveSubmission('肖甫')).toEqual({ route: 'search', params: { q: '肖甫' } });
    });

    it('keeps saved state separate from primary intent routing', () => {
        expect(parseSavedClass('B240402')).toBe('B240402');
        expect(parseSavedClass('考试安排')).toBeNull();
        expect(parseSavedRoomRoute(JSON.stringify({ campus: '仙林', building: '教2' }))).toEqual({
            label: '仙林 · 教2',
            params: { campus: '仙林', building: '教2' },
        });
        expect(parseSavedRoomRoute(JSON.stringify({ room: '教2-313' }))).toEqual({
            label: '教2-313',
            params: { room: '教2-313' },
        });
        expect(resolveQuickIntent({ kind: 'exam' })).toEqual({ route: 'exam' });
        expect(resolveQuickIntent({ kind: 'rooms' })).toEqual({ route: 'rooms' });
    });

    it('round-trips landing and detail routes for reload, back and forward state', () => {
        const hashes = [
            '#/exam',
            '#/exam?class=B240402',
            '#/exam?q=B2404',
            '#/rooms',
            '#/rooms?room=%E6%95%992-313',
            '#/rooms?campus=%E4%BB%99%E6%9E%97&building=%E6%95%992&floor=3',
            '#/search?q=%E8%82%96%E7%94%AB',
        ];
        const states = hashes.map(parseHashState);
        expect(states.map(state => state.route)).toEqual(['exam', 'exam', 'exam', 'rooms', 'rooms', 'rooms', 'search']);
        expect(states[0]?.qParam).toBeNull();
        expect(states[1]?.classParam).toBe('B240402');
        expect(states[4]?.roomQuery).toBe('教2-313');
        expect(states[5]).toMatchObject({ campusParam: '仙林', buildingParam: '教2', floorParam: '3' });
        expect(buildHashPath({ route: 'exam' })).toBe('#/exam');
        expect(buildHashPath({ route: 'rooms', params: { room: '教2-313' } })).toBe('#/rooms?room=%E6%95%992-313');
    });
});
