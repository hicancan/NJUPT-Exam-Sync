import { useState, useEffect, useMemo } from 'react';
import UptimeDisplay from './components/UptimeDisplay';
import ThemeToggle from './components/ThemeToggle';
import ExamCard from './components/ExamCard';
import ReminderSettings from './components/ReminderSettings';
import { generateICSContent } from './utils/icsGenerator';

function App() {
    const [allExams, setAllExams] = useState([]);
    const [updateTime, setUpdateTime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [manualSelection, setManualSelection] = useState(null);
    const [reminders, setReminders] = useState([30, 60]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [copyState, setCopyState] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const classFromUrl = urlParams.get('class');
        if (classFromUrl) {
            setInputValue(classFromUrl);
            setManualSelection(classFromUrl);
        }

        const fetchOptions = { cache: 'no-cache' };

        Promise.all([
            fetch('data/all_exams.json', fetchOptions).then(r => r.json()),
            fetch('data/data_summary.json', fetchOptions).then(r => r.json()).catch(() => null)
        ])
            .then(([examsData, manifestData]) => {
                examsData.sort((a, b) => {
                    if (a.start_timestamp && b.start_timestamp) {
                        return a.start_timestamp.localeCompare(b.start_timestamp);
                    }
                    return a.start_timestamp ? -1 : 1;
                });

                setAllExams(examsData);

                if (manifestData && manifestData.generated_at) {
                    const date = new Date(manifestData.generated_at);
                    setUpdateTime(date.toLocaleString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    }));
                }

                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError('无法加载数据，请检查网络连接 (data/all_exams.json)');
                setLoading(false);
            });
    }, []);

    const searchResult = useMemo(() => {
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
            setSelectedIds(new Set(searchResult.exams.map(e => e.id)));
            const newUrl = `${window.location.pathname}?class=${searchResult.classes[0]}`;
            window.history.replaceState(null, '', newUrl);
        } else if (searchResult.mode === 'EMPTY') {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [searchResult.exams, searchResult.mode, searchResult.classes]);

    const handleInput = (val) => {
        setInputValue(val);
        if (manualSelection && val !== manualSelection) {
            setManualSelection(null);
        }
    };

    const handleClassClick = (cls) => {
        setInputValue(cls);
        setManualSelection(cls);
    };

    const toggleExamSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const copyShareLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopyState(true);
            setTimeout(() => setCopyState(false), 2000);
        });
    };

    const downloadICS = () => {
        const { exams, classes } = searchResult;
        const selectedExams = exams.filter(e => selectedIds.has(e.id));
        const validExams = selectedExams.filter(e => e.start_timestamp);

        if (validExams.length === 0) {
            alert('请至少勾选一门包含有效时间的考试');
            return;
        }

        const className = classes[0] || 'Schedule';
        const content = generateICSContent(validExams, className, reminders);
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `NJUPT_Exams_${className}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        <span>📅</span> NJUPT Exam Sync
                    </span>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <a href="https://hicancan.top" target="_blank" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full">
                            ← 回到 hicancan.top
                        </a>
                    </div>
                </div>
            </nav>

            <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 flex flex-col">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">考试日程助手</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">南邮学子专属 · 班级号极速查询 · hicancan 强力驱动</p>
                </header>

                <div className="relative mb-6 z-20 shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <input
                        type="text"
                        className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                        placeholder="输入班级号 (例如 B240402)..."
                        value={inputValue}
                        onChange={(e) => handleInput(e.target.value)}
                        autoFocus
                    />
                </div>

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
                        <div className="fade-in">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    匹配到 {searchResult.classes.length} 个班级
                                </h2>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {searchResult.classes.slice(0, 50).map(cls => (
                                    <button
                                        key={cls}
                                        onClick={() => handleClassClick(cls)}
                                        className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-left hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all text-sm font-medium font-mono text-slate-600 dark:text-slate-300"
                                    >
                                        {cls}
                                    </button>
                                ))}
                            </div>
                            {searchResult.classes.length > 50 && (
                                <p className="text-center text-xs text-slate-400 mt-6">
                                    结果较多，请继续输入以筛选...
                                </p>
                            )}
                        </div>
                    )}

                    {searchResult.mode === 'DETAIL' && (
                        <div className="fade-in pb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-mono tracking-tight">
                                            {searchResult.classes[0]}
                                        </h2>
                                        <button
                                            onClick={copyShareLink}
                                            className={`text-xs px-2 py-1 rounded border transition-all ${copyState
                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                                : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-indigo-500 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800'
                                                }`}
                                        >
                                            {copyState ? '✅ 已复制' : '🔗 分享链接'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">
                                        已选 {selectedIds.size} / {searchResult.exams.length} 门考试
                                    </p>
                                </div>
                                <button
                                    onClick={downloadICS}
                                    disabled={selectedIds.size === 0}
                                    className={`
                                        inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shrink-0
                                        ${selectedIds.size > 0
                                            ? 'bg-slate-900 hover:bg-black text-white shadow-slate-200'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                                    `}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    导出日历
                                </button>
                            </div>

                            <ReminderSettings selected={reminders} onChange={setReminders} />

                            <div className="space-y-4">
                                {searchResult.exams.map((exam, idx) => (
                                    <ExamCard
                                        key={exam.id || idx}
                                        exam={exam}
                                        isSelected={selectedIds.has(exam.id)}
                                        onToggle={() => toggleExamSelection(exam.id)}
                                    />
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                                <p className="text-xs text-slate-400">
                                    请务必登录教务系统核对，一切以官方最新通知为准
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="py-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-center">
                <div className="text-xs text-slate-400 dark:text-slate-500 space-y-4">
                    <div className="flex justify-center gap-6">
                        <a href="https://github.com/hicancan/njupt-exam-sync" target="_blank" className="group flex items-center gap-1.5 transition-colors hover:text-slate-800 dark:hover:text-slate-300" title="GitHub Code Repository">
                            <svg className="w-4 h-4 fill-current opacity-80 group-hover:opacity-100" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                            <span>github仓库</span>
                        </a>
                        <a href="https://space.bilibili.com/1144561698" target="_blank" className="group flex items-center gap-1.5 transition-colors hover:text-[#FB7299]" title="Bilibili Homepage">
                            <svg className="w-4 h-4 fill-current opacity-80 group-hover:opacity-100" viewBox="0 0 24 24"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773-1.004.996-2.264 1.52-3.773 1.574H5.333c-1.51-.054-2.77-.578-3.773-1.574-1.005-.995-1.525-2.249-1.561-3.76v-7.36c.036-1.511.556-2.765 1.561-3.76 1.003-.996 2.264-1.52 3.773-1.574h.854l-1.99-1.99a.633.633 0 0 1-.186-.464.633.633 0 0 1 .186-.465c.123-.124.278-.186.464-.186.186 0 .341.062.465.186l2.36 2.36h2.827l2.365-2.36a.633.633 0 0 1 .465-.186.633.633 0 0 1 .186.465.633.633 0 0 1-.186.464l-1.995 1.99zM6.933 9.453c-.63 0-1.14.51-1.14 1.14 0 .63.51 1.14 1.14 1.14.63 0 1.14-.51 1.14-1.14 0-.63-.51-1.14-1.14-1.14zm9.334 0c-.63 0-1.14.51-1.14 1.14 0 .63.51 1.14 1.14 1.14.63 0 1.14-.51 1.14-1.14 0-.63-.51-1.14-1.14-1.14z" /></svg>
                            <span>bilibili主页</span>
                        </a>
                    </div>

                    <UptimeDisplay lastUpdate={updateTime} />

                    <p>
                        © {new Date().getFullYear()} <a href="https://hicancan.top" className="hover:text-indigo-600 transition-colors">hicancan.top</a> · All Rights Reserved
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default App;