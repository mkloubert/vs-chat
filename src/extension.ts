'use strict';

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
import * as chat_window from './window';
import * as FS from 'fs';
import * as Moment from 'moment';
import * as Path from 'path';
import * as vscode from 'vscode';


let controller: chat_controller.Controller;

export function activate(context: vscode.ExtensionContext) {
    let now = Moment();

    // package file
    let pkgFile: chat_contracts.PackageFile;
    try {
        pkgFile = JSON.parse(FS.readFileSync(Path.join(__dirname, '../../package.json'), 'utf8'));
    }
    catch (e) {
        chat_helpers.log(`[ERROR] extension.activate(): ${chat_helpers.toStringSafe(e)}`);
    }

    let outputChannel = vscode.window.createOutputChannel("Chat");

    // show infos about the app
    {
        if (pkgFile) {
            outputChannel.appendLine(`${pkgFile.displayName} (${pkgFile.name}) - v${pkgFile.version}`);
        }

        outputChannel.appendLine(`Copyright (c) ${now.format('YYYY')}  Marcel Joachim Kloubert <marcel.kloubert@gmx.net>`);
        outputChannel.appendLine('');
        outputChannel.appendLine(`GitHub : https://github.com/mkloubert/vs-chat`);
        outputChannel.appendLine(`Twitter: https://twitter.com/mjkloubert`);
        outputChannel.appendLine(`Donate : [PayPal] https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=PNKTCGJGNX2R8`);
        outputChannel.appendLine(`         [Flattr] https://flattr.com/submit/auto?fid=o62pkd&url=https%3A%2F%2Fgithub.com%2Fmkloubert%2Fvs-chat`);
    }

    controller = new chat_controller.Controller(context, outputChannel, pkgFile);

    // open chat window
    let openChatWindow = vscode.commands.registerCommand('extension.chat.openChatWindow', (/* @TODO */) => {
        try {
            let chatName = '@TODO';

            let url = vscode.Uri.parse(`vs-chat-html://authority/?chat=${encodeURIComponent(chat_helpers.toStringSafe(chatName))}` + 
                                       `&x=${encodeURIComponent(chat_helpers.toStringSafe(new Date().getTime()))}`);

            let title = '@TODO: Chat';

            vscode.commands.executeCommand('vscode.previewHtml', url, vscode.ViewColumn.One, title).then((success) => {
                // TODO
            }, (err) => {
                chat_helpers.log(`[ERROR] extension.chat.openChatWindow(2): ${err}`);
            });
        }
        catch (e) {
            chat_helpers.log(`[ERROR] extension.chat.openChatWindow(1): ${e}`);
        }
    });

    // start server
    let startServer = vscode.commands.registerCommand('extension.chat.startServer', (/* @TODO */) => {
        try {
            controller.start().then((hasBeenStarted) => {
                if (hasBeenStarted) {
                    vscode.window.showInformationMessage('[vs-chat] Server has been STARTED.');
                }
            }, (err) => {
                vscode.window.showErrorMessage(`[vs-chat] Could not START server: ${chat_helpers.toStringSafe(err)}`);
            });
        }
        catch (e) {
            chat_helpers.log(`[ERROR] extension.chat.startServer(): ${e}`);
        }
    });

    // stop server
    let stopServer = vscode.commands.registerCommand('extension.chat.stopServer', (/* @TODO */) => {
        try {
            controller.stop().then((hasBeenStopped) => {
                if (hasBeenStopped) {
                    vscode.window.showInformationMessage('[vs-chat] Server has been STOPPED.');
                }
            }, (err) => {
                vscode.window.showErrorMessage(`[vs-chat] Could not STOP server: ${chat_helpers.toStringSafe(err)}`);
            });
        }
        catch (e) {
            chat_helpers.log(`[ERROR] extension.chat.stopServer(): ${e}`);
        }
    });

    // connect to server
    let connectTo = vscode.commands.registerCommand('extension.chat.connectTo', (/* @TODO */) => {
        try {
            controller.connectTo().then((conn) => {
                if (conn) {
                    
                }
            }, (err) => {
                vscode.window.showErrorMessage(`[vs-chat] Could not CONNECT to server: ${chat_helpers.toStringSafe(err)}`);
            });
        }
        catch (e) {
            chat_helpers.log(`[ERROR] extension.chat.connectTo(): ${e}`);
        }
    });

    let chatWindow = vscode.workspace.registerTextDocumentContentProvider('vs-cron-html',
                                                                          new chat_window.HtmlTextDocumentContentProvider(controller));

    // commands
    context.subscriptions
           .push(openChatWindow,
                 startServer, stopServer,
                 connectTo);

    // controller
    context.subscriptions
           .push(controller);

    // chat window
    context.subscriptions
           .push(chatWindow);

    // notfiy setting changes
    context.subscriptions
           .push(vscode.workspace.onDidChangeConfiguration(controller.onDidChangeConfiguration, controller));

    controller.onActivated();
}

export function deactivate() {
    if (controller) {
        controller.onDeactivate();
    }
}