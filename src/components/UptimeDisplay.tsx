import { useState, useEffect } from 'react';
import { APP_CONFIG } from '@/constants';

interface UptimeDisplayProps {
    lastUpdate: string | null;
    startTime?: string;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
}

export function UptimeDisplay({
    lastUpdate,
    startTime = APP_CONFIG.START_TIME_DEFAULT,
    sourceUrl,
    sourceTitle
}: UptimeDisplayProps) {
    const [uptime, setUptime] = useState<string>('');

    useEffect(() => {
        const start = new Date(startTime);
        const updateTimer = () => {
            const diff = new Date().getTime() - start.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setUptime(`${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`);
        };
        const timer = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(timer);
    }, [startTime]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 text-slate-400">
                <span>
                    已稳定运行 <span className="font-mono text-indigo-500 font-medium px-1">{uptime}</span>
                </span>
                <span className="opacity-30">|</span>
                <img
                    src={APP_CONFIG.VISITOR_BADGE_URL}
                    className="h-4 w-auto opacity-80 hover:opacity-100 transition-opacity"
                    alt="visitor count"
                    loading="lazy"
                />
            </div>

            <p className="text-slate-500">
                自动同步于 <span className="font-mono font-medium">{lastUpdate || '获取中...'}</span>
            </p>

            {sourceUrl && (
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                    官方数据源: <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 hover:underline transition-colors" title={sourceTitle || '点击查看教务通知'}>
                        {sourceTitle || '教务处通知'}
                    </a>
                </p>
            )}
        </div>
    );
}
