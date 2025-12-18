export interface Exam {
    id: string; // generated unique id
    class_name: string; // e.g., "B240402"
    course_name: string; // Normalized field: e.g., "大学物理"
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
    count?: number;
    raw_time?: string;
}

export interface Manifest {
    generated_at: string; // ISO string
    total_records?: number; // From Python script
    total_exams?: number; // Optional legacy field
    total_classes?: number; // Optional legacy field
    files_processed?: string[]; // List of processed Excel files
}

export type SearchMode = 'EMPTY' | 'NOT_FOUND' | 'LIST' | 'DETAIL';

export interface SearchResult {
    mode: SearchMode;
    classes: string[];
    exams: Exam[];
}
