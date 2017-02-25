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
import * as vscode from 'vscode';

/**
 * HTML content provider.
 */
export class HtmlTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
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
        this._CONTROLLER = controller;
    }

    /**
     * Gets the underlying controller.
     */
    public get controller(): chat_controller.Controller {
        return this._CONTROLLER;
    }

    /** @inheritdoc */
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        let me = this;
        
        return new Promise<string>((resolve, reject) => {
            let completed = chat_helpers.createSimplePromiseCompletedAction(resolve, reject);

            try {
                let html = '';

                completed(null, html);
            }
            catch (e) {
                completed(e);
            }
        });
    }
}
