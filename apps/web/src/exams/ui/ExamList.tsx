
import { ChevronRight } from 'lucide-react';
import { APP_CONFIG } from '@/app/config/constants';

interface ExamListProps {
    classes: string[];
    onClassClick: (className: string) => void;
}

export function ExamList({ classes, onClassClick }: ExamListProps) {
    const displayClasses = classes.slice(0, APP_CONFIG.MAX_CLASS_DISPLAY_COUNT);
    const hasMore = classes.length > APP_CONFIG.MAX_CLASS_DISPLAY_COUNT;

    return (
        <div className="w-full mt-2 fade-in">
            <div className="text-[14px] text-[#70757a] dark:text-[#9aa0a6] mb-6">
                找到 {classes.length} 个班级
            </div>
            
            <div className="flex flex-wrap gap-3">
                {displayClasses.map((cls, index) => (
                    <button 
                        key={index} 
                        onClick={() => onClassClick(cls)}
                        className="px-5 py-2.5 bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#5f6368] rounded-full text-[15px] text-[#1a0dab] dark:text-[#8ab4f8] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] hover:border-[#d2e3fc] dark:hover:border-[#8ab4f8]/30 transition-all shadow-sm hover:shadow active:scale-95 flex items-center gap-2"
                    >
                        <span>{cls}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
                    </button>
                ))}
            </div>

            {hasMore && (
                <p className="text-center text-sm text-[var(--color-google-grey)] dark:text-[var(--color-google-grey-dark)] mt-10 pb-10">
                    结果较多，请输入完整班级号缩小范围。
                </p>
            )}
        </div>
    );
}
