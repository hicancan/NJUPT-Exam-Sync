import type { ReactNode } from 'react';

interface ProductLandingCardProps {
    icon: ReactNode;
    title: string;
    description: string;
    children?: ReactNode;
}

export function ProductLandingCard({ icon, title, description, children }: ProductLandingCardProps) {
    return (
        <section className="mx-auto w-full max-w-[692px] rounded-2xl border border-[#dadce0] bg-[#f8fafc] px-5 py-7 text-center shadow-sm dark:border-[#3c4043] dark:bg-[#2d2e30] sm:px-8 sm:py-9">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1967d2] dark:bg-[#23334d] dark:text-[#8ab4f8]">
                {icon}
            </span>
            <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight text-[#202124] dark:text-[#e8eaed]">
                {title}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-[14px] leading-6 text-[#4d5156] dark:text-[#bdc1c6] sm:text-[15px]">
                {description}
            </p>
            {children}
        </section>
    );
}
