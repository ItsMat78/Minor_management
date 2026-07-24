import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertCircle, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TYPE_LABELS: Record<string, string> = {
    group_formation_project_proposal: 'Group Formation',
    mid_term_evaluation: 'Mid-Term Eval',
    end_term_evaluation: 'End-Term Eval',
};

// Break a positive millisecond span into whole days/hours/minutes/seconds.
const splitDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
};

const pad = (n: number) => n.toString().padStart(2, '0');

export const GlobalEventBanner: React.FC = () => {
    const { user, activeEvents } = useAuth();

    // Tick once a second so every pill's countdown updates live. `now` drives the
    // remaining-time maths below; keep the hooks above the early return so the
    // hook order stays stable when events come and go.
    const [now, setNow] = useState(() => Date.now());
    // A clicked pill stays expanded (hover-reveal alone is invisible on touch).
    const [openId, setOpenId] = useState<string | null>(null);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (!user || !activeEvents || activeEvents.length === 0) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <AnimatePresence>
                {activeEvents.map((event) => {
                    const effectiveEnd = new Date(event.extensionDate || event.endDate).getTime();
                    const remainingMs = effectiveEnd - now;
                    const isExpired = remainingMs <= 0;
                    const isClosingSoon = !isExpired && remainingMs < 3 * 24 * 60 * 60 * 1000;
                    const { days, hours, minutes, seconds } = splitDuration(remainingMs);
                    const countdown = days > 0
                        ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                        : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                    const label = TYPE_LABELS[event.type] || event.type.replace(/_/g, ' ');
                    const deadlineText = new Date(effectiveEnd).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    const isOpen = openId === event._id;

                    return (
                        <motion.div
                            key={event._id}
                            initial={{ opacity: 0, scale: 0.85, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.85, x: 20 }}
                            onClick={() => setOpenId(prev => prev === event._id ? null : event._id)}
                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer select-none shadow-sm border
                                ${isExpired
                                    ? 'bg-neutral-100 text-neutral-500 border-neutral-200'
                                    : isClosingSoon
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                        >
                            {isExpired
                                ? <AlertCircle className="w-3 h-3" />
                                : isClosingSoon
                                    ? <AlertCircle className="w-3 h-3" />
                                    : <Megaphone className="w-3 h-3" />
                            }
                            <span>{label}</span>
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums
                                ${isExpired
                                    ? 'bg-neutral-200 text-neutral-600'
                                    : isClosingSoon
                                        ? 'bg-amber-200 text-amber-800'
                                        : 'bg-indigo-100 text-indigo-700'
                                }`}>
                                <Clock className="w-2.5 h-2.5" />
                                {isExpired ? 'Ended' : countdown}
                            </span>
                            {/* Deadline reveal: expands on hover, and stays open once clicked so
                                it is reachable on touch devices. -ml cancels the flex gap while
                                collapsed so there is no phantom trailing space. */}
                            <span className={`flex items-center overflow-hidden -ml-1.5 transition-[max-width] duration-300 ease-out
                                ${isOpen ? 'max-w-[240px]' : 'max-w-0 group-hover:max-w-[240px]'}`}>
                                <span className="pl-2 text-[10px] font-semibold opacity-70">
                                    {isExpired ? 'ended' : 'ends'} {deadlineText}
                                </span>
                            </span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
