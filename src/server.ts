/// <reference types="node" />

// The MIT License (MIT)
// 
// vs-cron (https://github.com/mkloubert/vs-chat)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import * as chat_contracts from './contracts';
import * as chat_controller from './controller';
import * as chat_helpers from './helpers';
import * as chat_objects from './objects';
import * as Events from 'events';
import * as vscode from 'vscode';
const XMPP = require('node-xmpp-server');


let nextClientConnectionId = Number.MIN_SAFE_INTEGER;

/**
 * Options for starting a server.
 */
export interface ServerOptions {
    /**
     * The domain.
     */
    domain?: string;
    /**
     * The TCP port.
     */
    port?: number;
}

/**
 * A stanza context.
 */
export interface StanzaContext {
    /**
     * Gets the client connection.
     */
    readonly client: chat_contracts.ClientServerConnection;
    /**
     * Gets the underlying server.
     */
    readonly server: chat_contracts.Server;
    /**
     * Gets the stanza.
     */
    readonly stanza: chat_contracts.Stanza;
}

/**
 * A module for handling a stanza.
 */
export interface StanzaModule {
    /**
     * Handles a stanza.
     * 
     * @param {StanzaContext} ctx The context.
     */
    readonly handle: (ctx: StanzaContext) => void;
}


/**
 * A connection to a client.
 */
export class ClientConnection implements chat_contracts.ClientServerConnection {
    /**
     * Stores the underlying client object.
     */
    protected readonly _CLIENT: any;
    /**
     * Stores the ID of the connection.
     */
    protected readonly _ID: number;
    
    /**
     * Initializes a new instance of that class.
     * 
     * @param {any} client The underlying client object.
     * @param {number} id The ID of the connection.
     */
    constructor(client: any, id: number) {
        this._CLIENT = client;
        this._ID = id;
    }

    /**
     * Gets the underlying client object.
     */
    public get client(): any {
        return this._CLIENT;
    }

    /**
     * Closes the connection to the client.
     */
    public close() {
        this.client.connection.disconnect();
    }

    /** @inheritdoc */
    public dispose() {
        this.close();
    }

    /**
     * Gets the ID of the connection.
     */
    public get id(): number {
        return this._ID;
    }
}

/**
 * A XMPP server.
 */
export class XMPPServer extends chat_objects.StanzaHandlerBase implements chat_contracts.Server {
    /**
     * Stores the current client connections.
     */
    protected _connections: ClientConnection[];
    /**
     * Stores the underlying controller.
     */
    protected readonly _CONTROLLER: chat_controller.Controller;
    /**
     * Indicates if server is currently stopping or not.
     */
    protected _isStopping = false;
    /**
     * The currennt server connection.
     */
    protected _server: any;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {chat_controller.Controller} controller The underlying controller instance.
     */
    constructor(controller: chat_controller.Controller) {
        super();

        this._CONTROLLER = controller;
    }

    /**
     * Gets the underlying controller.
     */
    public get controller(): chat_controller.Controller {
        return this._CONTROLLER;
    }

    /** @inheritdoc */
    public dispose() {
        this.stopSync();

        super.dispose();
    }

    /** @inheritdoc */
    public getClientConnections(): chat_contracts.ClientServerConnection[] {
        return this._connections.filter(x => x);
    }

    /** @inheritdoc */
    protected handleStanza(ctx: StanzaContext) {
        let stanzaMod: StanzaModule;

        try {
            let name = chat_helpers.normalizeString(ctx.stanza.name);
            if (name) {
                if (/[\w|_|-]*/i.test(name)) {
                    stanzaMod = require('./stanza/server/' + name);
                }
            }
        }
        catch (e) {
            // ignore
        }

        if (stanzaMod) {
            stanzaMod.handle(ctx);
        }
        else {
            ctx.client.client.connection.error('unsupported-stanza-type', 'Stanza not supported!');
        }
    }

    /** @inheritdoc */
    public get server(): any {
        return this._server;
    }

    /**
     * Starts the server.
     * 
     * @param {ServerOptions} [opts] The options.
     * 
     * @return {Thenable<boolean>} The promise.
     */
    public start(opts?: ServerOptions): Thenable<boolean> {
        let me = this;

        if (!opts) {
            opts = {};
        }

        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                if (me._server) {
                    completed(null, false);  // already started
                    return;
                }

                let port = parseInt(chat_helpers.toStringSafe(opts.port).trim());
                if (isNaN(port)) {
                    port = chat_contracts.DEFAULT_PORT;
                }

                let domain = chat_helpers.normalizeString(opts.domain);
                if (!domain) {
                    domain = me.controller.name;
                }

                let newServer = new XMPP.C2S.TCPServer({
                    port: port,
                    domain: domain,
                });

                newServer.on('connection', function (client) {
                    try {
                        if (me._isStopping) {
                            client.connection.disconnect();
                            return;
                        }

                        let conn = new ClientConnection(client,
                                                        nextClientConnectionId++);

                        client.on('register', function (opts, cb) {
                            try {
                                cb(false);
                            }
                            catch (e) {
                                me.controller.log(`[ERROR] XMPPServer.start().register: ${chat_helpers.toStringSafe(e)}`);
                            }
                        });

                        client.on('authenticate', function (opts, cb) {
                            try {
                                if (opts.password === 'secret') {  //TODO
                                    cb(null, opts);
                                }
                                else {
                                    cb(false);
                                }
                            }
                            catch (e) {
                                me.controller.log(`[ERROR] XMPPServer.start().authenticate: ${chat_helpers.toStringSafe(e)}`);
                            }
                        });

                        client.on('online', function () {
                            try {
                                me._connections.push(conn);
                            }
                            catch (e) {
                                me.controller.log(`[ERROR] XMPPServer.start().online: ${chat_helpers.toStringSafe(e)}`);
                            }
                        });

                        client.on('stanza', function (stanza) {
                            try {
                                me.emitStanza(stanza);

                                me.handleStanza({
                                    client: conn,
                                    server: me,
                                    stanza: stanza,
                                });
                            }
                            catch (e) {
                                me.controller.log(`[ERROR] XMPPServer.start().stanza: ${chat_helpers.toStringSafe(e)}`);
                            }
                        });

                        client.on('close', function () {
                            try {
                                conn.close();
                            }
                            catch (e) {
                                me.controller.log(`[ERROR] XMPPServer.start().close: ${chat_helpers.toStringSafe(e)}`);
                            }
                            finally {
                                // remove from connection list
                                let connectionList = me._connections;
                                if (connectionList) {
                                    for (let i = 0; i < connectionList.length; i++) {
                                        if (connectionList[i].id === conn.id) {
                                            connectionList.splice(i, 1);
                                        }
                                    }
                                }
                            }
                        });

                        client.on('error', function (err) {
                            try {
                                if (err) {
                                    me.controller.log(`[ERROR] XMPPServer.start(2).error: ${chat_helpers.toStringSafe(err)}`);
                                }
                            }
                            catch (e) {
                                me.controller.log(`[ERROR] XMPPServer.start(1).error: ${chat_helpers.toStringSafe(e)}`);
                            }
                        });
                    }
                    catch (e) {
                        me.controller.log(`[ERROR] XMPPServer.start(1): ${chat_helpers.toStringSafe(e)}`);
                    }
                });

                newServer.on('listening', (err) => {
                    if (err) {
                        me.emit('error', err);

                        completed(err);
                    }
                    else {
                        me._connections = [];
                        me._server = newServer;

                        me.emit('started');

                        completed(null, true);
                    }
                });

                let completedErrorInvoked = false;
                let invokeErrorCompleted = (err) => {
                    if (err) {
                        if (completedErrorInvoked) {
                            me.controller.log(`[ERROR] XMPPClient.start(2): ${chat_helpers.toStringSafe(err)}`);
                        }
                        else {
                            completedErrorInvoked = true;

                            completed(err);
                        }
                    }
                };

                newServer.on('error', function (err) {
                    try {
                        invokeErrorCompleted(err);
                    }
                    catch (e) {
                        invokeErrorCompleted(e);
                    }
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Stops the server.
     * 
     * @return {Thenable<boolean>} The promise.
     */
    public stop(): Thenable<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                completed(null,
                          me.stopSync());
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Stops the server.
     * 
     * @return boolean Server has been stopped or not.
     */
    protected stopSync(): boolean {
        let me = this;
        if (me._isStopping) {
            return null;
        }
        
        try {
            me._isStopping = true;
        
            let oldServer = me._server;
            if (!oldServer) {
                return false;  // no server started
            }

            oldServer.server.stop();
            oldServer.server.close();

            me._connections = null;
            me._server = null;

            me.emit('stopped');

            return true;
        }
        finally {
            me._isStopping = false;
        }
    }
}
