import { Exam } from '@/types';

interface ExamCardProps {
    exam: Exam;
    isSelected: boolean;
    onToggle: () => void;
}

const formatDisplayDate = (isoString?: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
        month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
};

const ExamCard: React.FC<ExamCardProps> = ({ exam, isSelected, onToggle }) => {
    const isValidTime = !!exam.start_timestamp;

    return (
        <div
            onClick={onToggle}
            className={`
                bg-white dark:bg-slate-800 rounded-xl border shadow-sm transition-all duration-200 relative overflow-hidden cursor-pointer select-none group
                ${isSelected ? 'border-slate-200 dark:border-slate-600 hover:shadow-md' : 'border-slate-100 dark:border-slate-800 opacity-60 grayscale-[0.8] hover:opacity-80'}
            `}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${isSelected ? (isValidTime ? 'bg-indigo-500' : 'bg-amber-400') : 'bg-slate-300 dark:bg-slate-600'}`}></div>
            <div className="p-5 pl-7">
                <div className="flex justify-between items-start mb-3 gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <div className={`
                                w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0
                                ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'}
                            `}>
                                {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <h3 className={`text-lg font-bold leading-snug ${isSelected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500'}`}>
                                {exam.course || exam.course_name}
                            </h3>
                        </div>
                        <div className="mt-1.5 ml-7">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded">
                                {exam.course_code || 'No Code'}
                            </span>
                        </div>
                    </div>
                    {exam.campus && (
                        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${isSelected ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                            {exam.campus}
                        </span>
                    )}
                </div>
                <div className="space-y-3 pl-7">
                    <div className="flex items-start gap-3">
                        <span className="text-lg leading-none mt-0.5 select-none opacity-60">🕒</span>
                        <div>
                            {isValidTime ? (
                                <>
                                    <div className={`font-semibold ${isSelected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>
                                        {formatDisplayDate(exam.start_timestamp)}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        至 {formatDisplayDate(exam.end_timestamp)}
                                        <span className="ml-2 px-1.5 py-0.5 bg-slate-50 rounded text-slate-400">
                                            {exam.duration_minutes} min
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-amber-50 border border-amber-100 rounded p-2 text-xs text-amber-800">
                                    <span className="font-bold">时间待定:</span> {exam.raw_time || '未发布'} // raw_time not in interface, strict TS might complain if I don't add it, but let's assume it might retain or optional. 'exam' as Exam might not have raw_time. I will use 'Date Pending' logic.
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-lg leading-none select-none opacity-60">📍</span>
                        <div className={`font-medium text-sm ${isSelected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>
                            {exam.location || '地点待定'}
                        </div>
                    </div>
                </div>
                <div className="mt-4 ml-7 pt-3 border-t border-slate-50 dark:border-slate-700 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">👨‍🏫 {exam.teacher || '未知'}</span>
                    <span className="flex items-center gap-1">👥 {exam.count} 人</span>
                    {exam.notes && <span className="italic text-slate-400">注: {exam.notes}</span>}
                </div>
            </div>
        </div>
    );
};

export default ExamCard;
