import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppFooter } from '@/app/shell/AppFooter';
import { SearchStatus } from '@/search/ui/SearchStatus';
import { SearchSection } from '@/search/ui/SearchSection';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import { resultSummary } from '@/search/ui/searchLabels';
import { HomePage } from '@/home/HomePage';
import { renderPageHead, resolvePageSeo } from '@/app/seo/pageSeo';
import { SearchInput } from '@/shared/ui/SearchInput';

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
        expect(html).toContain('Android');
        expect(html).not.toContain('Android 安装包');
        expect(html).toContain('alt="访问量"');
        expect(html).toContain('aria-label="切换到深色模式"');
        expect(html).not.toContain('Android APK');
    });

    it('keeps the home page focused on search without a subtitle', () => {
        const html = renderToStaticMarkup(
            <HomePage
                inputValue=""
                onQuickSearch={() => undefined}
                onInputChange={() => undefined}
                onSubmit={() => undefined}
                onSearchWarm={() => undefined}
                onIntentWarm={() => undefined}
            />,
        );
        expect(html).toContain('njupt-search');
        expect(html).not.toContain('南邮通知、考试安排和考试教室，都可以直接查。');
    });

    it('offers an explicit accessible search submission action', () => {
        const html = renderToStaticMarkup(
            <SearchInput value="B240402" onChange={() => undefined} onSubmit={() => undefined} />,
        );
        expect(html).toContain('type="submit"');
        expect(html).toContain('aria-label="提交搜索"');
    });

    it('keeps the README focused on the product and reusable local commands', () => {
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
        expect(readme).toContain('南京邮电大学校园信息搜索');
        expect(readme).toContain('这个项目没有后端的搜索 API');
        expect(readme).toContain("$corpusPath = 'D:\\path\\to\\njupt-corpus'");
        expect(readme).not.toContain('可以分享、刷新，也能正常前进和后退');
        expect(readme).not.toContain('为速度和可靠性做的选择');
    });

    it('uses concise Chinese metadata for installation and sharing', () => {
        const manifest = JSON.parse(readFileSync(
            resolve(process.cwd(), 'apps/web/public/manifest.webmanifest'),
            'utf8',
        )) as { description: string; lang: string };
        const indexTemplate = readFileSync(resolve(process.cwd(), 'apps/web/index.html'), 'utf8');
        const homeHead = renderPageHead(resolvePageSeo('home'));

        expect(manifest.lang).toBe('zh-CN');
        expect(manifest.description).toBe('搜索南邮通知，查询考试安排和考试教室。');
        expect(indexTemplate).toContain('<!-- njupt-seo:head -->');
        expect(homeHead).toContain('njupt-search｜南邮校园信息搜索');
        expect(homeHead).toContain('搜索南京邮电大学各网站的通知、附件和办事信息，查询班级考试安排与考试教室。');
        expect(homeHead).not.toContain('meta name="keywords"');
        expect(homeHead).not.toContain('南邮通知、考试安排和考试教室，都可以直接查。');
    });

    it('keeps stable products indexable and query states out of the index', () => {
        expect(resolvePageSeo('home')).toMatchObject({ indexable: true, canonical: 'https://njupt.hicancan.top/' });
        expect(resolvePageSeo('exam')).toMatchObject({ indexable: true, canonical: 'https://njupt.hicancan.top/exam' });
        expect(resolvePageSeo('rooms')).toMatchObject({ indexable: true, canonical: 'https://njupt.hicancan.top/rooms' });
        expect(resolvePageSeo('search')).toMatchObject({ indexable: true, canonical: 'https://njupt.hicancan.top/search' });
        expect(resolvePageSeo('exam', true)).toMatchObject({ indexable: false, canonical: null });
        expect(resolvePageSeo('rooms', true)).toMatchObject({ indexable: false, canonical: null });
        expect(resolvePageSeo('search', true)).toMatchObject({ indexable: false, canonical: null });

        const homeHead = renderPageHead(resolvePageSeo('home'));
        const examDetailHead = renderPageHead(resolvePageSeo('exam', true));
        expect(homeHead).toContain('"@type":"WebSite"');
        expect(homeHead).not.toContain('"@type":"Organization"');
        expect(examDetailHead).toContain('noindex, follow');
        expect(examDetailHead).not.toContain('rel="canonical"');
        expect(examDetailHead).not.toContain('application/ld+json');
    });

    it('keeps pathname routing and Android entry points on clean URLs', () => {
        const routing = readFileSync(resolve(process.cwd(), 'apps/web/src/app/routing/useUrlState.ts'), 'utf8');
        const twa = JSON.parse(readFileSync(
            resolve(process.cwd(), 'apps/android/twa-manifest.json'),
            'utf8',
        )) as { startUrl: string };

        expect(routing).toContain('window.location.pathname');
        expect(routing).toContain("window.addEventListener('popstate'");
        expect(routing).not.toContain('location.hash');
        expect(routing).not.toContain('hashchange');
        expect(routing).not.toContain("'#/");
        expect(twa.startUrl).toBe('/');
    });
});
