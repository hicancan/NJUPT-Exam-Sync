interface ExamListProps {
    classes: string[];
    onClassClick: (cls: string) => void;
}

export function ExamList({ classes, onClassClick }: ExamListProps) {
    return (
        <div className="fade-in">
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    匹配到 {classes.length} 个班级
                </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {classes.slice(0, 50).map(cls => (
                    <button
                        key={cls}
                        onClick={() => onClassClick(cls)}
                        className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-left hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all text-sm font-medium font-mono text-slate-600 dark:text-slate-300"
                    >
                        {cls}
                    </button>
                ))}
            </div>
            {classes.length > 50 && (
                <p className="text-center text-xs text-slate-400 mt-6">
                    结果较多，请继续输入以筛选...
                </p>
            )}
        </div>
    );
}
