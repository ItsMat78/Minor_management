'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Check, X } from 'lucide-react'
// import { useToast } from "@/hooks/use-toast" // Assumes shadcn toast is installed, else use alert

export function IncomingRequestsTable() {
    const [requests, setRequests] = useState<any[]>([])
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()
    // const { toast } = useToast()

    const fetchRequests = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('projects')
            .select(`
            *,
            members:project_members(
                student:profiles(*)
            )
        `)
            .eq('faculty_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setRequests(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchRequests()
    }, [supabase])

    const handleApprove = async (projectId: string) => {
        try {
            const { error } = await supabase.rpc('approve_project', { project_id_arg: projectId })
            if (error) throw error

            // toast({ title: "Project Approved" })
            fetchRequests() // Refresh list
            setSelectedRequest(null) // Close sheet if open
        } catch (error: any) {
            alert(error.message)
        }
    }

    const handleReject = async (projectId: string) => {
        const { error } = await supabase
            .from('projects')
            .update({ status: 'rejected' })
            .eq('id', projectId)

        if (!error) {
            fetchRequests()
            setSelectedRequest(null)
        }
    }

    if (loading) return <div>Loading requests...</div>
    if (requests.length === 0) return <div className="text-slate-500">No incoming requests.</div>

    return (
        <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Project Title</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests.map((req) => (
                        <TableRow key={req.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedRequest(req)}>
                            <TableCell className="font-medium">{req.title}</TableCell>
                            <TableCell>
                                <div className="flex -space-x-2">
                                    {req.members?.map((m: any) => (
                                        <div key={m.student.id} className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 border-white" title={m.student.full_name}>
                                            {m.student.full_name.charAt(0)}
                                        </div>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                                    {req.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm">View</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Right Sidebar Details */}
            <Sheet open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <SheetContent className="sm:max-w-md w-[400px]">
                    {selectedRequest && (
                        <>
                            <SheetHeader className="mb-6">
                                <SheetTitle>{selectedRequest.title}</SheetTitle>
                                <SheetDescription>
                                    Submitted on {new Date(selectedRequest.created_at).toLocaleDateString()}
                                </SheetDescription>
                            </SheetHeader>

                            <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-sm font-medium text-slate-500 mb-2">Description</h4>
                                        <p className="text-sm leading-relaxed text-slate-700 bg-slate-50 p-3 rounded-md">
                                            {selectedRequest.description}
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium text-slate-500 mb-2">Team Members</h4>
                                        <div className="space-y-3">
                                            {selectedRequest.members?.map((m: any) => (
                                                <div key={m.student.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                                                    <div className="bg-indigo-100 text-indigo-700 w-10 h-10 rounded-full flex items-center justify-center font-medium">
                                                        {m.student.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{m.student.full_name}</p>
                                                        <p className="text-xs text-slate-500">{m.student.department}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedRequest.status === 'pending' && (
                                        <div className="flex gap-3 pt-4 border-t">
                                            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(selectedRequest.id)}>
                                                <Check className="mr-2 h-4 w-4" /> Approve
                                            </Button>
                                            <Button variant="destructive" className="flex-1" onClick={() => handleReject(selectedRequest.id)}>
                                                <X className="mr-2 h-4 w-4" /> Reject
                                            </Button>
                                        </div>
                                    )}
                                    {selectedRequest.status !== 'pending' && (
                                        <div className="pt-4 border-t text-center text-sm text-slate-500">
                                            This project is {selectedRequest.status}.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
