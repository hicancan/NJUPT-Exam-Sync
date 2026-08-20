import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argumentIndex = process.argv.indexOf('--dist');
const distArgument = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : process.env.NJUPT_SEARCH_WEB_OUT_DIR;
if (!distArgument) throw new Error('SEO validation requires --dist or NJUPT_SEARCH_WEB_OUT_DIR');
const dist = resolve(distArgument);

const read = relativePath => readFileSync(join(dist, relativePath), 'utf8');
const failures = [];
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};
const occurrences = (value, pattern) => value.match(pattern)?.length ?? 0;

const pages = [
    {
        file: 'index.html',
        title: 'njupt-search｜南邮校园信息搜索',
        description: '搜索南京邮电大学各网站的通知、附件和办事信息，查询班级考试安排与考试教室。',
        canonical: 'https://njupt.hicancan.top/',
        h1: 'njupt-search',
        structured: true,
    },
    {
        file: 'exam/index.html',
        title: '南邮考试安排查询｜njupt-search',
        description: '输入班级号，查询南京邮电大学考试时间、地点和考场，并可导出日历。',
        canonical: 'https://njupt.hicancan.top/exam',
        h1: '查询考试安排',
    },
    {
        file: 'rooms/index.html',
        title: '南邮考试教室查询｜njupt-search',
        description: '按日期、校区、楼栋和楼层查看南京邮电大学考试期间的教室占用情况。',
        canonical: 'https://njupt.hicancan.top/rooms',
        h1: '考试教室查询',
    },
];

for (const page of pages) {
    const html = read(page.file);
    assert(html.includes(`<title>${page.title}</title>`), `${page.file}: title mismatch`);
    assert(html.includes(`name="description" content="${page.description}"`), `${page.file}: description mismatch`);
    assert(html.includes('name="robots" content="index, follow"'), `${page.file}: index policy mismatch`);
    assert(html.includes(`rel="canonical" href="${page.canonical}"`), `${page.file}: canonical mismatch`);
    assert(html.includes('property="og:site_name" content="njupt-search"'), `${page.file}: missing og:site_name`);
    assert(html.includes('property="og:image:alt" content="njupt-search 标志"'), `${page.file}: missing image alt`);
    assert(html.includes(`>${page.h1}</h1>`), `${page.file}: expected H1 content is missing`);
    assert(occurrences(html, /<h1\b/g) === 1, `${page.file}: expected exactly one H1`);
    assert(html.includes('data-seo-query-policy'), `${page.file}: missing query noindex guard`);
    assert(!html.includes('南邮通知、考试安排和考试教室，都可以直接查。'), `${page.file}: deleted home copy returned`);
    assert(!html.includes('meta name="keywords"'), `${page.file}: obsolete keywords metadata returned`);
    if (page.structured) {
        const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        assert(Boolean(match), `${page.file}: missing WebSite JSON-LD`);
        if (match) {
            const data = JSON.parse(match[1]);
            assert(data['@type'] === 'WebSite', `${page.file}: JSON-LD is not WebSite`);
            assert(!html.includes('"@type":"Organization"'), `${page.file}: false Organization structured data`);
        }
    } else {
        assert(!html.includes('<script type="application/ld+json">'), `${page.file}: WebSite JSON-LD must be homepage-only`);
    }
}

const home = read('index.html');
for (const href of ['/exam', '/rooms']) {
    assert(home.includes(`href="${href}"`), `index.html: missing crawlable ${href} link`);
}

const search = read('search/index.html');
assert(search.includes('name="robots" content="noindex, follow"'), 'search/index.html: missing noindex');
assert(!search.includes('rel="canonical"'), 'search/index.html: noindex page has a canonical');
assert(occurrences(search, /<h1\b/g) === 1, 'search/index.html: expected exactly one H1');

const notFound = read('404.html');
assert(notFound.includes('name="robots" content="noindex, follow"'), '404.html: missing noindex');
assert(!notFound.includes('<script type="module"'), '404.html: must not start the application');
assert(occurrences(notFound, /<h1\b/g) === 1, '404.html: expected exactly one H1');

const robots = read('robots.txt').trim();
assert(robots === 'User-agent: *\nAllow: /\n\nSitemap: https://njupt.hicancan.top/sitemap.xml', 'robots.txt: content mismatch');

const sitemap = read('sitemap.xml');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert(JSON.stringify(locations) === JSON.stringify([
    'https://njupt.hicancan.top/',
    'https://njupt.hicancan.top/exam',
    'https://njupt.hicancan.top/rooms',
]), 'sitemap.xml: canonical URL set mismatch');
assert(locations.every(location => !location.includes('#') && !location.includes('?')), 'sitemap.xml: hash or query URL found');
assert(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'sitemap.xml: invalid XML declaration');

const edgeone = JSON.parse(read('edgeone.json'));
const rewrites = edgeone.rewrites ?? [];
assert(JSON.stringify(rewrites) === JSON.stringify([
    { source: '/exam', destination: '/exam/index.html' },
    { source: '/rooms', destination: '/rooms/index.html' },
    { source: '/search', destination: '/search/index.html' },
]), 'edgeone.json: clean route rewrites mismatch');
assert(!rewrites.some(rewrite => rewrite.source.includes('*')), 'edgeone.json: catch-all page fallback found');
const searchHeaders = (edgeone.headers ?? []).find(rule => rule.source === '/search')?.headers ?? [];
assert(searchHeaders.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex, follow'), 'edgeone.json: search response noindex is missing');
for (const source of ['/generated/search/*', '/generated/exam/*', '/generated/rooms/*']) {
    const headers = (edgeone.headers ?? []).find(rule => rule.source === source)?.headers ?? [];
    assert(headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex, nofollow'), `edgeone.json: ${source} robots header is missing`);
}

for (const file of ['index.html', 'exam/index.html', 'rooms/index.html', 'search/index.html']) {
    const html = read(file);
    assert(!html.includes('#/'), `${file}: hash route found in production HTML`);
    assert(!/class="[^"]*(?:sr-only|hidden)[^"]*"[^>]*>[^<]*(?:南邮校园信息|考试安排|考试教室)/.test(html), `${file}: hidden SEO copy found`);
}

if (failures.length) {
    throw new Error(`SEO validation failed:\n- ${failures.join('\n- ')}`);
}
console.log(`SEO validation passed for ${dist}`);
