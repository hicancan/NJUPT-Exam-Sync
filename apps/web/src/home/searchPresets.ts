export type QuickSearchIcon =
    | 'timetable'
    | 'classrooms'
    | 'calendar'
    | 'shuffle'
    | 'download'
    | 'trophy'
    | 'file-text'
    | 'book-open'
    | 'library';

export type QuickSearchGroup = '教务搜索' | '校园信息' | '社区搜索' | '资料搜索';

export interface QuickSearchPreset {
    label: string;
    icon: QuickSearchIcon;
    intent: ProductIntent;
    group: QuickSearchGroup;
}

export const QUICK_SEARCHES: QuickSearchPreset[] = [
    { label: '班级课表', icon: 'timetable', intent: { kind: 'timetable' }, group: '教务搜索' },
    { label: '教室', icon: 'classrooms', intent: { kind: 'classrooms' }, group: '教务搜索' },
    { label: '考试安排', icon: 'calendar', intent: { kind: 'exam' }, group: '教务搜索' },
    { label: '校历', icon: 'calendar', intent: { kind: 'search', query: '校历' }, group: '校园信息' },
    { label: '四六级', icon: 'file-text', intent: { kind: 'search', query: '四六级' }, group: '校园信息' },
    { label: '计算机等级', icon: 'file-text', intent: { kind: 'search', query: '计算机等级' }, group: '校园信息' },
    { label: '普通话', icon: 'file-text', intent: { kind: 'search', query: '普通话考试' }, group: '校园信息' },
    { label: '竞赛报名', icon: 'trophy', intent: { kind: 'search', query: '竞赛报名' }, group: '校园信息' },
    { label: '奖学金', icon: 'trophy', intent: { kind: 'search', query: '奖学金' }, group: '校园信息' },
    { label: '南邮生存手册', icon: 'book-open', intent: { kind: 'community' }, group: '社区搜索' },
    { label: '历年课程资料', icon: 'library', intent: { kind: 'materials' }, group: '资料搜索' },
];
import type { ProductIntent } from '@/app/routing/intents';
