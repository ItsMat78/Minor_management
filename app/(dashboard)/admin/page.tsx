'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('system_settings').select('submission_deadline').single()
            if (data?.submission_deadline) {
                setDate(new Date(data.submission_deadline))
            }
            setLoading(false)
        }
        fetchSettings()
    }, [supabase])

    const handleSave = async () => {
        if (!date) return
        setSaving(true)
        const { error } = await supabase
            .from('system_settings')
            .update({ submission_deadline: date.toISOString() })
            .eq('id', 1)

        if (error) {
            alert('Failed to update deadline') // Use toast in prod
        } else {
            alert('Deadline updated successfully')
        }
        setSaving(false)
    }

    if (loading) return <Loader2 className="animate-spin" />

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
            </div>

            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>Submission Deadline</CardTitle>
                    <CardDescription>Set the final date for student group formation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Update Deadline'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
