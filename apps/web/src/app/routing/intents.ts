export type ProductIntent =
    | { kind: 'exam' }
    | { kind: 'rooms' }
    | { kind: 'search'; query: string };
