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
    const legacyParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const [hashPath = '/', hashSearch = ''] = hash.split('?');
    const hashParams = new URLSearchParams(hashSearch);
    const route = hash ? routeFromHashPath(hashPath || '/') : 'home';
    const params = hash ? hashParams : legacyParams;
    const legacyClass = legacyParams.get('class') || null;
    const legacyQuery = legacyParams.get('q') || null;

    return {
        route: hash ? route : (legacyClass ? 'exam' : legacyQuery ? 'search' : 'home'),
        classParam: params.get('class') || legacyClass || null,
        qParam: params.get('q') || legacyQuery || null,
        roomQuery: params.get('room') || null,
        dateParam: params.get('date') || null,
        campusParam: params.get('campus') || null,
        buildingParam: params.get('building') || null,
        floorParam: params.get('floor') || null,
        startParam: params.get('start') || null,
        endParam: params.get('end') || null,
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
