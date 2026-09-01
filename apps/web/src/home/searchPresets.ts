export type QuickSearchIcon =
    | 'timetable'
    | 'classrooms'
    | 'calendar'
    | 'shuffle'
    | 'download'
    | 'trophy'
    | 'file-text';

export interface QuickSearchPreset {
    label: string;
    icon: QuickSearchIcon;
    intent: ProductIntent;
    group: '日常教学' | '考试' | '校园信息';
}

export const QUICK_SEARCHES: QuickSearchPreset[] = [
    { label: '班级课表', icon: 'timetable', intent: { kind: 'timetable' }, group: '日常教学' },
    { label: '教室空间', icon: 'classrooms', intent: { kind: 'classrooms' }, group: '日常教学' },
    { label: '考试安排', icon: 'calendar', intent: { kind: 'exam' }, group: '考试' },
    { label: '校历', icon: 'calendar', intent: { kind: 'search', query: '校历' }, group: '校园信息' },
    { label: '四六级', icon: 'file-text', intent: { kind: 'search', query: '四六级' }, group: '校园信息' },
    { label: '计算机等级', icon: 'file-text', intent: { kind: 'search', query: '计算机等级' }, group: '校园信息' },
    { label: '普通话', icon: 'file-text', intent: { kind: 'search', query: '普通话考试' }, group: '校园信息' },
    { label: '竞赛报名', icon: 'trophy', intent: { kind: 'search', query: '竞赛报名' }, group: '校园信息' },
    { label: '奖学金', icon: 'trophy', intent: { kind: 'search', query: '奖学金' }, group: '校园信息' },
];
import type { ProductIntent } from '@/app/routing/intents';
