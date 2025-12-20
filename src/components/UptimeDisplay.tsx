import { useState, useEffect } from 'react';
import { APP_CONFIG } from '@/constants';

interface UptimeDisplayProps {
    startTime?: string;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
}

export function UptimeDisplay({
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
        <div className="space-y-3">
            {/* 数据来源 - 最重要的信息放在最上面 */}
            {sourceUrl && (
                <p className="text-slate-500">
                    数据来源: <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-500 hover:text-indigo-600 hover:underline transition-colors font-medium"
                        title="点击查看教务处原始通知"
                    >
                        {sourceTitle || '教务处通知'} ↗
                    </a>
                </p>
            )}

            {/* 同步机制说明 - 强调持续运行而不是显示可能过时的时间 */}
            <p className="text-slate-400">
                与官方数据保持同步 · <span className="font-medium">每6小时自动核对</span>
            </p>

            {/* 运行状态和访问量 */}
            <div className="flex items-center justify-center gap-3 text-slate-400 pt-1">
                <span className="text-xs">
                    已稳定运行 <span className="font-mono text-indigo-500 font-medium">{uptime}</span>
                </span>
                <span className="opacity-30">|</span>
                <img
                    src={APP_CONFIG.VISITOR_BADGE_URL}
                    className="h-4 w-auto opacity-80 hover:opacity-100 transition-opacity"
                    alt="visitor count"
                    loading="lazy"
                />
            </div>
        </div>
    );
}
