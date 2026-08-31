import { useCallback, useMemo, useState } from 'react';
import { useUrlState } from './useUrlState';
import type { ProductIntent } from './intents';
import {
    parseSavedClass,
    parseSavedRoomRoute,
    resolveQuickIntent,
    resolveSubmission,
} from './routeContract';

const SAVED_CLASS_KEY = 'SAVED_CLASS';
const SAVED_TIMETABLE_CLASS_KEY = 'SAVED_TIMETABLE_CLASS';
const SAVED_ROOM_KEY = 'SAVED_ROOM_TARGET';

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
        weekParam,
        weekdayParam,
        periodParam,
        navigate,
    } = url;
    const routeInput = useMemo(() => {
        if (route === 'exam') return classParam || qParam || '';
        if (route === 'timetable') return classParam || '';
        if (route === 'rooms') return roomQuery || buildingParam || '';
        if (route === 'search') return qParam || '';
        return '';
    }, [buildingParam, classParam, qParam, roomQuery, route]);
    const [inputDraft, setInputDraft] = useState(() => ({ routeInput, value: routeInput }));
    const inputValue = inputDraft.routeInput === routeInput ? inputDraft.value : routeInput;
    const onInputChange = useCallback((value: string) => {
        setInputDraft({ routeInput, value });
    }, [routeInput]);
    const savedClass = parseSavedClass(localStorage.getItem(SAVED_CLASS_KEY));
    const savedTimetableClass = parseSavedClass(localStorage.getItem(SAVED_TIMETABLE_CLASS_KEY));
    const savedRoom = parseSavedRoomRoute(localStorage.getItem(SAVED_ROOM_KEY));

    const submit = useCallback((value: string) => {
        const destination = resolveSubmission(value);
        const className = destination.route === 'exam' ? destination.params?.class : null;
        if (className) localStorage.setItem(SAVED_CLASS_KEY, className);
        if (destination.route === 'rooms' && destination.params) saveRoomParams(destination.params);
        navigate(destination);
    }, [navigate]);

    const quickSearch = useCallback((intent: ProductIntent) => {
        navigate(resolveQuickIntent(intent));
    }, [navigate]);

    const navigateRooms = useCallback((params: Record<string, string | null>, replace = false) => {
        saveRoomParams(params);
        navigate({ route: 'rooms', params }, replace);
    }, [navigate]);
    const navigateTimetable = useCallback((params: Record<string, string | null>, replace = false) => {
        if (params.class) localStorage.setItem(SAVED_TIMETABLE_CLASS_KEY, params.class);
        navigate({ route: 'timetable', params }, replace);
    }, [navigate]);
    const navigateClassrooms = useCallback((params: Record<string, string | null>, replace = false) => {
        navigate({ route: 'classrooms', params }, replace);
    }, [navigate]);

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
            className: classParam,
            week: weekParam && /^\d+$/.test(weekParam) ? Number(weekParam) : null,
            savedClass: savedTimetableClass,
        },
        classrooms: {
            week: weekParam && /^\d+$/.test(weekParam) ? Number(weekParam) : null,
            weekday: weekdayParam && /^[1-7]$/.test(weekdayParam) ? Number(weekdayParam) : null,
            period: periodParam && /^\d+$/.test(periodParam) ? Number(periodParam) : null,
            campus: campusParam,
            building: buildingParam,
            floor: floorParam,
        },
        rooms: {
            query: roomQuery || '',
            date: dateParam,
            campus: campusParam,
            building: buildingParam,
            floor: floorParam,
            start: startParam,
            end: endParam,
            savedRoom,
        },
        navigateRooms,
        navigateTimetable,
        navigateClassrooms,
    };
}
