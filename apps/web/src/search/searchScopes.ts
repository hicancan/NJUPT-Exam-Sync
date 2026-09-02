import type { AppRoute } from '@/app/routing/useUrlState';

export interface SearchScope {
    route: 'search' | 'community' | 'materials';
    title: string;
    description: string;
    placeholder: string;
    ariaLabel: string;
    sourceId?: string;
    sourceName?: string;
    sourceUrl?: string;
    excludedSourceIds?: readonly string[];
    supportsDates: boolean;
    quickQueries: readonly string[];
}

export const SEARCH_SCOPE_OPTIONS: readonly Pick<SearchScope, 'route' | 'title'>[] = [
    { route: 'search', title: '网站搜索' },
    { route: 'community', title: '社区搜索' },
    { route: 'materials', title: '资料搜索' },
] as const;

export const REPOSITORY_SEARCH_SOURCE_IDS = [
    'njupt-survival-guide',
    'njupt-general-free-exams',
] as const;

export const SEARCH_SCOPES: Record<SearchScope['route'], SearchScope> = {
    search: {
        route: 'search',
        title: '南邮网站搜索',
        description: '输入关键词，搜索学校各网站的通知、附件和办事信息。',
        placeholder: '搜索通知、附件和办事信息',
        ariaLabel: '搜索学校通知、附件和办事信息',
        excludedSourceIds: REPOSITORY_SEARCH_SOURCE_IDS,
        supportsDates: true,
        quickQueries: ['转专业', '奖学金', '校园卡', '计算机等级'],
    },
    community: {
        route: 'community',
        title: '南邮社区搜索',
        description: '搜索南邮生存手册中的校园生活、学习经验和办事指南。',
        placeholder: '搜索校园生活、学习经验和办事指南',
        ariaLabel: '搜索南邮生存手册',
        sourceId: 'njupt-survival-guide',
        sourceName: '南邮生存手册',
        sourceUrl: 'https://github.com/NJUPT-NAVI/NJUPT-Survival-Guide',
        supportsDates: false,
        quickQueries: ['校园网', '宿舍', '选课', '开发环境'],
    },
    materials: {
        route: 'materials',
        title: '南邮资料搜索',
        description: '搜索南邮课程资料、历年试卷、课件和复习笔记。',
        placeholder: '搜索课程、试卷、课件和复习资料',
        ariaLabel: '搜索南邮课程资料',
        sourceId: 'njupt-general-free-exams',
        sourceName: '南邮历年资料',
        sourceUrl: 'https://github.com/NJUPTFreeExams/NJUPT-General-Free-Exams',
        supportsDates: false,
        quickQueries: ['高等数学', '大学物理', '数据结构', '概率论'],
    },
};

export const searchScopeForRoute = (route: AppRoute | undefined): SearchScope => {
    if (route === 'community' || route === 'materials') return SEARCH_SCOPES[route];
    return SEARCH_SCOPES.search;
};
