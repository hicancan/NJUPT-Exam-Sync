import { useState, useEffect, useMemo } from 'react';
import { UptimeDisplay } from './components/UptimeDisplay';
import { ThemeToggle } from './components/ThemeToggle';
import { SearchInput } from './components/SearchInput';
import { ExamList } from './components/ExamList';
import { ExamDetail } from './components/ExamDetail';
import { SearchResult } from '@/types';
import { APP_CONFIG } from '@/constants';
import { useExamData } from '@/hooks/useExamData';

function App() {
    const { exams: allExams, loading, error, sourceUrl, sourceTitle } = useExamData();

    // UI State
    const [inputValue, setInputValue] = useState<string>(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('class') || '';
    });
    const [manualSelection, setManualSelection] = useState<string | null>(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('class') || null;
    });
    const [reminders, setReminders] = useState<number[]>([30, 60]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const searchResult = useMemo<SearchResult>(() => {
        if (!inputValue || inputValue.length < 2) {
            return { mode: 'EMPTY', classes: [], exams: [] };
        }
        const term = inputValue.trim().toUpperCase();
        if (manualSelection) {
            return {
                mode: 'DETAIL',
                classes: [manualSelection],
                exams: allExams.filter(e => e.class_name === manualSelection)
            };
        }
        const matchedExams = allExams.filter(e =>
            e.class_name && e.class_name.toUpperCase().includes(term)
        );
        const uniqueClasses = Array.from(new Set(matchedExams.map(e => e.class_name))).sort();
        if (uniqueClasses.length === 0) return { mode: 'NOT_FOUND', classes: [], exams: [] };
        if (uniqueClasses.length === 1) {
            return { mode: 'DETAIL', classes: uniqueClasses, exams: matchedExams };
        }
        return { mode: 'LIST', classes: uniqueClasses, exams: [] };
    }, [allExams, inputValue, manualSelection]);

    useEffect(() => {
        if (searchResult.mode === 'DETAIL' && searchResult.exams.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync selection when search finds a unique class
            setSelectedIds(new Set(searchResult.exams.map(e => e.id)));
            const newUrl = `${window.location.pathname}?class=${searchResult.classes[0]}`;
            window.history.replaceState(null, '', newUrl);
        } else if (searchResult.mode === 'EMPTY') {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [searchResult.exams, searchResult.mode, searchResult.classes]);

    const handleInput = (val: string) => {
        setInputValue(val);
        if (manualSelection && val !== manualSelection) {
            setManualSelection(null);
        }
    };

    const handleClassClick = (cls: string) => {
        setInputValue(cls);
        setManualSelection(cls);
    };

    const toggleExamSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
            <div className="flex flex-col items-center gap-3 animate-pulse">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">数据同步中...</span>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 text-center text-red-500">
                <div className="text-3xl mb-2">⚠️</div>
                {error}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200">
            <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <span className="font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <span>📅</span> {APP_CONFIG.APP_NAME}
                    </span>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <a href={`https://${APP_CONFIG.DOMAIN}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full">
                            ← 回到 {APP_CONFIG.DOMAIN}
                        </a>
                    </div>
                </div>
            </nav>

            <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 flex flex-col">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">{APP_CONFIG.PAGE_TITLE}</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{APP_CONFIG.PAGE_SUBTITLE}</p>
                </header>

                <SearchInput value={inputValue} onChange={handleInput} />

                <div className="flex-1">
                    {searchResult.mode === 'EMPTY' && (
                        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-800/50">
                            <div className="text-4xl mb-4 opacity-20 dark:opacity-40">📅</div>
                            <p className="text-slate-400 dark:text-slate-500 font-medium">请输入班级号开始查找</p>
                        </div>
                    )}

                    {searchResult.mode === 'NOT_FOUND' && (
                        <div className="text-center py-12">
                            <p className="text-slate-400 dark:text-slate-500">未找到相关班级 "{inputValue}"</p>
                        </div>
                    )}

                    {searchResult.mode === 'LIST' && (
                        <ExamList
                            classes={searchResult.classes}
                            onClassClick={handleClassClick}
                        />
                    )}

                    {searchResult.mode === 'DETAIL' && (
                        <ExamDetail
                            className={searchResult.classes[0] || ''}
                            exams={searchResult.exams}
                            selectedIds={selectedIds}
                            onToggleSelection={toggleExamSelection}
                            reminders={reminders}
                            onRemindersChange={setReminders}
                        />
                    )}
                </div>
            </div>

            <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-center">
                <div className="text-xs text-slate-400 dark:text-slate-500 space-y-6">
                    <div className="flex justify-center gap-8 mb-8">
                        <a href={APP_CONFIG.GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 transition-colors hover:text-slate-800 dark:hover:text-slate-300" title="GitHub Code Repository">
                            <svg className="w-5 h-5 fill-current opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                            <span className="font-medium">GitHub 仓库</span>
                        </a>
                        <a href={APP_CONFIG.BILIBILI_PAGE} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 transition-colors hover:text-[#FB7299]" title="Bilibili Homepage">
                            <svg className="w-5 h-5 fill-current opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773-1.004.996-2.264 1.52-3.773 1.574H5.333c-1.51-.054-2.77-.578-3.773-1.574-1.005-.995-1.525-2.249-1.561-3.76v-7.36c.036-1.511.556-2.765 1.561-3.76 1.003-.996 2.264-1.52 3.773-1.574h.854l-1.99-1.99a.633.633 0 0 1-.186-.464.633.633 0 0 1 .186-.465c.123-.124.278-.186.464-.186.186 0 .341.062.465.186l2.36 2.36h2.827l2.365-2.36a.633.633 0 0 1 .465-.186.633.633 0 0 1 .186.465.633.633 0 0 1-.186.464l-1.995 1.99zM6.933 9.453c-.63 0-1.14.51-1.14 1.14 0 .63.51 1.14 1.14 1.14.63 0 1.14-.51 1.14-1.14 0-.63-.51-1.14-1.14-1.14zm9.334 0c-.63 0-1.14.51-1.14 1.14 0 .63.51 1.14 1.14 1.14.63 0 1.14-.51 1.14-1.14 0-.63-.51-1.14-1.14-1.14z" /></svg>
                            <span className="font-medium">Bilibili 主页</span>
                        </a>
                    </div>

                    <UptimeDisplay
                        sourceUrl={sourceUrl}
                        sourceTitle={sourceTitle}
                    />

                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/50 w-full max-w-sm mx-auto">
                        <p className="opacity-60 hover:opacity-100 transition-opacity duration-300">
                            © {new Date().getFullYear()} <a href={`https://${APP_CONFIG.DOMAIN}`} className="hover:text-indigo-600 transition-colors font-medium">{APP_CONFIG.DOMAIN}</a>
                        </p>
                        <p className="mt-1 opacity-40 scale-90">All Rights Reserved</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;