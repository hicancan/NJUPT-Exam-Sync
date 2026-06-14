import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    isClassLookupQuery,
    isCompleteClassQuery,
    isExamHelperQuery,
    normalizeClassQuery,
} from '@/features/query-router/model/examQuery';
import { parseRoomSearchInput } from '@/features/room-occupancy/model/roomOccupancy';
import { useUrlState } from '@/features/query-router/model/useUrlState';

const SAVED_CLASS_KEY = 'SAVED_CLASS';

const roomRouteParams = (value: string): Record<string, string | null> | null => {
    const target = parseRoomSearchInput(value);
    if (!target) return null;
    if (target.kind === 'entry') return {};
    if (target.kind === 'building') {
        return { building: target.building, campus: target.campus };
    }
    return { room: target.display };
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
    const [inputValue, setInputValue] = useState(routeInput);

    useEffect(() => {
        setInputValue(routeInput);
    }, [routeInput]);

    useEffect(() => {
        if (window.location.search && !window.location.hash) {
            if (classParam) {
                navigate({ route: 'exam', params: { class: classParam } }, true);
            } else if (qParam) {
                const query = qParam;
                if (isExamHelperQuery(query) || isClassLookupQuery(query)) {
                    navigate({ route: 'exam', params: { q: query } }, true);
                } else {
                    const roomParams = roomRouteParams(query);
                    if (roomParams) {
                        navigate({ route: 'rooms', params: roomParams }, true);
                        return;
                    }
                    navigate({ route: 'search', params: { q: query } }, true);
                }
            }
        }
    }, [classParam, navigate, qParam]);

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
            navigate({ route: 'rooms', params: roomParams });
            return;
        }
        if (isExamHelperQuery(trimmed) || isClassLookupQuery(trimmed)) {
            navigate({ route: 'exam', params: { q: trimmed } });
            return;
        }
        navigate({ route: 'search', params: { q: trimmed } });
    }, [navigate]);

    const quickSearch = useCallback((query: string) => {
        if (query === '考试安排') {
            const savedClass = localStorage.getItem(SAVED_CLASS_KEY);
            if (savedClass) {
                navigate({ route: 'exam', params: { class: savedClass.toUpperCase() } });
                return;
            }
            navigate({ route: 'exam', params: { q: query } });
            return;
        }
        const roomParams = roomRouteParams(query);
        if (roomParams) {
            navigate({ route: 'rooms', params: roomParams });
            return;
        }
        submit(query);
    }, [navigate, submit]);

    return {
        route,
        inputValue,
        onInputChange: setInputValue,
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
            navigate({ route: 'rooms', params }, replace);
        },
    };
}
