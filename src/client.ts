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

import * as chat_controller from './controller';
import * as chat_helpers from './helpers';
const Client = require('node-xmpp-client');
import * as Events from 'events';
import * as vscode from 'vscode';
const XMPP = require('node-xmpp-server');

export interface ConnectionOptions {
    jid?: string;
    password?: string;
}

/**
 * A XMPP client.
 */
export class XMPPClient extends Events.EventEmitter implements vscode.Disposable {
    /**
     * Stores the current client connection.
     */
    protected _client: any;
    /**
     * Stores the underlying controller.
     */
    protected readonly _CONTROLLER: chat_controller.Controller;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {chat_controller.Controller} controller The underlying controller instance.
     */
    constructor(controller: chat_controller.Controller) {
        super();
        
        this._CONTROLLER = controller;
    }

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

    protected closeSync(): boolean {
        let me = this;
        
        let oldClient = me._client;
        if (!oldClient) {
            return false;
        }

        oldClient.connection.socket.destroy();

        me._client = null;
        return true;
    }

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

                let jid = chat_helpers.toStringSafe(opts.jid);
                if (chat_helpers.isEmptyString(jid)) {
                    jid = me.controller.name + '@localhost';
                }

                let password = chat_helpers.toStringSafe(opts.password);

                let newClient = new Client({
                    jid: jid,
                    password: password,
                });

                newClient.on('online', function () {
                    try {
                        // newClient.send(new XMPP.Stanza('message', { to: 'localhost' }).c('body').t('HelloWorld'));
                    }
                    catch (e) {
                        //TODO: log
                    }
                });

                newClient.on('stanza', function (stanza) {
                    try {
                        // console.log('client1: stanza', stanza.root().toString());
                    }
                    catch (e) {
                        //TODO: log
                    }
                });

                newClient.on('error', function (err) {
                    try {
                        if (err) {
                            //TODO: log
                        }
                    }
                    catch (e) {
                        //TODO: log
                    }
                });

                me._client = newClient;
                completed(null, true);
            }
            catch (e) {
                completed(e);
            }
        });
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
    }
}