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

import * as chat_client from './client';
import * as chat_contracts from './contracts';
import * as chat_helpers from './helpers';
import * as chat_server from './server';
import * as Moment from 'moment';
import * as OS from 'os';
import * as vscode from 'vscode';


/**
 * The controller of that extension.
 */
export class Controller implements vscode.Disposable {
    /**
     * Stores the current settings.
     */
    protected _config: chat_contracts.Configuration;
    /**
     * Stores the underlying extension context.
     */
    protected readonly _CONTEXT: vscode.ExtensionContext;
    /**
     * Stores the global output channel.
     */
    protected readonly _OUTPUT_CHANNEL: vscode.OutputChannel;
    /**
     * Stores the package file of that extension.
     */
    protected readonly _PACKAGE_FILE: chat_contracts.PackageFile;
    /**
     * Stores the currently running server.
     */
    protected _server: chat_server.XMPPServer;

    /**
     * Initializes a new instance of that class.
     * 
     * @param {vscode.ExtensionContext} context The underlying extension context.
     * @param {vscode.OutputChannel} outputChannel The global output channel to use.
     * @param {chat_contracts.PackageFile} pkgFile The package file of that extension.
     */
    constructor(context: vscode.ExtensionContext,
                outputChannel: vscode.OutputChannel,
                pkgFile: chat_contracts.PackageFile) {
        this._CONTEXT = context;
        this._OUTPUT_CHANNEL = outputChannel;
        this._PACKAGE_FILE = pkgFile;
    }

    /**
     * Gets the current configuration.
     */
    public get config(): chat_contracts.Configuration {
        return this._config;
    }

    /**
     * Connects to a server.
     * 
     * @return {Thenable<chat_client.XMPPClient>} The promise.
     */
    public connectTo(): Thenable<chat_client.XMPPClient> {
        let me = this;
        
        return new Promise<chat_client.XMPPClient>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                vscode.window.showInputBox({
                    placeHolder: 'Format: host[:port = 5222]',
                    prompt: 'Enter the ADDRESS of the server.',
                }).then((addr) => {
                    addr = chat_helpers.normalizeString(addr);
                    if (!addr) {
                        completed(null, null);
                        return;
                    } 

                    try {
                        let host: string;
                        let port: number;

                        let sepIndex = addr.indexOf(':');
                        if (sepIndex > -1) {
                            host = addr.substr(0, sepIndex).trim();
                            port = parseInt(addr.substr(sepIndex + 1).trim());
                        }

                        if (!host) {
                            host = 'localhost';
                        }

                        if (isNaN(port)) {
                            port = chat_contracts.DEFAULT_PORT;
                        }

                        vscode.window.showInputBox({
                            placeHolder: 'Format: username[@domain]',
                            prompt: 'Enter your username / JID',
                        }).then((jid) => {
                            jid = chat_helpers.toStringSafe(jid).trim();
                            if (!jid) {
                                completed(null, null);
                                return;
                            }

                            try {
                                let domain: string;
                                let user: string;

                                let sepIndex = jid.indexOf('@');
                                if (sepIndex > -1) {
                                    user = jid.substr(0, sepIndex).trim();
                                    domain = jid.substr(sepIndex + 1).trim();
                                }

                                if (chat_helpers.isEmptyString(domain)) {
                                    domain = host;
                                }

                                if (chat_helpers.isEmptyString(user)) {
                                    user = me.name;
                                }

                                vscode.window.showInputBox({
                                    value: '',
                                    prompt: 'Your password',
                                    password: true,
                                }).then((pwd) => {
                                    if (chat_helpers.isNullOrUndefined(pwd)) {
                                        completed(null, null);
                                        return;
                                    }

                                    try {
                                        let newConnection = new chat_client.XMPPClient(me);

                                        newConnection.connect({
                                            host: host,
                                            domain: domain,
                                            password: pwd,
                                            port: port,
                                            user: user,
                                        }).then(() => {
                                            completed(null, newConnection);
                                        }, (err) => {
                                            completed(err);
                                        });
                                    }
                                    catch (e) {
                                        completed(e);
                                    }
                                }, (err) => {
                                    completed(err);
                                });
                            }
                            catch (e) {
                                completed(e);
                            }
                        }, (err) => {
                            completed(err);
                        })
                    }
                    catch (e) {
                        completed(e);
                    }
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Gets the underlying extension context.
     */
    public get context(): vscode.ExtensionContext {
        return this._CONTEXT;
    }

    /** @inheritdoc */
    public dispose() {
        let me = this;
        
        me.stop().then(() => {
        }, (err) => {
            me.log(`[ERROR] Controller.dispose().stop(): ${chat_helpers.toStringSafe(err)}`);
        });
    }

    /**
     * Logs a message.
     * 
     * @param {any} msg The message to log.
     * 
     * @chainable
     */
    public log(msg: any): Controller {
        let now = Moment();

        this.outputChannel
            .appendLine(`[${now.format('YYYY-MM-DD HH:mm:ss')}] ${chat_helpers.toStringSafe(msg)}`);

        return this;
    }

    /**
     * Gets the name of that machine.
     */
    public get name(): string {
        return chat_helpers.normalizeString(OS.hostname());
    }

    /**
     * Is invoked after extension has been activated.
     */
    public onActivated() {
        this.reloadConfiguration();
    }

    /**
     * Is invoked when extension will be deactivated.
     */
    public onDeactivate() {
        let me = this;
        
        me.stop().then(() => {
        }, (err) => {
            me.log(`[ERROR] Controller.onDeactivate().stop(): ${chat_helpers.toStringSafe(err)}`);
        });
    }

    /**
     * Event after configuration changed.
     */
    public onDidChangeConfiguration() {
        this.reloadConfiguration();
    }

    /**
     * Gets the global output channel.
     */
    public get outputChannel(): vscode.OutputChannel {
        return this._OUTPUT_CHANNEL;
    }

    /**
     * Gets the package file of that extension.
     */
    public get packageFile(): chat_contracts.PackageFile {
        return this._PACKAGE_FILE;
    }

    /**
     * Reloads configuration.
     */
    public reloadConfiguration() {
        let cfg = <chat_contracts.Configuration>vscode.workspace.getConfiguration("chat");

        this._config = cfg || {};
    }

    /**
     * Starts a server based on the current configuration.
     * 
     * @return {Thenable<boolean>} The promise.
     */
    public start(): Thenable<boolean> {
        let me = this;

        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                if (me._server) {
                    completed(null, false);  // already running
                    return;
                }

                let cfg = me.config;

                let newServer = new chat_server.XMPPServer(me);
                newServer.start({
                    domain: cfg.domain,
                    port: cfg.port,
                }).then((hasBeenStarted) => {
                    if (hasBeenStarted) {
                        me._server = newServer;
                    }

                    completed(null, hasBeenStarted);
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }

    /**
     * Stops the current server.
     * 
     * @return {Thenable<boolean>} The promise.
     */
    public stop(): Thenable<boolean> {
        let me = this;        

        return new Promise<boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let oldServer = me._server;
                if (!oldServer) {
                    completed(null, false);  // no server running
                    return;
                }

                oldServer.stop().then((hasBeenStopped) => {
                    if (hasBeenStopped) {
                        me._server = null;
                    }

                    completed(null, hasBeenStopped);
                }, (err) => {
                    completed(err);
                });
            }
            catch (e) {
                completed(e);
            }
        });
    }
}
