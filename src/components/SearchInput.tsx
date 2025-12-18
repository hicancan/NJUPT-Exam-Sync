import { useRef, useEffect } from 'react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto focus on mount
        inputRef.current?.focus();
    }, []);

    return (
        <div className="relative mb-6 z-20 shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
            </div>
            <input
                ref={inputRef}
                type="text"
                className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                placeholder="输入班级号 (例如 B240402)..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}
