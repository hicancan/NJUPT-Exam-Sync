export type ProductIntent =
    | { kind: 'timetable' }
    | { kind: 'classrooms' }
    | { kind: 'exam' }
    | { kind: 'search'; query: string };
