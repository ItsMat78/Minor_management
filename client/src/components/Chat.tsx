import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare, Paperclip, ChevronRight, X } from 'lucide-react';

interface Message {
    sender: string;
    message: string;
    attachments?: { name: string, url: string }[];
    timestamp: Date;
}

interface ChatProps {
    groupId: string;
    groupName: string;
    isOpen: boolean;
    onClose: () => void;
    onMessageReceived?: () => void;
}

const Chat: React.FC<ChatProps> = ({ groupId, groupName, isOpen, onClose, onMessageReceived }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const socketRef = useRef<Socket | null>(null);

    // Hold the latest callback in a ref so it doesn't force the socket effect to re-run
    // (which would tear down and rebuild the connection on every parent render).
    const onMessageReceivedRef = useRef(onMessageReceived);
    useEffect(() => { onMessageReceivedRef.current = onMessageReceived; }, [onMessageReceived]);

    useEffect(() => {
        // Read the token at mount, not at module load: it lives in localStorage *or*
        // sessionStorage (a normal login without "remember me" uses sessionStorage) and isn't
        // set until after login. A module-level socket captured a null token here and never
        // authenticated, so chat silently failed for most users.
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token || !groupId) return;

        const socket = io(import.meta.env.VITE_API_URL || window.location.origin, {
            auth: { token },
        });
        socketRef.current = socket;

        socket.emit('joinGroup', groupId);

        const handleReceiveMessage = (data: Message) => {
            setMessages((prev) => [...prev, data]);
            onMessageReceivedRef.current?.();
        };
        const handleLoadMessages = (data: Message[]) => setMessages(data);

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('loadMessages', handleLoadMessages);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('loadMessages', handleLoadMessages);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [groupId]);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() && !file) return;
        const socket = socketRef.current;
        if (!socket) return;

        // Mock attachment handling for now since we don't have a dedicated chat upload endpoint.
        // In production: Upload file to server -> get URL -> send URL in message.
        const attachments = file ? [{ name: file.name, url: '#' }] : [];

        socket.emit('sendMessage', {
            groupId,
            message: newMessage,
            attachments,
        });
        setNewMessage('');
        setFile(null);
    };

    const renderMessageWithLinks = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, index) => {
            if (part.match(urlRegex)) {
                return (
                    <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:underline break-all">
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    return (
        <div className={`fixed right-0 top-16 bottom-0 w-80 bg-white shadow-xl border-l border-neutral-200 flex flex-col z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <h3 className="font-semibold">{groupName}</h3>
                </div>
                <button onClick={onClose} className="hover:bg-indigo-700 p-1 rounded">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender === user?.name ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-2 rounded-2xl max-w-[90%] text-sm shadow-sm ${msg.sender === user?.name
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                            }`}>
                            <div>{renderMessageWithLinks(msg.message)}</div>
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 text-xs flex items-center gap-1 bg-black/10 p-1 rounded">
                                    <Paperclip className="w-3 h-3" />
                                    <span>{msg.attachments[0].name}</span>
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 px-1">
                            {msg.sender === user?.name ? 'You' : msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-3 border-t border-neutral-200 bg-white">
                {file && (
                    <div className="flex items-center justify-between bg-gray-100 px-3 py-1 mb-2 rounded text-xs">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button type="button" onClick={() => setFile(null)}><X className="w-3 h-3" /></button>
                    </div>
                )}
                <div className="flex gap-2">
                    <label className="cursor-pointer p-2 text-neutral-400 hover:text-indigo-600 transition-colors">
                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        <Paperclip className="w-5 h-5" />
                    </label>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 border-gray-200 bg-gray-50 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() && !file}
                        className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat;
