export type ProductIntent =
    | { kind: 'timetable' }
    | { kind: 'classrooms' }
    | { kind: 'exam' }
    | { kind: 'community' }
    | { kind: 'materials' }
    | { kind: 'search'; query: string };
