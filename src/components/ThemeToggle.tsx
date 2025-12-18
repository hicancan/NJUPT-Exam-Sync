import { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

function ThemeToggle() {
    const [isDark, setIsDark] = useState<boolean>(() => {
        // Initialize state from local storage or system preference
        if (typeof window === 'undefined') return false;
        const saved = localStorage.getItem('theme');
        const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return saved === 'dark' || (!saved && preferDark);
    });

    useEffect(() => {
        // Sync state to DOM and local storage
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggleTheme = () => {
        setIsDark(prev => !prev);
    };

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            title={isDark ? "切换到亮色模式" : "切换到暗黑模式"}
        >
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
    );
}

export { ThemeToggle };
