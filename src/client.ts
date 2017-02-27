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
import * as Client from 'node-xmpp-client';
import * as Events from 'events';
import * as vscode from 'vscode';
const XMPP = require('node-xmpp-server');


let nextConnectionId = Number.MIN_SAFE_INTEGER;

/**
 * Connection data.
 */
export interface ClientConnectionData {
    /**
     * Domain
     */
    domain: string;
    /**
     * Host
     */
    host: string;
    /**
     * ID of the connection.
     */
    id: number;
    /**
     * TCP port.
     */
    port: number;
    /**
     * User
     */
    user: string;
}

/**
 * Connection options.
 */
export interface ConnectionOptions {
    /**
     * The domain.
     */
    domain?: string;
    /**
     * The host address.
     */
    host?: string;
    /**
     * The password.
     */
    password?: string;
    /**
     * The TCP port.
     */
    port?: number;
    /**
     * The user name / ID.
     */
    user?: string;
}

/**
 * A stanza context.
 */
export interface StanzaContext {
    /**
     * Gets the underlying client.
     */
    readonly client: XMPPClient;
    /**
     * Gets the underlying stanza.
     */
    readonly stanza: Client.Stanza;
}

/**
 * A XMPP client.
 */
export class XMPPClient extends chat_objects.StanzaHandlerBase implements chat_contracts.Client {
    /**
     * Stores the current client connection.
     */
    protected _client: any;
    /**
     * Stores the current connection data.
     */
    protected _connection: ClientConnectionData;
    /**
     * Stores the underlying controller.
     */
    protected readonly _CONTROLLER: chat_controller.Controller;
    /**
     * The underlying domain.
     */
    protected _domain;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {chat_controller.Controller} controller The underlying controller instance.
     */
    constructor(controller: chat_controller.Controller) {
        super();
        
        this._CONTROLLER = controller;
    }

    /** @inheritdoc */
    public get client(): any {
        return this._client;
    }

    /**
     * Closes the connection to the server.
     * 
     * @return Thenable<boolean> The promise.
     */
    public close(): Thenable<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                completed(null,
                          me.closeSync());
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Closes the connection to the server.
     * 
     * @return boolean Connection has been closed or not.
     */
    protected closeSync(): boolean {
        let me = this;
        
        let oldClient = me._client;
        if (!oldClient) {
            return false;  // no connection open
        }

        oldClient.connection.socket.destroy();

        me._connection = null;
        me._client = null;
        me._domain = null;

        me.emit('closed');

        return true;
    }

    /**
     * Connects to a server.
     * 
     * @param {ConnectionOptions} [opts] The options.
     * 
     * @return {Thenable<boolean>} The promise.
     */
    public connect(opts?: ConnectionOptions): Thenable<boolean> {
        let me = this;

        if (!opts) {
            opts = {};
        }

        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                if (me._client) {
                    completed(null, false);
                    return;
                }

                let host = chat_helpers.toStringSafe(opts.host);
                if (chat_helpers.isEmptyString(host)) {
                    host = 'localhost';
                }

                let user = chat_helpers.toStringSafe(opts.user);
                if (chat_helpers.isEmptyString(user)) {
                    user = me.controller.name;
                }

                let domain = chat_helpers.toStringSafe(opts.domain);
                if (chat_helpers.isEmptyString(domain)) {
                    domain = host;
                }

                let password = chat_helpers.toStringSafe(opts.password);

                let port = parseInt(chat_helpers.toStringSafe(opts.port).trim());
                if (isNaN(port)) {
                    port = chat_contracts.DEFAULT_PORT;
                }

                let jid = `${user}@${domain}`;

                let newClient = new Client.Client({
                    autostart: false,
                    host: host,
                    jid: jid,
                    password: password,
                    port: port,
                });

                newClient.on('online', function () {
                    try {
                        me._domain = domain;
                        me._client = newClient;

                        me._connection = {
                            domain: domain,
                            host: host,
                            id: nextConnectionId++,
                            port: port,
                            user: user,
                        };

                        completed(null, true);
                    }
                    catch (e) {
                        me.controller.log(`[ERROR] XMPPClient.connect().online: ${chat_helpers.toStringSafe(e)}`);
                    }
                });

                newClient.on('stanza', function (stanza: Client.Stanza) {
                    try {
                        me.emitStanza(stanza);

                        me.handleStanza({
                            client: me,
                            stanza: stanza,
                        });
                    }
                    catch (e) {
                        me.controller.log(`[ERROR] XMPPClient.connect().stanza: ${chat_helpers.toStringSafe(e)}`);
                    }
                });

                newClient.on('close', function (stanza: Client.Stanza) {
                    try {
                        me.closeSync();
                    }
                    catch (e) {
                        me.controller.log(`[ERROR] XMPPClient.connect().close: ${chat_helpers.toStringSafe(e)}`);
                    }
                });

                let completedErrorInvoked = false;
                let invokeErrorCompleted = (err) => {
                    if (err) {
                        if (completedErrorInvoked) {
                            me.controller.log(`[ERROR] XMPPClient.connect(2): ${chat_helpers.toStringSafe(err)}`);
                        }
                        else {
                            completedErrorInvoked = true;

                            completed(err);
                        }
                    }
                };

                newClient.on('error', function (err) {
                    try {
                        invokeErrorCompleted(err);
                    }
                    catch (e) {
                        invokeErrorCompleted(e);
                    }
                });

                newClient.connect();
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Gets the data of the current connection.
     */
    public get connection(): ClientConnectionData {
        return this._connection;
    }

    /**
     * Gets the underlying controller.
     */
    public get controller(): chat_controller.Controller {
        return this._CONTROLLER;
    }

    /** @inheritdoc */
    public dispose() {
        this.closeSync();

        super.dispose();
    }

    /** @inheritdoc */
    protected handleStanza(ctx: StanzaContext) {

    }

    /**
     * Gets if client is currently connected or not.
     */
    public get isConnected(): boolean {
        return this.connection ? true : false;
    }

    /**
     * Sends a message to the server.
     * 
     * @param {string} msg The message to send.
     * 
     * @return {Thenable<boolean>} The promise.
     */
    public sendMessage(msg: string): Thenable<boolean> {
        let me = this;
        
        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let client = me._client;

                msg = chat_helpers.toStringSafe(msg);
                
                client.send(new XMPP.Stanza('message', { to: me._domain })
                                    .c('body')
                                    .t(msg));

                completed(null, true);
            }
            catch (e) {
                completed(e);
            }
        });
    }
}