import { SearchInput } from '@/shared/ui/SearchInput';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';
import type { AppRoute } from '@/app/routing/useUrlState';

interface HeaderProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSubmit: (value: string) => void;
    onGoHome: () => void;
    route?: AppRoute;
}

const routeSearch = (route: AppRoute | undefined): { placeholder: string; label: string } => {
    if (route === 'exam') return { placeholder: '搜索班级、课程或考试安排', label: '在考试安排中搜索' };
    if (route === 'timetable') return { placeholder: '搜索班级、课程、教师或教学安排', label: '在班级课表中搜索' };
    if (route === 'classrooms') return { placeholder: '搜索校区、楼栋、楼层或教室', label: '在教室中搜索' };
    return { placeholder: '搜索通知、附件和办事信息', label: '搜索学校通知、附件和办事信息' };
};

export function Header({ inputValue, onInputChange, onSubmit, onGoHome, route }: HeaderProps) {
    const search = routeSearch(route);
    return (
        <header className="sticky top-0 z-40 border-b border-[#dadce0] dark:border-[#3c4043] bg-white/95 dark:bg-[#202124]/95 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
                <a
                    href="/"
                    onClick={(event) => {
                        event.preventDefault();
                        onGoHome();
                    }}
                    className="flex items-center gap-2 shrink-0 text-left sm:w-[140px]"
                    aria-label="回到 njupt-search 首页"
                >
                    <img src="/assets/logo.png" alt="" className="w-8 h-8 rounded-md" />
                    <div className="hidden sm:block font-semibold leading-tight text-[#202124] dark:text-[#e8eaed]">
                        njupt-search
                    </div>
                </a>
                <div className="flex-1 min-w-0 max-w-[692px]">
                    <SearchInput value={inputValue} onChange={onInputChange} onSubmit={onSubmit} autoFocus={false} placeholder={search.placeholder} ariaLabel={search.label} />
                </div>
                <ThemeToggle />
            </div>
        </header>
    );
}
