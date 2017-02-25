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

import * as Moment from 'moment';

/**
 * Describes a simple 'completed' action.
 * 
 * @param {any} [err] The occurred error.
 * @param {TResult} [result] The result.
 */
export type SimpleCompletedAction<TResult> = (err?: any, result?: TResult) => void;


/**
 * Creates a simple 'completed' callback for a promise.
 * 
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 * 
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
export function createSimplePromiseCompletedAction<TResult>(resolve: (value?: TResult | PromiseLike<TResult>) => void,
                                                            reject?: (reason: any) => void): SimpleCompletedAction<TResult> {
    return (err?, result?) => {
        if (err) {
            if (reject) {
                reject(err);
            }
        }
        else {
            if (resolve) {
                resolve(result);
            }
        }
    };
}

/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is empty or not.
 */
export function isEmptyString(val: any): boolean {
    return '' === toStringSafe(val).trim();
}

/**
 * Checks if a value is (null) or (undefined).
 * 
 * @param {any} val The value to check.
 * 
 * @return {boolean} Is (null)/(undefined) or not.
 */
export function isNullOrUndefined(val: any): boolean {
    return null === val ||
           'undefined' === typeof val;
}

/**
 * Logs a message.
 * 
 * @param {any} msg The message to log.
 */
export function log(msg: any) {
    let now = Moment();

    msg = toStringSafe(msg);
    console.log(`[vs-chat :: ${now.format('YYYY-MM-DD HH:mm:ss')}] => ${msg}`);
}

/**
 * Normalizes a value as string so that is comparable.
 * 
 * @param {any} val The value to convert.
 * @param {(str: string) => string} [normalizer] The custom normalizer.
 * 
 * @return {string} The normalized value.
 */
export function normalizeString(val: any, normalizer?: (str: string) => string): string {
    if (!normalizer) {
        normalizer = (str) => str.toLowerCase().trim();
    }

    return normalizer(toStringSafe(val));
}

/**
 * Converts a value to a string that is NOT (null) or (undefined).
 * 
 * @param {any} str The input value.
 * @param {any} defValue The default value.
 * 
 * @return {string} The output value.
 */
export function toStringSafe(str: any, defValue: any = ''): string {
    if (isNullOrUndefined(str)) {
        str = '';
    }
    str = '' + str;
    if ('' === str) {
        str = defValue;
    }

    return str;
}
