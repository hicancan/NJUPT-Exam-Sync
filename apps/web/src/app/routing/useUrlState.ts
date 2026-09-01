import { useCallback, useEffect, useState } from 'react';

export type AppRoute = 'home' | 'search' | 'timetable' | 'classrooms' | 'exam';

export interface UrlState {
    route: AppRoute;
    search: string;
    classParam: string | null;
    qParam: string | null;
    dateParam: string | null;
    campusParam: string | null;
    buildingParam: string | null;
    floorParam: string | null;
    roomParam: string | null;
    weekParam: string | null;
    weekdayParam: string | null;
    periodParam: string | null;
}

export interface NavigateOptions {
    route: AppRoute;
    params?: Record<string, string | null>;
}

export const routeFromPathname = (pathname: string): AppRoute => {
    if (pathname === '/') return 'home';
    if (pathname === '/search') return 'search';
    if (pathname === '/exam') return 'exam';
    if (pathname === '/timetable') return 'timetable';
    if (pathname === '/classrooms') return 'classrooms';
    throw new Error(`Unsupported application route: ${pathname}`);
};

export const parseUrlState = (pathname: string, search: string): UrlState => {
    const params = new URLSearchParams(search);
    return {
        route: routeFromPathname(pathname),
        search,
        classParam: params.get('class') || null,
        qParam: params.get('q') || null,
        dateParam: params.get('date') || null,
        campusParam: params.get('campus') || null,
        buildingParam: params.get('building') || null,
        floorParam: params.get('floor') || null,
        roomParam: params.get('room') || null,
        weekParam: params.get('week') || null,
        weekdayParam: params.get('weekday') || null,
        periodParam: params.get('period') || null,
    };
};

const readUrlState = (): UrlState => parseUrlState(window.location.pathname, window.location.search);

export const buildPath = ({ route, params = {} }: NavigateOptions): string => {
    const pathname = route === 'home' ? '/' : `/${route}`;
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value) nextParams.set(key, value);
    });
    const query = nextParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
};

export function useUrlState() {
    const [state, setState] = useState<UrlState>(() => readUrlState());

    useEffect(() => {
        const handleLocationChange = () => setState(readUrlState());
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const navigate = useCallback((options: NavigateOptions, replace = false) => {
        const nextUrl = buildPath(options);
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl === nextUrl) return;
        if (replace) {
            window.history.replaceState(null, '', nextUrl);
        } else {
            window.history.pushState(null, '', nextUrl);
        }
        setState(readUrlState());
    }, []);

    return { ...state, navigate };
}
