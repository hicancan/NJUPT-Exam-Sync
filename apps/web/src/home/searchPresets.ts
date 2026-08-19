export type QuickSearchIcon =
    | 'calendar'
    | 'shuffle'
    | 'download'
    | 'waypoints'
    | 'trophy'
    | 'file-text';

export interface QuickSearchPreset {
    label: string;
    icon: QuickSearchIcon;
    intent: ProductIntent;
}

export const QUICK_SEARCHES: QuickSearchPreset[] = [
    { label: '考试安排', icon: 'calendar', intent: { kind: 'exam' } },
    { label: '考试占用教室', icon: 'waypoints', intent: { kind: 'rooms' } },
    { label: '校历', icon: 'calendar', intent: { kind: 'search', query: '校历' } },
    { label: '四六级', icon: 'file-text', intent: { kind: 'search', query: '四六级' } },
    { label: '计算机等级', icon: 'file-text', intent: { kind: 'search', query: '计算机等级' } },
    { label: '普通话', icon: 'file-text', intent: { kind: 'search', query: '普通话考试' } },
    { label: '比赛报名', icon: 'trophy', intent: { kind: 'search', query: '竞赛报名' } },
    { label: '奖学金', icon: 'trophy', intent: { kind: 'search', query: '奖学金' } },
    { label: '大创', icon: 'trophy', intent: { kind: 'search', query: '大创' } },
];
import type { ProductIntent } from '@/app/routing/intents';
