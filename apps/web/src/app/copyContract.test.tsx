import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppFooter } from '@/app/shell/AppFooter';
import { SearchStatus } from '@/search/ui/SearchStatus';
import { SearchSection } from '@/search/ui/SearchSection';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import { resultSummary } from '@/search/ui/searchLabels';

describe('product copy contract', () => {
    it('describes search results without exposing ranking internals', () => {
        expect(resultSummary({}, 10, 180)).toBe('找到 180 条相关结果，已显示前 10 条。');
        expect(resultSummary({ sourceId: 'source-a' }, 9, 9)).toBe('筛选后找到 9 条相关结果。');

        const status = renderToStaticMarkup(
            <SearchStatus documentCount={22052} statusText="找到 180 条相关结果。" />,
        );
        expect(status).toContain('已收录 22,052 条信息');
        expect(status).not.toContain('候选');
        expect(status).not.toContain('语料');
    });

    it('makes loading and empty search states clear and actionable', () => {
        const baseProps = {
            documentCount: 22052,
            response: null,
            sortMode: 'relevance' as const,
            datePreset: 'all' as const,
            filterOptions: null,
            canLoadMore: false,
            onSortModeChange: () => undefined,
            onFiltersChange: () => undefined,
            onDatePresetChange: () => undefined,
            onLoadMore: () => undefined,
        };
        const loading = renderToStaticMarkup(
            <SearchSection {...baseProps} query="肖甫" searching filters={{}} />,
        );
        const empty = renderToStaticMarkup(
            <SearchSection {...baseProps} query="肖甫" searching={false} filters={{}} />,
        );
        const filteredEmpty = renderToStaticMarkup(
            <SearchSection {...baseProps} query="肖甫" searching={false} filters={{ sourceId: 'scie' }} />,
        );

        expect(loading).toContain('正在搜索…');
        expect(loading).not.toMatch(/倒排索引|正文块/);
        expect(empty).toContain('没有找到相关结果。');
        expect(empty).toContain('换个关键词试试。');
        expect(filteredEmpty).toContain('没有符合筛选条件的结果。');
        expect(filteredEmpty).toContain('减少筛选条件后再试。');
    });

    it('keeps meaningful project status and uses a natural download label', () => {
        const html = renderToStaticMarkup(<><ThemeToggle /><AppFooter /></>);
        expect(html).toContain('已运行');
        expect(html).toContain('Android 安装包');
        expect(html).toContain('alt="访问量"');
        expect(html).toContain('aria-label="切换到深色模式"');
        expect(html).not.toContain('Android APK');
    });

    it('keeps temporary task reports out of the README', () => {
        const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
        for (const phrase of [
            '本轮完成了',
            '经过此次改造',
            '当前实际仓库路径',
            'CI run',
            '根据用户要求',
            '候选集合契约如下',
            '最近一次完整构建',
        ]) {
            expect(readme).not.toContain(phrase);
        }
        expect(readme).toContain('不用先猜信息在哪个网站');
        expect(readme).toContain('不知道通知发在哪个网站，也没关系。');
    });

    it('uses concise Chinese metadata for installation and sharing', () => {
        const manifest = JSON.parse(readFileSync(
            resolve(process.cwd(), 'apps/web/public/manifest.webmanifest'),
            'utf8',
        )) as { description: string; lang: string };
        const index = readFileSync(resolve(process.cwd(), 'apps/web/index.html'), 'utf8');

        expect(manifest.lang).toBe('zh-CN');
        expect(manifest.description).toBe('搜索南邮通知，查询考试安排和考试教室。');
        expect(index).toContain('南邮通知、考试安排和考试教室，都可以直接查。');
    });
});
