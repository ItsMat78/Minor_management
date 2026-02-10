'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, BookOpen, Settings, LogOut, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
    role: 'student' | 'faculty' | 'admin'
}

export function Sidebar({ role }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const links = [
        { name: 'Dashboard', href: role === 'student' ? '/student' : role === 'faculty' ? '/faculty' : '/admin', icon: LayoutDashboard },
        { name: 'Groups', href: '/groups', icon: Users }, // Shared view?
        { name: 'Faculty', href: '/faculty-list', icon: BookOpen }, // Student view to see faculty
        { name: 'Settings', href: '/settings', icon: Settings },
    ]

    // Filter links based on role (simple version)
    const filteredLinks = links.filter(link => {
        if (role === 'student' && link.name === 'Faculty') return true
        if (role === 'student' && link.name === 'Groups') return true
        if (role === 'faculty' && link.name === 'Groups') return false // Faculty sees requests on dashboard
        return true
    })

    return (
        <div className="flex flex-col h-full w-64 bg-white border-r border-slate-200">
            <div className="p-6">
                <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                    <LayoutDashboard className="h-6 w-6" />
                    Sloth<span className="text-slate-900">UI</span>
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {filteredLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <Icon className="mr-3 h-5 w-5" />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-slate-200">
                <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </Button>
            </div>
        </div>
    )
}
