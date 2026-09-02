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
        },
        navigateTimetable,
        navigateClassrooms,
        navigateSearchScope,
    };
}
