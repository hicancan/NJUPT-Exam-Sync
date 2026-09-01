import {
    isClassLookupQuery,
    isCompleteClassQuery,
    isExamHelperQuery,
    normalizeClassQuery,
} from '@njupt-search/academics-exam/query';
import { parseRoomIntent } from '@njupt-search/academics-room';
import type { ProductIntent } from './intents';
import type { AppRoute } from './useUrlState';

export interface RouteDestination {
    route: AppRoute;
    params?: Record<string, string | null>;
}

export const resolveSubmission = (value: string): RouteDestination => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return { route: 'home' };
    if (isCompleteClassQuery(trimmed)) {
        return { route: 'exam', params: { class: normalizeClassQuery(trimmed) } };
    }
    if (isExamHelperQuery(trimmed)) return { route: 'exam' };
    if (isClassLookupQuery(trimmed)) return { route: 'exam', params: { q: trimmed } };
    const roomIntent = parseRoomIntent(trimmed);
    if (roomIntent?.kind === 'entry') return { route: 'classrooms' };
    if (roomIntent?.kind === 'candidate') {
        return { route: 'classrooms', params: { q: roomIntent.input } };
    }
    return { route: 'search', params: { q: trimmed } };
};

export const resolveRouteSubmission = (route: AppRoute, value: string): RouteDestination => {
    const trimmed = value.trim();
    if (!trimmed) return { route };
    if (route === 'home') return resolveSubmission(trimmed);
    if (route === 'search' || route === 'community' || route === 'materials') {
        return { route, params: { q: trimmed } };
    }
    if (route === 'exam') return isCompleteClassQuery(trimmed)
        ? { route, params: { class: normalizeClassQuery(trimmed) } }
        : { route, params: { q: trimmed } };
    if (route === 'timetable') return isCompleteClassQuery(trimmed)
        ? { route, params: { class: normalizeClassQuery(trimmed) } }
        : { route, params: { q: trimmed } };
    return { route, params: { q: trimmed } };
};

export const resolveQuickIntent = (intent: ProductIntent): RouteDestination => {
    if (intent.kind === 'timetable') return { route: 'timetable' };
    if (intent.kind === 'classrooms') return { route: 'classrooms' };
    if (intent.kind === 'exam') return { route: 'exam' };
    if (intent.kind === 'community') return { route: 'community' };
    if (intent.kind === 'materials') return { route: 'materials' };
    return { route: 'search', params: { q: intent.query } };
};

export const parseSavedClass = (raw: string | null): string | null => {
    if (!raw || !isCompleteClassQuery(raw)) return null;
    return normalizeClassQuery(raw);
};
