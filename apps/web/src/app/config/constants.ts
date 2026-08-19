function requiredArtifactUrl(name: string, value: string | undefined): string {
    const normalized = value?.trim().replace(/\/+$/, '');
    if (!normalized) throw new Error(`${name} artifact URL is required`);
    return normalized;
}

export const APP_CONFIG = {
    APP_NAME: 'njupt-search',
    PAGE_TITLE: '南邮信息查询',
    PAGE_SUBTITLE: '南邮通知、考试安排和考试教室，都可以直接查。',
    DOMAIN: 'njupt.hicancan.top',
    GITHUB_REPO: 'https://github.com/hicancan/njupt-search',
    ANDROID_APK: 'https://github.com/hicancan/njupt-search/releases/latest/download/njupt-search-latest.apk',
    BILIBILI_PAGE: 'https://space.bilibili.com/1144561698',
    VISITOR_BADGE_URL: 'https://visitor-badge.laobi.icu/badge?page_id=njupt.hicancan.top&left_text=%20%E8%AE%BF%E9%97%AE%E9%87%8F%20&right_color=%234F46E5',
    DATA_URLS: {
        SEARCH: requiredArtifactUrl(
            'SearchBundle',
            import.meta.env.VITE_NJUPT_SEARCH_ARTIFACT_URL,
        ),
        EXAM: requiredArtifactUrl(
            'ExamSnapshot',
            import.meta.env.VITE_NJUPT_EXAM_ARTIFACT_URL,
        ),
        ROOM: requiredArtifactUrl(
            'RoomOccupancy',
            import.meta.env.VITE_NJUPT_ROOM_ARTIFACT_URL,
        ),
    },
    START_TIME_DEFAULT: '2025-12-15T00:00:00',
    MAX_CLASS_DISPLAY_COUNT: 50,
    SEARCH_RESULT_LIMIT: 10,
    SEARCH_RESULT_MAX: 1000,
};
