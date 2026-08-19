import { useCallback, useMemo, useState } from 'react';
import {
    isClassLookupQuery,
    isCompleteClassQuery,
    isExamHelperQuery,
    normalizeClassQuery,
} from '@njupt-search/academics-exam/query';
import { parseRoomIntent } from '@njupt-search/academics-room';
import { useUrlState } from './useUrlState';
import type { ProductIntent } from './intents';

const SAVED_CLASS_KEY = 'SAVED_CLASS';
const SAVED_ROOM_KEY = 'SAVED_ROOM_TARGET';

const roomRouteParams = (value: string): Record<string, string | null> | null => {
    const target = parseRoomIntent(value);
    if (!target) return null;
    if (target.kind === 'entry') return {};
    return { room: target.input };
};

const savedRoomParams = (): Record<string, string | null> | null => {
    const raw = localStorage.getItem(SAVED_ROOM_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const params = parsed as Record<string, unknown>;
        if (typeof params.room === 'string' && params.room) return { room: params.room };
        if (typeof params.building === 'string' && params.building) {
            return {
                campus: typeof params.campus === 'string' && params.campus ? params.campus : null,
                building: params.building,
            };
        }
        return null;
    } catch {
        return null;
    }
};

const saveRoomParams = (params: Record<string, string | null>): void => {
    if (params.room) {
        localStorage.setItem(SAVED_ROOM_KEY, JSON.stringify({ room: params.room }));
        return;
    }
    if (params.building) {
        localStorage.setItem(SAVED_ROOM_KEY, JSON.stringify({ campus: params.campus || null, building: params.building }));
    }
};

export function useAppRouter() {
    const url = useUrlState();
    const {
        route,
        qParam,
        classParam,
        roomQuery,
        dateParam,
        campusParam,
        buildingParam,
        floorParam,
        startParam,
        endParam,
        navigate,
    } = url;
    const routeInput = useMemo(() => {
        if (route === 'exam') return classParam || qParam || '';
        if (route === 'rooms') return roomQuery || buildingParam || '';
        if (route === 'search') return qParam || '';
        return '';
    }, [buildingParam, classParam, qParam, roomQuery, route]);
    const [inputDraft, setInputDraft] = useState(() => ({ routeInput, value: routeInput }));
    const inputValue = inputDraft.routeInput === routeInput ? inputDraft.value : routeInput;
    const onInputChange = useCallback((value: string) => {
        setInputDraft({ routeInput, value });
    }, [routeInput]);

    const submit = useCallback((value: string) => {
        const trimmed = value.trim();
        if (trimmed.length < 2) {
            navigate({ route: 'home' });
            return;
        }
        if (isCompleteClassQuery(trimmed)) {
            const className = normalizeClassQuery(trimmed);
            localStorage.setItem(SAVED_CLASS_KEY, className);
            navigate({ route: 'exam', params: { class: className } });
            return;
        }
        const roomParams = roomRouteParams(trimmed);
        if (roomParams) {
            if (Object.keys(roomParams).length === 0) {
                navigate({ route: 'rooms', params: savedRoomParams() || {} });
            } else {
                saveRoomParams(roomParams);
                navigate({ route: 'rooms', params: roomParams });
            }
            return;
        }
        if (isExamHelperQuery(trimmed) || isClassLookupQuery(trimmed)) {
            navigate({ route: 'exam', params: { q: trimmed } });
            return;
        }
        navigate({ route: 'search', params: { q: trimmed } });
    }, [navigate]);

    const quickSearch = useCallback((intent: ProductIntent) => {
        if (intent.kind === 'exam') {
            const savedClass = localStorage.getItem(SAVED_CLASS_KEY);
            if (savedClass) {
                navigate({ route: 'exam', params: { class: savedClass } });
                return;
            }
            navigate({ route: 'exam', params: { q: '考试安排' } });
            return;
        }
        if (intent.kind === 'rooms') {
            navigate({ route: 'rooms', params: savedRoomParams() || {} });
            return;
        }
        navigate({ route: 'search', params: { q: intent.query } });
    }, [navigate]);

    return {
        route,
        inputValue,
        onInputChange,
        onSubmit: submit,
        onQuickSearch: quickSearch,
        onGoHome: () => navigate({ route: 'home' }),
        search: { query: qParam || '' },
        exam: { query: qParam || '', className: classParam },
        rooms: {
            query: roomQuery || '',
            date: dateParam,
            campus: campusParam,
            building: buildingParam,
            floor: floorParam,
            start: startParam,
            end: endParam,
        },
        navigateRooms: (params: Record<string, string | null>, replace = false) => {
            saveRoomParams(params);
            navigate({ route: 'rooms', params }, replace);
        },
    };
}
