export type ProductIntent =
    | { kind: 'timetable' }
    | { kind: 'classrooms' }
    | { kind: 'exam' }
    | { kind: 'rooms' }
    | { kind: 'search'; query: string };
