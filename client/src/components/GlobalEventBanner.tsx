import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertCircle, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TYPE_LABELS: Record<string, string> = {
    group_formation_project_proposal: 'Group Formation',
    mid_term_evaluation: 'Mid-Term Eval',
    end_term_evaluation: 'End-Term Eval',
};

export const GlobalEventBanner: React.FC = () => {
    const { user, activeEvents } = useAuth();

    if (!user || !activeEvents || activeEvents.length === 0) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <AnimatePresence>
                {activeEvents.map((event) => {
                    const effectiveEnd = new Date(event.extensionDate || event.endDate);
                    const now = new Date();
                    const isClosingSoon = effectiveEnd.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000;
                    const isExpired = effectiveEnd < now;
                    const daysLeft = Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const label = TYPE_LABELS[event.type] || event.type.replace(/_/g, ' ');

                    return (
                        <motion.div
                            key={event._id}
                            initial={{ opacity: 0, scale: 0.85, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.85, x: 20 }}
                            title={`${label} — ends ${effectiveEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-default select-none shadow-sm border
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
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                                ${isExpired
                                    ? 'bg-neutral-200 text-neutral-600'
                                    : isClosingSoon
                                        ? 'bg-amber-200 text-amber-800'
                                        : 'bg-indigo-100 text-indigo-700'
                                }`}>
                                <Clock className="w-2.5 h-2.5" />
                                {isExpired ? 'Ended' : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                            </span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
