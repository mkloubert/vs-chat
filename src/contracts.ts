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

import * as vscode from 'vscode';


/**
 * The default TCP port for an un-secure connection.
 */
export const DEFAULT_PORT = 5222;
/**
 * Name of memento value for storing last connection settings.
 */
export const MEMENTO_LAST_CONNECTION_SETTINGS = 'vschatLastConnectionSettings';
/**
 * Name of memento value for storing last host.
 */
export const MEMENTO_LAST_HOST = 'vschatLastHost';
/**
 * Name of memento value for storing last port.
 */
export const MEMENTO_LAST_PORT = 'vschatLastPort';


/**
 * A client.
 */
export interface Client extends vscode.Disposable {
    /**
     * Gets the underlying connection object.
     */
    readonly client: any;
}

/**
 * A connection of a server with a client.
 */
export interface ClientServerConnection extends vscode.Disposable {
    /**
     * Gets the underlying connection object.
     */
    readonly client: any;
    /**
     * Gets the ID of the connection.
     */
    readonly id: number;
}

/**
 * The extension settings.
 */
export interface Configuration {
    /**
     * Run server on startup or not.
     */
    autoStart?: boolean;
    /**
     * The name of the server's domain.
     */
    domain?: string;
    /**
     * The TCP port the XMPP server should run on.
     */
    port?: number;
    /**
     * Indicates if an info popup / notification should be displayed after a successful start/stop of a server or not.
     */
    showPopupOnSuccess?: boolean;
}

/**
 * A repository that stores last connection settings.
 */
export interface LastConnectionSettingRepository {
    /**
     * Gets the settings by key.
     * 
     * @param {string} key The key.
     * 
     * @return {LastConnectionSettings} The settings.
     */
    [key: string]: LastConnectionSettings;
}

/**
 * Stores last connection settings.
 */
export interface LastConnectionSettings {
    /**
     * Domain
     */
    domain?: string;
    /**
     * User
     */
    user?: string;
    /**
     * Password
     */
    password?: string;
    /**
     * Indicates if GUI should ask for saving the password or not.
     */
    askForSavingPassword?: boolean;
}

/**
 * Describes the structure of the package file of that extenstion.
 */
export interface PackageFile {
    /**
     * The display name.
     */
    displayName: string;
    /**
     * The (internal) name.
     */
    name: string;
    /**
     * The version string.
     */
    version: string;
}

/**
 * A server.
 */
export interface Server extends vscode.Disposable {
    /**
     * Returns the connections of this servers with clients.
     */
    readonly getClientConnections: () => ClientServerConnection[];
    /**
     * Gets the underlying connection object.
     */
    readonly server: any;
}

/**
 * A stanza.
 */
export interface Stanza {
    /**
     * The list of attributs.
     */
    attrs?: { [ key: string ]: string };
    /**
     * The children.
     */
    children?: Stanza[];
    /**
     * The name.
     */
    name?: string;
    /**
     * The parent.
     */
    parent?: Stanza;
}
