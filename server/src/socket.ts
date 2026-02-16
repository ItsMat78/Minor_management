import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import Message from './models/Message';

export const initSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173", // Client URL
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log('New client connected:', socket.id);

        socket.on('joinGroup', async (groupId: string) => {
            socket.join(groupId);
            console.log(`Socket ${socket.id} joined group ${groupId}`);

            // Load previous messages
            try {
                const messages = await Message.find({ groupId }).sort({ timestamp: 1 }).limit(50);
                socket.emit('loadMessages', messages);
            } catch (err) {
                console.error('Error loading messages:', err);
            }
        });

        socket.on('sendMessage', async (data) => {
            const { groupId, message, sender, attachments } = data;

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
