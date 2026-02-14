import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Users, BookOpen, Layers, CheckCircle, Clock, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/stats')
            .then(res => setStats(res.data))
            .catch(err => console.error('Failed to fetch stats', err))
            .finally(() => setLoading(false));
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    if (loading) return (
        <div className="flex match-height items-center justify-center min-h-[80vh]">
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                    borderRadius: ["20%", "50%", "20%"]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 bg-blue-500/20 backdrop-blur-md"
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-50/50 p-8 font-jakarta">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
            >
                <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">
                    Admin Overview
                </h1>
                <p className="text-neutral-500 text-lg">
                    Real-time insights into project portal activity.
                </p>
            </motion.div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12"
            >
                <StatsCard
                    title="Total Students"
                    value={stats?.students}
                    icon={<Users className="w-6 h-6 text-indigo-600" />}
                    color="bg-indigo-50"
                    trend="+12% this week" // Mock data for visual completeness
                    variants={item}
                />
                <StatsCard
                    title="Total Faculty"
                    value={stats?.faculty}
                    icon={<BookOpen className="w-6 h-6 text-rose-600" />}
                    color="bg-rose-50"
                    trend="Stable"
                    variants={item}
                />
                <StatsCard
                    title="Active Groups"
                    value={stats?.groups}
                    icon={<Layers className="w-6 h-6 text-emerald-600" />}
                    color="bg-emerald-50"
                    trend="+5 new today"
                    variants={item}
                />
                <StatsCard
                    title="Projects"
                    value={stats?.projects}
                    icon={<Activity className="w-6 h-6 text-amber-600" />}
                    color="bg-amber-50"
                    trend="8 pending review"
                    variants={item}
                />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                    variants={item}
                    initial="hidden"
                    animate="show"
                    className="p-8 rounded-3xl bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-300"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-neutral-900">Group Status</h3>
                            <p className="text-sm text-neutral-500">Breakdown of current formation status</p>
                        </div>
                        <div className="p-2 bg-neutral-50 rounded-full">
                            <TrendingUp className="w-5 h-5 text-neutral-400" />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <StatusRow
                            label="Forming"
                            value={stats?.breakdown?.forming}
                            total={stats?.groups}
                            icon={<Clock className="w-5 h-5 text-amber-500" />}
                            color="bg-amber-500"
                        />
                        <StatusRow
                            label="Approved"
                            value={stats?.breakdown?.approved}
                            total={stats?.groups}
                            icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                            color="bg-emerald-500"
                        />
                    </div>
                </motion.div>

                <motion.div
                    variants={item}
                    initial="hidden"
                    animate="show"
                    className="p-8 rounded-3xl bg-neutral-900 text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-16 -mt-16 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500 rounded-full blur-[100px] opacity-20 -ml-16 -mb-16 pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                                <AlertCircle className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Quick Actions</h3>
                                <p className="text-indigo-200 text-sm">Manage portal settings</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <ActionButton label="Export Data Details" />
                            <ActionButton label="Manage User Permissions" />
                            <ActionButton label="Review Pending Proposals" />
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

const StatsCard = ({ title, value, icon, color, trend, variants }: any) => (
    <motion.div
        variants={variants}
        whileHover={{ y: -5, transition: { type: "spring", stiffness: 300 } }}
        className="p-6 rounded-3xl bg-white border border-neutral-100 shadow-sm group cursor-default"
    >
        <div className="flex items-start justify-between mb-4">
            <div className={`p-4 rounded-xl ${color} transition-colors duration-300`}>
                {icon}
            </div>
            {trend && (
                <span className="text-xs font-medium text-neutral-400 bg-neutral-50 px-2 py-1 rounded-full">
                    {trend}
                </span>
            )}
        </div>
        <div>
            <p className="text-neutral-500 text-sm font-medium mb-1">{title}</p>
            <h4 className="text-3xl font-bold text-neutral-900 tracking-tight">
                {value}
            </h4>
        </div>
    </motion.div>
);

const StatusRow = ({ label, value, total, icon, color }: any) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return (
        <div className="relative">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-semibold text-neutral-700">{label}</span>
                </div>
                <span className="font-bold text-neutral-900">{value} <span className="text-neutral-400 text-sm font-normal">/ {total}</span></span>
            </div>
            <div className="h-3 w-full bg-neutral-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
        </div>
    );
};

const ActionButton = ({ label }: { label: string }) => (
    <motion.button
        whileHover={{ scale: 1.02, x: 4 }}
        whileTap={{ scale: 0.98 }}
        className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium flex items-center justify-between group"
    >
        {label}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            →
        </div>
    </motion.button>
);

export default AdminDashboard;
