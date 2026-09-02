import { useCallback, useMemo, useState } from 'react';
import { useUrlState } from './useUrlState';
import type { ProductIntent } from './intents';
import {
    parseSavedClass,
    resolveQuickIntent,
    resolveRouteSubmission,
    resolveSubmission,
} from './routeContract';

const SAVED_CLASS_KEY = 'SAVED_CLASS';
const SAVED_TIMETABLE_CLASS_KEY = 'SAVED_TIMETABLE_CLASS';
const SAVED_CLASSROOM_QUERY_KEY = 'SAVED_CLASSROOM_QUERY';

const CLASSROOM_QUERY_KEYS = ['date', 'week', 'weekday', 'period', 'campus', 'building', 'floor', 'room'] as const;
export type SavedClassroomQuery = Partial<Record<(typeof CLASSROOM_QUERY_KEYS)[number], string>>;

export const parseSavedClassroomQuery = (raw: string | null): SavedClassroomQuery | null => {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as unknown;
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const record = value as Record<string, unknown>;
        if (Object.keys(record).some(key => !CLASSROOM_QUERY_KEYS.includes(key as (typeof CLASSROOM_QUERY_KEYS)[number]))) return null;
        const result = Object.fromEntries(
            CLASSROOM_QUERY_KEYS.flatMap(key => typeof record[key] === 'string' && record[key] ? [[key, record[key]]] : []),
        ) as SavedClassroomQuery;
        return result.campus ? result : null;
    } catch {
        return null;
    }
};

export function useAppRouter() {
    const url = useUrlState();
    const {
        route,
        qParam,
        classParam,
        dateParam,
        campusParam,
        buildingParam,
        floorParam,
        roomParam,
        weekParam,
        weekdayParam,
        periodParam,
        navigate,
    } = url;
    const routeInput = useMemo(() => {
        if (route === 'exam') return classParam || qParam || '';
        if (route === 'timetable') return classParam || qParam || '';
        if (route === 'search' || route === 'community' || route === 'materials') return qParam || '';
        if (route === 'classrooms') return qParam || buildingParam || floorParam || '';
        return '';
    }, [buildingParam, classParam, floorParam, qParam, route]);
    const [inputDraft, setInputDraft] = useState(() => ({ routeInput, value: routeInput }));
    const inputValue = inputDraft.routeInput === routeInput ? inputDraft.value : routeInput;
    const onInputChange = useCallback((value: string) => {
        setInputDraft({ routeInput, value });
    }, [routeInput]);
    const savedClass = parseSavedClass(localStorage.getItem(SAVED_CLASS_KEY));
    const savedTimetableClass = parseSavedClass(localStorage.getItem(SAVED_TIMETABLE_CLASS_KEY));
    const savedClassroomQuery = parseSavedClassroomQuery(localStorage.getItem(SAVED_CLASSROOM_QUERY_KEY));

    const submit = useCallback((value: string) => {
        const destination = route === 'home' ? resolveSubmission(value) : resolveRouteSubmission(route, value);
        const className = destination.route === 'exam' || destination.route === 'timetable'
            ? destination.params?.class
            : null;
        if (className) {
            localStorage.setItem(
                destination.route === 'timetable' ? SAVED_TIMETABLE_CLASS_KEY : SAVED_CLASS_KEY,
                className,
            );
        }
        navigate(destination);
    }, [navigate, route]);

    const quickSearch = useCallback((intent: ProductIntent) => {
        navigate(resolveQuickIntent(intent));
    }, [navigate]);

    const navigateTimetable = useCallback((params: Record<string, string | null>, replace = false) => {
        if (params.class) localStorage.setItem(SAVED_TIMETABLE_CLASS_KEY, params.class);
        navigate({ route: 'timetable', params }, replace);
    }, [navigate]);
    const navigateClassrooms = useCallback((params: Record<string, string | null>, replace = false) => {
        if (params.campus) {
            const saved = Object.fromEntries(
                CLASSROOM_QUERY_KEYS.flatMap(key => typeof params[key] === 'string' && params[key] ? [[key, params[key]]] : []),
            );
            localStorage.setItem(SAVED_CLASSROOM_QUERY_KEY, JSON.stringify(saved));
        }
        navigate({ route: 'classrooms', params }, replace);
    }, [navigate]);
    const navigateSearchScope = useCallback((nextRoute: 'search' | 'community' | 'materials') => {
        navigate({ route: nextRoute, params: { q: qParam } });
    }, [navigate, qParam]);

    return {
        route,
        hasQueryParams: url.search.length > 1,
        inputValue,
        onInputChange,
        onSubmit: submit,
        onQuickSearch: quickSearch,
        onGoHome: () => navigate({ route: 'home' }),
        search: { query: qParam || '' },
        exam: { query: qParam || '', className: classParam, savedClass },
        timetable: {
            query: qParam || '',
            className: classParam,
            week: weekParam && /^\d+$/.test(weekParam) ? Number(weekParam) : null,
            savedClass: savedTimetableClass,
        },
        classrooms: {
            query: qParam || '',
            date: dateParam,
            week: weekParam && /^\d+$/.test(weekParam) ? Number(weekParam) : null,
            weekday: weekdayParam && /^[1-7]$/.test(weekdayParam) ? Number(weekdayParam) : null,
            period: periodParam && /^\d+$/.test(periodParam) ? Number(periodParam) : null,
            campus: campusParam,
            building: buildingParam,
            floor: floorParam,
            room: roomParam,
            savedQuery: savedClassroomQuery,
        },
        navigateTimetable,
        navigateClassrooms,
        navigateSearchScope,
    };
}
