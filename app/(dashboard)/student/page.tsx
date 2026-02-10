'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PlusCircle, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateGroupDialog } from '@/components/student/CreateGroupDialog'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function StudentDashboard() {
    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<any>(null)
    const [deadlinePassed, setDeadlinePassed] = useState(false)
    const [deadline, setDeadline] = useState<Date | null>(null)
    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Parallel fetch: Project & Settings
            const [memberRes, settingsRes] = await Promise.all([
                supabase.from('project_members').select('project_id, projects(*)').eq('student_id', user.id).single(),
                supabase.from('system_settings').select('submission_deadline').single()
            ])

            if (memberRes.data) {
                setProject(memberRes.data.projects)
            }

            if (settingsRes.data?.submission_deadline) {
                const d = new Date(settingsRes.data.submission_deadline)
                setDeadline(d)
                if (new Date() > d) {
                    setDeadlinePassed(true)
                }
            }

            setLoading(false)
        }

        fetchData()
    }, [supabase])

    if (loading) return <div>Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Student Dashboard</h2>
            </div>

            {deadlinePassed && !project && (
                <Alert variant="destructive">
                    <AlertTitle>Submission Closed</AlertTitle>
                    <AlertDescription>
                        The deadline for creating new groups was {deadline?.toLocaleDateString()}.
                    </AlertDescription>
                </Alert>
            )}

            {!project ? (
                <Card className="border-dashed border-2">
                    <CardHeader className="text-center">
                        <CardTitle>No Active Project</CardTitle>
                        <CardDescription>
                            You haven't joined or created a project group yet.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center pb-8">
                        <CreateGroupDialog disabled={deadlinePassed} />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>{project.title}</CardTitle>
                        <CardDescription>Status: <span className="capitalize font-medium text-emerald-600">{project.status}</span></CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600 mb-4">{project.description}</p>
                        <div className="flex items-center text-sm text-slate-500">
                            <Users className="mr-2 h-4 w-4" />
                            Group Members
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
