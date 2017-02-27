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
     * Stores all open connections.
     */
    protected _openConnections: chat_client.XMPPClient[];
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
     * Closes connection(s).
     * 
     * @return {Thenable<chat_contracts.ClientConnectionInfo|boolean>} The promise.
     */
    public closeConnections(): Thenable<chat_contracts.ClientConnectionInfo | boolean> {
        let me = this;
        
        return new Promise<chat_contracts.ClientConnectionInfo | boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let connections = me._openConnections.filter(x => x);

                interface ConnectionQuickPickItem extends vscode.QuickPickItem {
                    __vschatConn: chat_client.XMPPClient;
                    __vschatIndex: number;
                }

                let quickPicks: ConnectionQuickPickItem[] = [
                    {
                        __vschatConn: undefined,
                        __vschatIndex: undefined,
                        label: '(All)',
                        description: 'Removes all stored settings',
                    }
                ];

                quickPicks = quickPicks.concat(connections.map((x, i): ConnectionQuickPickItem => {
                    let label = '';
                    let description = '';

                    let data = x.connection;
                    if (data) {
                        label = `${data.host}:${data.port}`;
                        description = `Logged in as '${data.user}@${data.domain}'`;
                    }

                    return {
                        '__vschatIndex': i,
                        '__vschatConn': x,
                        label: label,
                        description: description,
                    };
                }));

                if (connections.length > 0) {
                    vscode.window.showQuickPick(quickPicks, {
                        placeHolder: 'Select the connection you would like to close',
                    }).then((selectedItem) => {
                        if (selectedItem) {
                            let result: chat_contracts.ClientConnectionInfo | boolean;
                            let connectionsToClose: chat_client.XMPPClient[];
                            if (selectedItem.__vschatConn) {
                                result = selectedItem.__vschatConn.connection;

                                connectionsToClose = connections.filter(x => {
                                    return x.connection.id === selectedItem.__vschatConn.connection.id;
                                });
                            }
                            else {
                                connectionsToClose = connections;
                                result = true;
                            }

                            let nextConnection: () => void;
                            nextConnection = () => {
                                if (connectionsToClose.length < 1) {
                                    me._openConnections = me._openConnections.filter(x => x.isConnected);

                                    completed(null, result);
                                    return;
                                }

                                let c = connectionsToClose.shift();
                                c.close().then(() => {
                                    nextConnection();
                                }, (err) => {
                                    completed(err);
                                });
                            };

                            nextConnection();
                        }
                        else {
                            completed(null, null);
                        }
                    }, (err) => {
                        completed(err);
                    });
                }
                else {
                    completed(null, false);
                }
            }
            catch (e) {
                completed(e);
            }
        });
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
                let host: string;
                try {
                    host = me.context.globalState.get<string>(chat_contracts.MEMENTO_LAST_HOST);
                }
                catch (e) {

                }
                let port: number;
                try {
                    port = me.context.globalState.get<number>(chat_contracts.MEMENTO_LAST_HOST);
                }
                catch (e) {

                }

                let getRepoKey = (): string => {
                    let key: string;
                    if (host && !isNaN(port)) {
                        key = chat_helpers.normalizeString(`${host}:${port}`);
                    }

                    return key;
                };

                let getLastSettings = (): chat_contracts.LastConnectionSettings => {
                    let lastSettings: chat_contracts.LastConnectionSettings;
                    try {
                        let repo = me.context.globalState.get<chat_contracts.LastConnectionSettingRepository>(chat_contracts.MEMENTO_LAST_CONNECTION_SETTINGS);
                        if (repo) {
                            let key = getRepoKey();

                            if (key) {
                                lastSettings = repo[key];
                            }
                        }
                    }
                    catch (e) {
                        me.log(`[ERROR] Controller.connectTo().getLastSettings(): ${chat_helpers.toStringSafe(e)}`);
                    }

                    return lastSettings || {};
                };

                let connSettings = getLastSettings();

                let initialHostValue = '';
                if (!chat_helpers.isEmptyString(host)) {
                    initialHostValue += host;
                }
                if (!isNaN(port)) {
                    initialHostValue += ':' + port;
                }

                // host and port
                vscode.window.showInputBox({
                    value: initialHostValue,
                    placeHolder: 'Format: host[:port = 5222]',
                    prompt: 'Chat HOST',
                }).then((addr) => {
                    addr = chat_helpers.normalizeString(addr);
                    if (!addr) {
                        completed(null, null);
                        return;
                    } 

                    try {
                        let domain: string;
                        let user: string;
                        let password: string;
                        let askForSavingPassword: boolean;
                        
                        let updateLastSettings = (savePassword = false): chat_contracts.LastConnectionSettings => {
                            try {
                                let key = getRepoKey();
                                if (!key) {
                                    return;
                                }

                                let repo = me.context.globalState.get<chat_contracts.LastConnectionSettingRepository>(chat_contracts.MEMENTO_LAST_CONNECTION_SETTINGS) || {};

                                let lastSettings: chat_contracts.LastConnectionSettings = {
                                    domain: domain,
                                    user: user,
                                    askForSavingPassword: askForSavingPassword,
                                };

                                if (savePassword) {
                                    lastSettings.password = password;
                                }

                                repo[key] = lastSettings;

                                me.context.globalState.update(chat_contracts.MEMENTO_LAST_CONNECTION_SETTINGS, repo);
                                askForSavingPassword = lastSettings.askForSavingPassword;
                            }
                            catch (e) {
                                me.log(`[ERROR] Controller.connectTo().updateLastSettings(): ${chat_helpers.toStringSafe(e)}`);
                            }

                            return getLastSettings();
                        };

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

                        // save last host and port
                        try {
                            me.context.globalState.update(chat_contracts.MEMENTO_LAST_HOST, host);
                            me.context.globalState.update(chat_contracts.MEMENTO_LAST_PORT, port);
                        }
                        catch (e) {
                        }

                        connSettings = getLastSettings();

                        let initialUserValue = '';
                        if (!chat_helpers.isEmptyString(connSettings.user)) {
                            initialUserValue += connSettings.user;
                        }
                        if (!chat_helpers.isEmptyString(connSettings.domain)) {
                            initialUserValue += '@' + connSettings.domain;
                        }

                        let askForPassword = () => {
                            let initialPasswordValue = '';
                            if (connSettings.password) {
                                initialPasswordValue = chat_helpers.toStringSafe(connSettings.password);
                            }

                            let startConnection = () => {
                                let savePassword = () => {
                                    connSettings = getLastSettings();
                                    if (!chat_helpers.toBooleanSafe(connSettings.askForSavingPassword, true)) {
                                        return;
                                    }

                                    vscode.window.showQuickPick(['No', 'Yes'], {
                                        placeHolder: `SAVE password '${user}@${domain}'?`,
                                    }).then((selected) => {
                                        selected = chat_helpers.normalizeString(selected);

                                        let savePwd = false;
                                        askForSavingPassword = false;
                                        if ('yes' === selected) {
                                            savePwd = true;
                                        }
                                        else if ('no' === selected) {
                                            password = undefined;
                                        }
                                        else {
                                            askForSavingPassword = undefined;
                                        }

                                        connSettings = updateLastSettings(savePwd);
                                    });
                                };

                                try {
                                    let newConnection = new chat_client.XMPPClient(me);

                                    newConnection.connect({
                                        host: host,
                                        domain: domain,
                                        password: password,
                                        port: port,
                                        user: user,
                                    }).then(() => {
                                        updateLastSettings();

                                        me._openConnections.push(newConnection);
                                        completed(null, newConnection);

                                        savePassword();
                                    }, (err) => {
                                        connSettings = getLastSettings();

                                        delete connSettings.password;
                                        connSettings = updateLastSettings();

                                        completed(err);
                                    });
                                }
                                catch (e) {
                                    completed(e);
                                }
                            };

                            if (initialPasswordValue) {
                                password = connSettings.password;

                                startConnection();
                            }
                            else {
                                vscode.window.showInputBox({
                                    value: initialPasswordValue,
                                    prompt: `PASSWORD for '${user}@${domain}'`,
                                    password: true,
                                }).then((pwd) => {
                                    if (chat_helpers.isNullOrUndefined(pwd)) {
                                        completed(null, null);
                                        return;
                                    }

                                    password = pwd;
                                    startConnection();
                                }, (err) => {
                                    completed(err);
                                });
                            }
                        };

                        if (initialUserValue) {
                            user = connSettings.user;
                            domain = connSettings.domain;

                            askForPassword();
                        }
                        else {
                            // ask for user

                            vscode.window.showInputBox({
                                value: '',
                                placeHolder: 'Format: username[@domain]',
                                prompt: `User / JID for '${host}:${port}'`,
                            }).then((jid) => {
                                jid = chat_helpers.toStringSafe(jid).trim();
                                if (!jid) {
                                    completed(null, null);
                                    return;
                                }

                                try {
                                    let sepIndex = jid.indexOf('@');
                                    if (sepIndex > -1) {
                                        user = jid.substr(0, sepIndex).trim();
                                        domain = jid.substr(sepIndex + 1).trim();
                                    }
                                    else {
                                        user = jid;
                                    }

                                    if (chat_helpers.isEmptyString(domain)) {
                                        domain = host;
                                    }

                                    if (chat_helpers.isEmptyString(user)) {
                                        user = me.name;
                                    }

                                    askForPassword();
                                }
                                catch (e) {
                                    completed(e);
                                }
                            }, (err) => {
                                completed(err);
                            });   
                        }
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

    /**
     * Deletes settings.
     * 
     * @return {Thenable<string|boolean>} The promise.
     */
    public deleteSettings(): Thenable<string | boolean> {
        let me = this;

        return new Promise<string | boolean>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);
            
            try {
                let keys: string[] = [];

                let repo = me.context.globalState.get<chat_contracts.LastConnectionSettingRepository>(chat_contracts.MEMENTO_LAST_CONNECTION_SETTINGS);
                if (repo) {
                    for (let k in repo) {
                        keys.push(k);
                    }    
                }

                if (keys.length > 0) {
                    interface RemoveStoredSettingsQuickPickItem extends vscode.QuickPickItem {
                        __vschatIndex: number;
                    }

                    let quickPicks: RemoveStoredSettingsQuickPickItem[] = [
                        {
                            __vschatIndex: undefined,
                            label: '(All)',
                            description: 'Removes all stored settings',
                        }
                    ];

                    quickPicks = quickPicks.concat(keys.map((x, i): RemoveStoredSettingsQuickPickItem => {
                        let result: any = {
                            '__vschatIndex': i,
                            label: x,
                            description: '',
                        };

                        return result;
                    }));

                    vscode.window.showQuickPick(quickPicks).then((selectedItem) => {
                        try {
                            let result: string | boolean = null;

                            if (selectedItem) {
                                let key = selectedItem.label;

                                if (chat_helpers.isNullOrUndefined(selectedItem.__vschatIndex)) {
                                    repo = {};
                                    result = true;
                                }
                                else {
                                    delete repo[key];
                                    result = key;
                                }

                                me.context.globalState.update(chat_contracts.MEMENTO_LAST_CONNECTION_SETTINGS, repo);
                            }

                            completed(null, result);
                        }
                        catch (e) {
                            completed(e);
                        }
                    }, (err) => {
                        completed(err);
                    });
                }
                else {
                    completed(null, false);  // nothing that can be deleted
                }
            }
            catch (e) {
                completed(e);
            }
        });
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
        let me = this;

        let cfg = <chat_contracts.Configuration>vscode.workspace.getConfiguration("chat");

        me._config = cfg || {};

        let oldConnections = me._openConnections;
        if (oldConnections) {
            oldConnections.filter(x => x).forEach(x => {
                x.close().then(() => {

                }, () => {

                });
            });
        }
        me._openConnections = [];

        // auto start?
        if (chat_helpers.toBooleanSafe(cfg.autoStart)) {
            let startServer = () => {
                me.start().then((hasBeenStarted) => {
                    if (hasBeenStarted) {
                        if (chat_helpers.toBooleanSafe(cfg.showPopupOnSuccess, true)) {
                            vscode.window.showInformationMessage(`[vs-chat] Chat server is RUNNING now!`);
                        }
                    }
                    else {
                        vscode.window.showWarningMessage(`[vs-chat] Server has NOT been STARTED!`);
                    }
                }, (err) => {
                    vscode.window.showErrorMessage(`[vs-chat] Could not START server: ${chat_helpers.toStringSafe(err)}`);
                });
            };

            let currentServer = me._server;
            if (currentServer) {
                // first stop server

                currentServer.stop().then((hasBeenStopped) => {
                    if (hasBeenStopped) {
                        startServer();
                    }
                    else {
                        vscode.window.showWarningMessage(`[vs-chat] Server has NOT been STOPPED!`);
                    }
                }, (err) => {
                    vscode.window.showErrorMessage(`[vs-chat] Could not STOP server: ${chat_helpers.toStringSafe(err)}`);
                });
            }
            else {
                startServer();
            }
        }
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
