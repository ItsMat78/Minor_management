'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlusCircle, Search, X } from 'lucide-react'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

export function CreateGroupDialog({ disabled }: { disabled?: boolean }) {
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [facultyId, setFacultyId] = useState('')
    const [selectedStudents, setSelectedStudents] = useState<any[]>([])

    const [faculties, setFaculties] = useState<any[]>([])
    const [studentSearch, setStudentSearch] = useState('')
    const [studentResults, setStudentResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        // Fetch faculties
        const fetchFaculties = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('role', 'faculty')
            if (data) setFaculties(data)
        }
        fetchFaculties()
    }, [supabase])

    useEffect(() => {
        // Search students
        const searchStudents = async () => {
            if (studentSearch.length < 2) {
                setStudentResults([])
                return
            }

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'student')
                .ilike('full_name', `%${studentSearch}%`)
                .limit(5)

            if (data) {
                // Filter out already selected to avoid duplicates in list
                const filtered = data.filter(s => !selectedStudents.find(sel => sel.id === s.id))
                setStudentResults(filtered)
            }
        }

        const timeout = setTimeout(searchStudents, 300)
        return () => clearTimeout(timeout)
    }, [studentSearch, supabase, selectedStudents])

    const handleAddStudent = (student: any) => {
        if (selectedStudents.length < 2) { // Max 2 other members
            setSelectedStudents([...selectedStudents, student])
            setStudentSearch('')
        }
    }

    const handleRemoveStudent = (id: string) => {
        setSelectedStudents(selectedStudents.filter(s => s.id !== id))
    }

    const handleSubmit = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        try {
            // 1. Create Project
            const { data: project, error: projError } = await supabase
                .from('projects')
                .insert({
                    title,
                    description,
                    faculty_id: facultyId
                })
                .select()
                .single()

            if (projError) throw projError

            // 2. Add Members (Self + Selected)
            const members = [
                { project_id: project.id, student_id: user.id },
                ...selectedStudents.map(s => ({ project_id: project.id, student_id: s.id }))
            ]

            const { error: memError } = await supabase
                .from('project_members')
                .insert(members)

            if (memError) throw memError

            setOpen(false)
            window.location.reload() // Refresh to show dashboard
        } catch (error: any) {
            console.error('Error creating group:', error)
            alert('Failed to create group. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={disabled}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Group
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Project Group</DialogTitle>
                    <DialogDescription>
                        Form a group of up to 3 students and select a faculty mentor.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">Project Title</Label>
                        <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="faculty">Faculty Mentor</Label>
                        <Select onValueChange={setFacultyId} value={facultyId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Faculty" />
                            </SelectTrigger>
                            <SelectContent>
                                {faculties.map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.full_name} ({f.department})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Group Members (Max 2 others)</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {selectedStudents.map(s => (
                                <Badge key={s.id} variant="secondary" className="pl-2 pr-1 py-1">
                                    {s.full_name}
                                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1 hover:bg-transparent" onClick={() => handleRemoveStudent(s.id)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </Badge>
                            ))}
                        </div>

                        <Popover open={studentResults.length > 0 && !!studentSearch}>
                            <PopoverTrigger asChild>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search students..."
                                        className="pl-8"
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        disabled={selectedStudents.length >= 2}
                                    />
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="p-0" align="start">
                                <Command>
                                    <CommandList>
                                        <CommandGroup heading="Students">
                                            {studentResults.map(student => (
                                                <CommandItem key={student.id} onSelect={() => handleAddStudent(student)}>
                                                    {student.full_name} ({student.department})
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} disabled={loading || !title || !facultyId}>
                        {loading ? 'Creating...' : 'Create Group'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
