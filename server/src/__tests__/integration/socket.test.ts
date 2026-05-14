/**
 * Integration tests for the Socket.io server (socket.ts).
 * Spins up a real HTTP server on a random port, attaches Socket.io,
 * and connects via socket.io-client to test auth and messaging.
 */
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioc } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import type { Server as IoServer } from 'socket.io';
import mongoose from 'mongoose';
import app from '../../app';
import { initSocket } from '../../socket';
import Message from '../../models/Message';
import { createTestUser, generateToken } from '../helpers/factories';
import { UserRole } from '../../models/User';

let httpServer: HttpServer;
let ioServer: IoServer;
let serverUrl: string;

beforeAll(async () => {
    httpServer = createServer(app);
    ioServer = initSocket(httpServer);
    await new Promise<void>(resolve => {
        httpServer.listen(0, () => {
            const { port } = httpServer.address() as AddressInfo;
            serverUrl = `http://localhost:${port}`;
            resolve();
        });
    });
});

afterAll(async () => {
    // ioServer.close() disconnects all sockets and closes the underlying HTTP server
    ioServer.disconnectSockets(true);
    await new Promise<void>(resolve => ioServer.close(() => resolve()));
});

function makeClient(token?: string): ClientSocket {
    return ioc(serverUrl, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        autoConnect: false,
        reconnection: false,
    });
}

// ── Authentication ─────────────────────────────────────────────────────────────

describe('Socket.io authentication', () => {
    it('rejects a connection with no token', async () => {
        await new Promise<void>((resolve, reject) => {
            const sock = makeClient();
            sock.on('connect_error', err => {
                expect(err.message).toMatch(/authentication error/i);
                sock.disconnect();
                resolve();
            });
            sock.on('connect', () => {
                sock.disconnect();
                reject(new Error('Should not have connected without a token'));
            });
            sock.connect();
        });
    });

    it('rejects a connection with a malformed token', async () => {
        await new Promise<void>((resolve, reject) => {
            const sock = makeClient('not.a.valid.token');
            sock.on('connect_error', err => {
                expect(err.message).toMatch(/authentication error/i);
                sock.disconnect();
                resolve();
            });
            sock.on('connect', () => {
                sock.disconnect();
                reject(new Error('Should not have connected with an invalid token'));
            });
            sock.connect();
        });
    });

    it('accepts a valid JWT from an existing user', async () => {
        const user = await createTestUser({ role: UserRole.STUDENT, email: 'sock-auth@t.ac.in' });
        await new Promise<void>((resolve, reject) => {
            const sock = makeClient(generateToken(user));
            sock.on('connect', () => {
                sock.disconnect();
                resolve();
            });
            sock.on('connect_error', err => {
                sock.disconnect();
                reject(err);
            });
            sock.connect();
        });
    });

    it('rejects a token whose user no longer exists in the DB', async () => {
        // Create a user, generate a token, then delete the user from the DB
        const ghost = await createTestUser({ role: UserRole.STUDENT, email: 'ghost@t.ac.in' });
        const token = generateToken(ghost);
        await (ghost as any).deleteOne();

        await new Promise<void>((resolve, reject) => {
            const sock = makeClient(token);
            sock.on('connect_error', err => {
                expect(err.message).toMatch(/authentication error/i);
                sock.disconnect();
                resolve();
            });
            sock.on('connect', () => {
                sock.disconnect();
                reject(new Error('Should not connect for a deleted user'));
            });
            sock.connect();
        });
    });
});

// ── joinGroup ──────────────────────────────────────────────────────────────────

describe('joinGroup event', () => {
    it('emits loadMessages with an empty array when the group has no chat history', async () => {
        const user = await createTestUser({ role: UserRole.STUDENT, email: 'jg1@t.ac.in' });
        const groupId = new mongoose.Types.ObjectId().toString();

        await new Promise<void>((resolve, reject) => {
            const sock = makeClient(generateToken(user));
            sock.on('connect', () => sock.emit('joinGroup', groupId));
            sock.on('loadMessages', (msgs: any[]) => {
                expect(Array.isArray(msgs)).toBe(true);
                expect(msgs).toHaveLength(0);
                sock.disconnect();
                resolve();
            });
            sock.on('connect_error', err => { sock.disconnect(); reject(err); });
            sock.connect();
        });
    });

    it('emits loadMessages with existing messages for the group', async () => {
        const user = await createTestUser({ role: UserRole.STUDENT, email: 'jg2@t.ac.in' });
        const groupId = new mongoose.Types.ObjectId().toString();

        // Pre-seed two messages for this group
        await Message.create({ groupId, message: 'First message', sender: 'Alice', attachments: [] });
        await Message.create({ groupId, message: 'Second message', sender: 'Bob', attachments: [] });

        await new Promise<void>((resolve, reject) => {
            const sock = makeClient(generateToken(user));
            sock.on('connect', () => sock.emit('joinGroup', groupId));
            sock.on('loadMessages', (msgs: any[]) => {
                expect(msgs).toHaveLength(2);
                expect(msgs[0].message).toBe('First message');
                sock.disconnect();
                resolve();
            });
            sock.on('connect_error', err => { sock.disconnect(); reject(err); });
            sock.connect();
        });
    });
});

// ── sendMessage ────────────────────────────────────────────────────────────────

describe('sendMessage event', () => {
    it('saves the message to MongoDB and broadcasts it to all room members', async () => {
        const sender = await createTestUser({ role: UserRole.STUDENT, email: 'sm-sender@t.ac.in' });
        const receiver = await createTestUser({ role: UserRole.STUDENT, email: 'sm-receiver@t.ac.in' });
        const groupId = new mongoose.Types.ObjectId().toString();

        await new Promise<void>((resolve, reject) => {
            const senderSock = makeClient(generateToken(sender));
            const receiverSock = makeClient(generateToken(receiver));
            let joinedCount = 0;

            const onLoadMessages = () => {
                joinedCount++;
                if (joinedCount === 2) {
                    senderSock.emit('sendMessage', { groupId, message: 'Hello from sender!', attachments: [] });
                }
            };

            receiverSock.on('receiveMessage', async (msg: any) => {
                try {
                    expect(msg.message).toBe('Hello from sender!');
                    expect(msg.sender).toBe(sender.name);
                    // Verify the message was actually persisted
                    const inDb = await Message.findOne({ groupId, message: 'Hello from sender!' });
                    expect(inDb).not.toBeNull();
                    senderSock.disconnect();
                    receiverSock.disconnect();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            senderSock.on('connect', () => {
                senderSock.emit('joinGroup', groupId);
                senderSock.on('loadMessages', onLoadMessages);
            });
            receiverSock.on('connect', () => {
                receiverSock.emit('joinGroup', groupId);
                receiverSock.on('loadMessages', onLoadMessages);
            });

            senderSock.on('connect_error', err => { senderSock.disconnect(); receiverSock.disconnect(); reject(err); });
            receiverSock.on('connect_error', err => { senderSock.disconnect(); receiverSock.disconnect(); reject(err); });

            senderSock.connect();
            receiverSock.connect();
        });
    });

    it('uses the server-verified sender name and ignores any client-supplied sender field', async () => {
        const user = await createTestUser({ role: UserRole.STUDENT, email: 'sm-spoof@t.ac.in' });
        const groupId = new mongoose.Types.ObjectId().toString();

        await new Promise<void>((resolve, reject) => {
            const sock = makeClient(generateToken(user));

            sock.on('connect', () => sock.emit('joinGroup', groupId));

            sock.on('loadMessages', () => {
                // Attempt to spoof the sender by including a 'sender' field in the payload
                sock.emit('sendMessage', { groupId, message: 'Spoof attempt', sender: 'HACKER', attachments: [] });
            });

            sock.on('receiveMessage', (msg: any) => {
                try {
                    // Server must use the JWT-verified name, not the payload value
                    expect(msg.sender).toBe(user.name);
                    expect(msg.sender).not.toBe('HACKER');
                    sock.disconnect();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            sock.on('connect_error', err => { sock.disconnect(); reject(err); });
            sock.connect();
        });
    });

    it('only delivers messages to clients in the same room (not other groups)', async () => {
        const userA = await createTestUser({ role: UserRole.STUDENT, email: 'room-a@t.ac.in' });
        const userB = await createTestUser({ role: UserRole.STUDENT, email: 'room-b@t.ac.in' });
        const groupA = new mongoose.Types.ObjectId().toString();
        const groupB = new mongoose.Types.ObjectId().toString();

        await new Promise<void>((resolve, reject) => {
            const sockA = makeClient(generateToken(userA));
            const sockB = makeClient(generateToken(userB));

            // userB receives a message in groupA — must NOT fire
            sockB.on('receiveMessage', () => {
                sockA.disconnect();
                sockB.disconnect();
                reject(new Error('userB should not receive a message from groupA'));
            });

            sockA.on('receiveMessage', (msg: any) => {
                // userA receives their own message back — this is expected (io.to(groupId).emit sends to all in room)
                expect(msg.message).toBe('Group-isolated message');
                // Give 200ms for sockB to potentially (incorrectly) receive the message
                setTimeout(() => {
                    sockA.disconnect();
                    sockB.disconnect();
                    resolve();
                }, 200);
            });

            sockA.on('connect', () => sockA.emit('joinGroup', groupA));
            sockB.on('connect', () => sockB.emit('joinGroup', groupB)); // different room

            sockA.on('loadMessages', () => {
                sockA.emit('sendMessage', { groupId: groupA, message: 'Group-isolated message', attachments: [] });
            });

            sockA.on('connect_error', err => { reject(err); });
            sockB.on('connect_error', err => { reject(err); });

            sockA.connect();
            sockB.connect();
        });
    });
});
