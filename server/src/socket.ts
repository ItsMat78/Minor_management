import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

export const initSocket = (httpServer: HttpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173", // Client URL
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket: Socket) => {
        console.log('New client connected:', socket.id);

        socket.on('joinGroup', (groupId: string) => {
            socket.join(groupId);
            console.log(`Socket ${socket.id} joined group ${groupId}`);
        });

        socket.on('sendMessage', ({ groupId, message, sender }) => {
            io.to(groupId).emit('receiveMessage', { message, sender });
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
};
