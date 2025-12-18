export interface Exam {
    id: string; // generated unique id
    class_name: string; // e.g., "B240402"
    course_name: string; // e.g., "大学物理"
    start_time: string; // e.g., "2025-01-08 14:00"
    end_time: string; // e.g., "2025-01-08 16:00"
    location: string; // e.g., "教2-201"
    start_timestamp?: string; // ISO string for sorting, e.g., "2025-01-08T14:00:00"
    end_timestamp?: string;
    duration_minutes?: number;
    teacher?: string;
    notes?: string;
    campus?: string;
    course_code?: string;
    count?: string | number;
    course?: string; // Original UI uses 'course' instead of 'course_name'
    raw_time?: string;
}

export interface Manifest {
    generated_at: string; // ISO string
    total_exams: number;
    total_classes: number;
}

export type SearchMode = 'EMPTY' | 'NOT_FOUND' | 'LIST' | 'DETAIL';

export interface SearchResult {
    mode: SearchMode;
    classes: string[];
    exams: Exam[];
}
