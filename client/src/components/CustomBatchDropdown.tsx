import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Users, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomBatchDropdownProps {
    value: string;
    onChange: (val: string) => void;
    panelGroups: any[];
}

const CustomBatchDropdown: React.FC<CustomBatchDropdownProps> = ({ value, onChange, panelGroups }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const yearsWithPanels = Array.from(new Set(panelGroups.map((p: any) => p.panel.batchYear)))
        .sort((a, b) => b - a);

    const getPanelInfo = (year: number) => {
        return panelGroups.find((p: any) => p.panel.batchYear === year);
    };

    const currentValueLabel = value === 'All' ? 'Select Batch' : `Batch ${value}-${parseInt(value) + 4}`;
    const currentPanel = value !== 'All' ? getPanelInfo(parseInt(value)) : null;

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-4 px-5 py-2.5 bg-white border border-neutral-200 rounded-2xl text-sm font-bold text-neutral-800 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all shadow-sm min-w-[240px] justify-between group h-14"
            >
                <div className="flex flex-col items-start min-w-0">
                    <span className="text-neutral-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 opacity-60">Selection Year</span>
                    <span className="flex items-center gap-2 min-w-0 w-full">
                        <span className="truncate max-w-[140px] whitespace-nowrap">{currentValueLabel}</span>
                        {currentPanel && (
                            <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-md uppercase font-black tracking-widest leading-none whitespace-nowrap">
                                {currentPanel.panel.name || 'Panel'}
                            </span>
                        )}
                    </span>
                </div>
                <div className={`p-1 rounded-lg transition-colors shrink-0 ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-neutral-100 text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            <AnimatePresence mode="wait">
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        transition={{ duration: 0.3, type: "spring", damping: 20, stiffness: 200 }}
                        className="absolute top-full left-0 mt-3 w-full min-w-[320px] bg-white border border-neutral-200 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] z-[100] overflow-hidden py-3 p-2"
                    >
                        <div className="px-4 pb-3 mb-2 border-b border-neutral-50 flex items-center justify-between">
                           <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mt-2">Evaluation Batches</p>
                           <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full mt-2">{yearsWithPanels.length} Active</span>
                        </div>
                        
                        <div className="max-h-[380px] overflow-y-auto pr-1 space-y-1.5">
                            <button
                                onClick={() => { onChange('All'); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between group relative overflow-hidden ${value === 'All' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-neutral-600 hover:bg-neutral-50 hover:pl-5'}`}
                            >
                                <span className="font-bold text-sm">All Batches</span>
                                {value === 'All' && <Check className="w-4 h-4 font-black" />}
                            </button>

                            {yearsWithPanels.length === 0 && (
                                <div className="p-8 text-center bg-neutral-50 rounded-2xl m-2">
                                    <Users className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-neutral-400">No panel assignments found</p>
                                </div>
                            )}

                            {yearsWithPanels.map(year => {
                                const yearStr = year.toString();
                                const panelGroup = getPanelInfo(year);
                                const isSelected = value === yearStr;
                                const otherMembers = panelGroup?.panel?.faculty?.map((f: any) => f.name).join(', ') || 'No members';
                                
                                return (
                                    <button
                                        key={year}
                                        onClick={() => { onChange(yearStr); setIsOpen(false); }}
                                        className={`w-full text-left px-4 py-4 rounded-2xl transition-all flex items-center justify-between group relative overflow-hidden ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 border-indigo-500' : 'text-neutral-600 hover:bg-neutral-50 hover:pl-5 border-transparent'}`}
                                    >
                                        <div className="flex flex-col relative z-10 min-w-0 pr-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-sm">Batch {year}-{year + 4}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest ${isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {panelGroup?.panel?.name || 'Panel'}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <Users className={`w-3 h-3 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-neutral-400'}`} />
                                                <p className={`text-[10px] font-medium leading-tight line-clamp-2 ${isSelected ? 'text-indigo-100' : 'text-neutral-500'}`}>
                                                    {otherMembers}
                                                </p>
                                            </div>
                                        </div>
                                        {isSelected && <Check className="w-5 h-5 shrink-0 relative z-10" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomBatchDropdown;
