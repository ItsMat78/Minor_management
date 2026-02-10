'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { IncomingRequestsTable } from '@/components/faculty/IncomingRequestsTable' // To be created
import { Loader2 } from 'lucide-react'

export default function FacultyDashboard() {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ limit: 0, current: 0 })
    const supabase = createClient()

    useEffect(() => {
        const fetchStats = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get Faculty Limit and Current Count
            const { data: profile } = await supabase
                .from('profiles')
                .select('faculty_limit')
                .eq('id', user.id)
                .single()

            const { count } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('faculty_id', user.id)
                .eq('status', 'approved')

            setStats({
                limit: profile?.faculty_limit || 5,
                current: count || 0
            })
            setLoading(false)
        }

        fetchStats()
    }, [supabase])

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>

    const percentage = (stats.current / stats.limit) * 100

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Faculty Dashboard</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Slots Filled
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold mb-2">{stats.current} / {stats.limit}</div>
                        <Progress value={percentage} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                            {stats.limit - stats.current} slots remaining
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Incoming Requests</h3>
                <IncomingRequestsTable />
            </div>
        </div>
    )
}
