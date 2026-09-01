import type { SearchScope } from './searchScopes';
import { SEARCH_SCOPES } from './searchScopes';

export function SearchLanding({ scope = SEARCH_SCOPES.search }: { scope?: SearchScope }) {
    return (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-8 pb-8">
            <h1 className="text-[28px] font-normal text-[#202124] dark:text-[#e8eaed]">{scope.title}</h1>
            <p className="mt-2 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">
                {scope.description}
            </p>
            {scope.sourceUrl && scope.sourceName ? (
                <a
                    className="mt-3 inline-flex text-[13px] text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
                    href={scope.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    查看内容来源：{scope.sourceName}
                </a>
            ) : null}
            <noscript>
                <p className="mt-4 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">启用 JavaScript 后即可搜索。</p>
            </noscript>
        </main>
    );
}
