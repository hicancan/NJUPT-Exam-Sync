import { BellIcon } from '@heroicons/react/24/outline';

interface ReminderSettingsProps {
    selected: number[];
    onChange: (reminders: number[]) => void;
}

export function ReminderSettings({ selected, onChange }: ReminderSettingsProps) {
    const options = [
        { value: 15, label: '15分钟前' },
        { value: 30, label: '30分钟前' },
        { value: 60, label: '1小时前' },
        { value: 1440, label: '1天前' },
    ];

    const toggleOption = (val: number) => {
        if (selected.includes(val)) {
            onChange(selected.filter(v => v !== val));
        } else {
            onChange([...selected, val].sort((a, b) => a - b));
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
                <BellIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">考前提醒设置</h3>
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const isActive = selected.includes(opt.value);
                    return (
                        <button
                            key={opt.value}
                            onClick={() => toggleOption(opt.value)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border
                                ${isActive
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-slate-500'
                                }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

