import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import Workbook, { WORKBOOK_WEEKS } from './Workbook';

type WorkbookTrayProps = Omit<React.ComponentProps<typeof Workbook>, 'onClose'>;

// The weekly workbook as a slide-in tray: a tab pinned to the right edge of the screen (an icon
// on phones) opens a drawer from the right, so the workbook never competes with the updates
// timeline for width.
const WorkbookTray: React.FC<WorkbookTrayProps> = (props) => {
    const [open, setOpen] = useState(false);
    const approved = (props.entries || []).filter(e => e.approvedAt).length;

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Open weekly workbook"
                    title="Weekly workbook"
                    className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-l-xl shadow-lg shadow-indigo-600/30 px-2 py-3 sm:py-4 transition-colors"
                >
                    <BookOpen className="w-5 h-5" />
                    <span className="hidden sm:block text-xs font-bold tracking-wide [writing-mode:vertical-rl] rotate-180">Workbook</span>
                    <span className="text-[10px] font-black tabular-nums bg-white/20 rounded px-1">{approved}/{WORKBOOK_WEEKS}</span>
                </button>
            )}

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            key="workbook-backdrop"
                            className="fixed inset-0 z-40 bg-neutral-900/30"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                        />
                        <motion.aside
                            key="workbook-drawer"
                            role="dialog"
                            aria-label="Weekly workbook"
                            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-neutral-50 shadow-2xl overflow-y-auto p-4 sm:p-6"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.25 }}
                        >
                            <Workbook {...props} onClose={() => setOpen(false)} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default WorkbookTray;
