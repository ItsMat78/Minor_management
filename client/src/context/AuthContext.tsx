import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../utils/api'; // Using the configured api instance

interface User {
    _id: string;
    name: string;
    email: string;
    role: 'Student' | 'Faculty' | 'Admin';
    branch?: string;
    rollNumber?: string;
    department?: string;
    expertise?: string[];
    maxStudents?: number;
    maxGroups?: number;
    currentStudents?: number;
    currentGroups?: number;
}

interface Event {
    _id: string;
    type: string;
    label: string;
    description: string;
    startDate: string;
    endDate: string;
    extensionDate?: string;
    batchYear?: string;
    isActive: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    activeEvents: Event[];
    refreshActiveEvents: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeEvents, setActiveEvents] = useState<Event[]>([]);

    const refreshActiveEvents = async () => {
        try {
            const res = await api.get('/events/active');
            if (res.data && Array.isArray(res.data)) {
                setActiveEvents(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch active events", error);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['x-auth-token'] = token;
            axios.get('http://localhost:5000/api/auth/me')
                .then(res => {
                    setUser(res.data);
                    return refreshActiveEvents();
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    delete axios.defaults.headers.common['x-auth-token'];
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (token: string, userData: User) => {
        localStorage.setItem('token', token);
        axios.defaults.headers.common['x-auth-token'] = token;
        setUser(userData);
        await refreshActiveEvents();
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['x-auth-token'];
        setUser(null);
        setActiveEvents([]);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, activeEvents, refreshActiveEvents }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
