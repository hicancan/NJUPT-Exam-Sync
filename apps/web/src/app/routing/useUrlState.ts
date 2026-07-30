import { useCallback, useEffect, useState } from 'react';

export type AppRoute = 'home' | 'search' | 'exam' | 'rooms';

export interface UrlState {
    route: AppRoute;
    classParam: string | null;
    qParam: string | null;
    roomQuery: string | null;
    dateParam: string | null;
    campusParam: string | null;
    buildingParam: string | null;
    floorParam: string | null;
    startParam: string | null;
    endParam: string | null;
}

interface NavigateOptions {
    route: AppRoute;
    params?: Record<string, string | null>;
}

const routeFromHashPath = (path: string): AppRoute => {
    if (path === '/search') return 'search';
    if (path === '/exam') return 'exam';
    if (path === '/rooms') return 'rooms';
    return 'home';
};

const readUrlState = (): UrlState => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const [hashPath = '/', hashSearch = ''] = hash.split('?');
    const hashParams = new URLSearchParams(hashSearch);
    const route = routeFromHashPath(hashPath || '/');

    return {
        route,
        classParam: hashParams.get('class') || null,
        qParam: hashParams.get('q') || null,
        roomQuery: hashParams.get('room') || null,
        dateParam: hashParams.get('date') || null,
        campusParam: hashParams.get('campus') || null,
        buildingParam: hashParams.get('building') || null,
        floorParam: hashParams.get('floor') || null,
        startParam: hashParams.get('start') || null,
        endParam: hashParams.get('end') || null,
    };
};

const buildHash = ({ route, params = {} }: NavigateOptions): string => {
    if (route === 'home') return window.location.pathname;
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value) nextParams.set(key, value);
    });
    const query = nextParams.toString();
    return `${window.location.pathname}#/${route}${query ? `?${query}` : ''}`;
};

export function useUrlState() {
    const [state, setState] = useState<UrlState>(() => readUrlState());

    useEffect(() => {
        const handleLocationChange = () => setState(readUrlState());
        window.addEventListener('popstate', handleLocationChange);
        window.addEventListener('hashchange', handleLocationChange);
        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            window.removeEventListener('hashchange', handleLocationChange);
        };
    }, []);

    const navigate = useCallback((options: NavigateOptions, replace = false) => {
        const nextUrl = buildHash(options);
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
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
