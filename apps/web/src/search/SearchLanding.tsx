import { Globe2, LibraryBig, MessagesSquare } from 'lucide-react';
import { ProductLandingCard } from '@/shared/ui/ProductLandingCard';
import type { SearchScope } from './searchScopes';
import { SEARCH_SCOPES } from './searchScopes';

interface SearchLandingProps {
    scope?: SearchScope;
    onSearch?: (query: string) => void;
}

const iconForScope = (scope: SearchScope) => {
    if (scope.route === 'community') return <MessagesSquare className="h-7 w-7" aria-hidden="true" />;
    if (scope.route === 'materials') return <LibraryBig className="h-7 w-7" aria-hidden="true" />;
    return <Globe2 className="h-7 w-7" aria-hidden="true" />;
};

export function SearchLanding({ scope = SEARCH_SCOPES.search, onSearch }: SearchLandingProps) {
    return (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:py-12">
            <ProductLandingCard icon={iconForScope(scope)} title={scope.title} description={scope.description}>
                <div className="mt-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#5f6368] dark:text-[#bdc1c6]">快速搜索</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {scope.quickQueries.map(query => (
                            <a
                                key={query}
                                href={`/${scope.route}?q=${encodeURIComponent(query)}`}
                                onClick={event => {
                                    if (!onSearch) return;
                                    event.preventDefault();
                                    onSearch(query);
                                }}
                                className="rounded-full border border-[#d2e3fc] bg-white px-4 py-2 text-sm font-medium text-[#174ea6] transition hover:bg-[#e8f0fe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:border-[#405985] dark:bg-[#202124] dark:text-[#8ab4f8] dark:hover:bg-[#23334d]"
                            >
                                {query}
                            </a>
                        ))}
                    </div>
                </div>
                {scope.sourceUrl && scope.sourceName ? (
                    <a
                        className="mt-6 inline-flex text-[13px] text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
                        href={scope.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        内容来源：{scope.sourceName}
                    </a>
                ) : null}
                <noscript>
                    <p className="mt-4 text-[14px] text-[#5f6368] dark:text-[#bdc1c6]">启用 JavaScript 后即可搜索。</p>
                </noscript>
            </ProductLandingCard>
        </main>
    );
}
