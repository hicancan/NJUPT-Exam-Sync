const ReminderSettings = ({ selected, onChange }) => {
    const options = [
        { label: '15分钟', value: 15 },
        { label: '30分钟', value: 30 },
        { label: '1小时', value: 60 },
        { label: '2小时', value: 120 },
        { label: '1天', value: 1440 }
    ];

    const toggle = (val) => {
        if (selected.includes(val)) {
            onChange(selected.filter(v => v !== val));
        } else {
            onChange([...selected, val].sort((a, b) => a - b));
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">🔔 考前提醒设置</h3>
                <span className="text-[10px] text-slate-400">仅对勾选的考试生效</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const active = selected.includes(opt.value);
                    return (
                        <button
                            key={opt.value}
                            onClick={() => toggle(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${active
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                }`}
                        >
                            {active && <span className="mr-1">✓</span>}
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ReminderSettings;
