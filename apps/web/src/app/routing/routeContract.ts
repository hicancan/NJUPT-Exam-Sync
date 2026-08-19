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

export interface SavedRoomRoute {
    label: string;
    params: Record<string, string | null>;
}

export const resolveSubmission = (value: string): RouteDestination => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return { route: 'home' };
    if (isCompleteClassQuery(trimmed)) {
        return { route: 'exam', params: { class: normalizeClassQuery(trimmed) } };
    }
    const roomIntent = parseRoomIntent(trimmed);
    if (roomIntent?.kind === 'entry') return { route: 'rooms' };
    if (roomIntent?.kind === 'candidate') {
        return { route: 'rooms', params: { room: roomIntent.input } };
    }
    if (isExamHelperQuery(trimmed)) return { route: 'exam' };
    if (isClassLookupQuery(trimmed)) return { route: 'exam', params: { q: trimmed } };
    return { route: 'search', params: { q: trimmed } };
};

export const resolveQuickIntent = (intent: ProductIntent): RouteDestination => {
    if (intent.kind === 'exam') return { route: 'exam' };
    if (intent.kind === 'rooms') return { route: 'rooms' };
    return { route: 'search', params: { q: intent.query } };
};

export const parseSavedClass = (raw: string | null): string | null => {
    if (!raw || !isCompleteClassQuery(raw)) return null;
    return normalizeClassQuery(raw);
};

export const parseSavedRoomRoute = (raw: string | null): SavedRoomRoute | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const params = parsed as Record<string, unknown>;
        if (typeof params.room === 'string' && params.room) {
            return { label: params.room, params: { room: params.room } };
        }
        if (typeof params.building === 'string' && params.building) {
            const campus = typeof params.campus === 'string' && params.campus ? params.campus : null;
            return {
                label: [campus, params.building].filter(Boolean).join(' · '),
                params: { campus, building: params.building },
            };
        }
        return null;
    } catch {
        return null;
    }
};
