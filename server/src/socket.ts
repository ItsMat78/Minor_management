import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from './models/Message';
import User from './models/User';

interface AuthenticatedSocket extends Socket {
    user?: { id: string; name: string; role: string };
}

export const initSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173", // Client URL
            methods: ["GET", "POST"]
        }
    });

    // JWT auth middleware for socket connections
    io.use(async (socket: AuthenticatedSocket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication error: no token provided'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
            const dbUser = await User.findById(decoded.id).select('name role').lean();
            if (!dbUser) {
                return next(new Error('Authentication error: user not found'));
            }
            socket.user = { id: decoded.id, name: dbUser.name, role: dbUser.role };
            next();
        } catch {
            next(new Error('Authentication error: invalid token'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log('New client connected:', socket.id, '| user:', socket.user?.id);

        socket.on('joinGroup', async (groupId: string) => {
            socket.join(groupId);

            // Load previous messages
            try {
                const messages = await Message.find({ groupId }).sort({ timestamp: 1 }).limit(50);
                socket.emit('loadMessages', messages);
            } catch (err) {
                console.error('Error loading messages:', err);
            }
        });

        socket.on('sendMessage', async (data) => {
            const { groupId, message, attachments } = data;
            // Use server-verified identity — ignore any client-supplied sender field
            const sender = socket.user!.name;

            try {
                const newMessage = new Message({
                    groupId,
                    message,
                    sender,
                    attachments: attachments || []
                });
                await newMessage.save();

                // Emit to everyone in the room including sender (so they see their own message confirmed)
                io.to(groupId).emit('receiveMessage', newMessage);
            } catch (err) {
                console.error('Error saving message:', err);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};
