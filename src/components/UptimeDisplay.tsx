import { useState, useEffect } from 'react';

interface UptimeDisplayProps {
    lastUpdate: string | null;
    startTime?: string;
}

function UptimeDisplay({ lastUpdate, startTime = '2025-12-15T00:00:00' }: UptimeDisplayProps) {
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
        <div className="space-y-1">
            <p>
                已稳定运行: <span className="font-mono text-indigo-500 font-medium">{uptime}</span>
                <span className="mx-2 text-slate-300">|</span>
                <img
                    src="https://visitor-badge.laobi.icu/badge?page_id=njupt.hicancan.top&left_text=%20%E8%AE%BF%E9%97%AE%E9%87%8F%20&right_color=%234F46E5"
                    className="inline-block h-5 w-auto ml-1 align-middle"
                    alt="visitor count"
                    loading="lazy"
                />
            </p>
            <p>
                数据最后更新: <span className="font-mono text-slate-500">{lastUpdate || '获取中...'}</span>
            </p>
        </div>
    );
}

export default UptimeDisplay;