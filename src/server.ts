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
import * as Events from 'events';
import * as vscode from 'vscode';
const XMPP = require('node-xmpp-server');


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
 * A XMPP server.
 */
export class XMPPServer extends Events.EventEmitter implements vscode.Disposable {
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

    /**
     * Disconnects a client connection.
     * 
     * @param {any} connection The connection to close.
     * 
     * @return {boolean} Operation was successful or not.
     */
    protected disconnectClient(connection: any): boolean {
        try {
            if (connection) {
                connection.destroy();
            }

            return true;
        }
        catch (e) {
            return false;
        }
    }

    /** @inheritdoc */
    public dispose() {
        this.stopSync();
    }

    /**
     * Starts the server.
     * 
     * @param {ServerOptions} The options.
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
                    domain = 'localhost';
                }

                let newServer = new XMPP.C2S.TCPServer({
                    port: port,
                    domain: domain,
                });

                newServer.on('connection', function (client) {
                    try {
                        if (me._isStopping) {
                            client.socket.destroy();
                            return;
                        }

                        client.on('register', function (opts, cb) {
                            try {
                                cb(true);
                            }
                            catch (e) {
                                //TODO: log
                            }
                        });

                        client.on('authenticate', function (opts, cb) {
                            try {
                                if (opts.password === 'secret') {
                                    cb(null, opts);
                                }
                                else {
                                    cb(false);
                                }
                            }
                            catch (e) {
                                //TODO: log
                            }
                        });

                        client.on('online', function () {
                            try {
                                // console.log('server:', client.jid.local, 'ONLINE');
                            }
                            catch (e) {
                                //TODO: log
                            }
                        });

                        client.on('stanza', function (stanza) {
                            try {
                                /*
                                var from = stanza.attrs.from;
                                
                                stanza.attrs.from = stanza.attrs.to;
                                stanza.attrs.to = from;

                                client.send(stanza); */
                            }
                            catch (e) {
                                //TODO: log
                            }
                        });

                        client.on('close', function () {
                            try {
                                me.disconnectClient(client);
                            }
                            catch (e) {
                                //TODO: log
                            }
                        });

                        client.on('error', function (err) {
                            try {
                                if (err) {
                                    //TODO: log
                                }
                            }
                            catch (e) {
                                //TODO: log
                            }
                        });
                    }
                    catch (e) {
                        me.controller.log(`[ERROR] XMPPServer.start(): ${chat_helpers.toStringSafe(e)}`);
                    }
                });

                newServer.on('listening', (err) => {
                    if (err) {
                        completed(err);
                    }
                    else {
                        me._server = newServer;

                        completed(null, true);
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

            // close connections to clients
            let allConnections: Set<any> = oldServer.connections;
            if (allConnections) {
                allConnections.forEach(c => {
                    me.disconnectClient(c);
                });
            }

            me._server = null;
        }
        finally {
            me._isStopping = false;
        }
    }
}