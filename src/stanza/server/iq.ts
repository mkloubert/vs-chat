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

import * as chat_contracts from '../../contracts';
import * as chat_helpers from '../../helpers';
import * as chat_server from '../../server';
const XMPP = require('node-xmpp-server');


export function handle(ctx: chat_server.StanzaContext) {
    let requestHandler: (ctx: chat_contracts.Stanza) => any;

    switch (chat_helpers.normalizeString(ctx.stanza.attrs['type'])) {
        case 'get':
            if (ctx.stanza.children && ctx.stanza.children.length > 0) {
                let child = ctx.stanza.children[0];
                if (child) {
                    if ('query' === chat_helpers.normalizeString(child.name)) {
                        let xmlns = chat_helpers.normalizeString(child.attrs['xmlns']);

                        switch (xmlns) {
                            case 'http://jabber.org/protocol/disco#info':
                                requestHandler = handleStanza_discoInfo;
                                break;

                            case 'http://jabber.org/protocol/disco#items':
                                requestHandler = handleStanza_discoItems;
                                break;

                            case 'http://jabber.org/protocol/bytestreams':
                                requestHandler = handleStanza_byteStreams;
                                break;

                            case 'jabber:iq:roster':
                                requestHandler = handleStanza_jabber_iq_roaster;
                                break;

                            case 'http://etherx.jabber.org/streams':
                                requestHandler = handleStanza_streams;
                                break;
                        }
                    }
                }
            }
            break;
    }

    let response: any;

    if (requestHandler) {
        response = requestHandler(ctx.stanza);
    }

    if (!response) {
        response = new XMPP.Stanza('iq', { 'type': 'error' });

        let error = response.c('error');

        let unexpectedRequest = error.c('unexpected-request',
                                        { xmlns: 'urn:ietf:params:xml:ns:xmpp-stanzas' });
    }

    ctx.client.client.send(response);
}

function handleStanza_byteStreams(stanza: chat_contracts.Stanza) {
    let iqID = stanza.attrs['id'];
    let from = stanza.attrs['from'];
    let to = stanza.attrs['to'];

    let response = new XMPP.Stanza('iq', { 'type': 'result',
                                           'from': to, 'to': from,
                                           'id': iqID });

    return response;
}

function handleStanza_discoInfo(stanza: chat_contracts.Stanza) {
    let iqID = stanza.attrs['id'];
    let from = stanza.attrs['from'];
    let to = stanza.attrs['to'];

    let child = stanza.children[0];

    let xmlns = child.attrs['xmlns'];

    let response = new XMPP.Stanza('iq', { 'type': 'result',
                                           'from': to, 'to': from,
                                           'id': iqID });

    let query = response.c('query', { xmlns: xmlns });

    return response;
}

function handleStanza_discoItems(stanza: chat_contracts.Stanza) {
    let iqID = stanza.attrs['id'];
    let from = stanza.attrs['from'];
    let to = stanza.attrs['to'];

    let child = stanza.children[0];

    let xmlns = child.attrs['xmlns'];

    let response = new XMPP.Stanza('iq', { 'type': 'result',
                                           'from': to, 'to': from,
                                           'id': iqID });

    let query = response.c('query', { xmlns: xmlns });

    return response;
}

function handleStanza_jabber_iq_roaster(stanza: chat_contracts.Stanza) {
    let iqID = stanza.attrs['id'];
    let from = stanza.attrs['from'];
    let to = stanza.attrs['to'];

    let child = stanza.children[0];

    let xmlns = child.attrs['xmlns'];

    let response = new XMPP.Stanza('iq', { 'type': 'result',
                                           'to': from,
                                           'id': iqID });

    let query = response.c('query', { xmlns: xmlns });

    return response;
}

function handleStanza_streams(stanza: chat_contracts.Stanza) {
}
