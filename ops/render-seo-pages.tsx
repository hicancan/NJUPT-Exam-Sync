import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { StaticNotFoundPage, StaticRoutePage } from '../apps/web/src/app/seo/StaticRoutePage';
import { renderPageHead, resolvePageSeo } from '../apps/web/src/app/seo/pageSeo';
import type { AppRoute } from '../apps/web/src/app/routing/useUrlState';

const readArgument = (name: string): string | null => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] ?? null : null;
};

const distArgument = readArgument('--dist') ?? process.env.NJUPT_SEARCH_WEB_OUT_DIR;
if (!distArgument) throw new Error('SEO rendering requires --dist or NJUPT_SEARCH_WEB_OUT_DIR');

const dist = resolve(distArgument);
const templatePath = join(dist, 'index.html');
const builtTemplate = readFileSync(templatePath, 'utf8');
const template = builtTemplate.replace('<!-- njupt-seo:head -->', renderPageHead(resolvePageSeo('home')));
const headPattern = /<!-- njupt-seo:start -->[\s\S]*?<!-- njupt-seo:end -->/;
const rootPattern = /<div id="root">[\s\S]*?<\/div>/;

if (!headPattern.test(template)) throw new Error('Built HTML is missing the managed SEO head');
if (!rootPattern.test(template)) throw new Error('Built HTML is missing the empty React root');

const writeHtml = (relativePath: string, html: string): void => {
    const destination = join(dist, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, html, 'utf8');
};

const renderRoute = (route: AppRoute): string => template
    .replace(headPattern, renderPageHead(resolvePageSeo(route)))
    .replace(rootPattern, `<div id="root">${renderToStaticMarkup(createElement(StaticRoutePage, { route }))}</div>`);

writeHtml('index.html', renderRoute('home'));
writeHtml('exam/index.html', renderRoute('exam'));
writeHtml('search/index.html', renderRoute('search'));
writeHtml('community/index.html', renderRoute('community'));
writeHtml('materials/index.html', renderRoute('materials'));
writeHtml('timetable/index.html', renderRoute('timetable'));
writeHtml('classrooms/index.html', renderRoute('classrooms'));

const notFoundHead = renderPageHead({
    title: '页面不存在｜njupt-search',
    description: '找不到这个页面。',
    pathname: '/',
    indexable: false,
    canonical: null,
    websiteStructuredData: false,
});
const notFound = template
    .replace(headPattern, notFoundHead)
    .replace(rootPattern, `<div id="root">${renderToStaticMarkup(createElement(StaticNotFoundPage))}</div>`)
    .replace(/\s*<script type="module"[^>]*>[\s\S]*?<\/script>/g, '');
writeHtml('404.html', notFound);
