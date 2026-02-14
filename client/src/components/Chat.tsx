import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare } from 'lucide-react';

interface Message {
    sender: string;
    message: string;
}

const socket: Socket = io('http://localhost:5000');

interface ChatProps {
    groupId: string;
    groupName: string;
}

const Chat: React.FC<ChatProps> = ({ groupId, groupName }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        socket.emit('joinGroup', groupId);

        const handleReceiveMessage = (data: { message: string; sender: string }) => {
            setMessages((prev) => [...prev, data]);
        };

        socket.on('receiveMessage', handleReceiveMessage);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
        };
    }, [groupId]);

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        socket.emit('sendMessage', {
            groupId,
            message: newMessage,
            sender: user?.name,
        });
        setNewMessage('');
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col h-[400px] bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="p-4 border-b flex items-center gap-2 bg-gray-50 rounded-t-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-800">{groupName} Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender === user?.name ? 'items-end' : 'items-start'}`}>
                        <div className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${msg.sender === user?.name
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                            {msg.message}
                        </div>
                        <span className="text-xs text-gray-400 mt-1">{msg.sender === user?.name ? 'You' : msg.sender}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
};

export default Chat;
