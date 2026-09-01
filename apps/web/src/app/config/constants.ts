import { PRODUCT_CONFIG } from './product';

function requiredArtifactUrl(name: string, value: string | undefined): string {
    const normalized = value?.trim().replace(/\/+$/, '');
    if (!normalized) throw new Error(`${name} artifact URL is required`);
    return normalized;
}

export const APP_CONFIG = {
    ...PRODUCT_CONFIG,
    PAGE_TITLE: '南邮信息查询',
    DOMAIN: 'njupt.hicancan.top',
    DATA_URLS: {
        SEARCH: requiredArtifactUrl(
            'SearchBundle',
            import.meta.env.VITE_NJUPT_SEARCH_ARTIFACT_URL,
        ),
        EXAM: requiredArtifactUrl(
            'ExamSnapshot',
            import.meta.env.VITE_NJUPT_EXAM_ARTIFACT_URL,
        ),
        EXAM_HISTORY: requiredArtifactUrl(
            'ExamHistory',
            import.meta.env.VITE_NJUPT_EXAM_HISTORY_ARTIFACT_URL,
        ),
        ROOM: requiredArtifactUrl(
            'RoomOccupancy',
            import.meta.env.VITE_NJUPT_ROOM_ARTIFACT_URL,
        ),
        TIMETABLE: requiredArtifactUrl(
            'TeachingSchedule',
            import.meta.env.VITE_NJUPT_TIMETABLE_ARTIFACT_URL,
        ),
        CLASSROOMS: requiredArtifactUrl(
            'TeachingRoomOccupancy',
            import.meta.env.VITE_NJUPT_CLASSROOMS_ARTIFACT_URL,
        ),
        SPACE: requiredArtifactUrl(
            'SpaceSnapshot',
            import.meta.env.VITE_NJUPT_SPACE_ARTIFACT_URL,
        ),
    },
    MAX_CLASS_DISPLAY_COUNT: 50,
    SEARCH_RESULT_LIMIT: 10,
    SEARCH_RESULT_MAX: 1000,
};
