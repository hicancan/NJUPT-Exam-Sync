export interface Exam {
    id: string;
    stable_key: string;
    history_key: string;
    content_fingerprint: string;
    exam_period_id: string;
    class_name: string;
    course_name: string;
    course_code: string;
    teacher: string;
    campus: string;
    location: string;
    raw_time: string;
    count: number;
    start_timestamp: string;
    end_timestamp: string;
    duration_minutes: number;
    date: string;
    notes: string;
}
