/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Composer } from '../composer.js';
import { MessageToReplyOrForward } from './interfaces/composer-types.js';
import { Xss } from '../platform/xss.js';
import { Str } from '../core/common.js';
import { Ui } from '../browser.js';
import { Api } from '../api/api.js';
import { Catch } from '../platform/catch.js';

export class ComposerQuote {
    private composer: Composer;

    private messageToReplyOrForward: MessageToReplyOrForward | undefined;
    private msgExpandingHTMLPart: string | undefined;

    get expandingHTMLPart(): string | undefined {
        return this.msgExpandingHTMLPart;
    }

    constructor(composer: Composer) {
        this.composer = composer;
    }

    public addTripleDotQuoteExpandBtn = async (msgId: string, method: ('reply' | 'forward')) => {
        if (!this.messageToReplyOrForward) {
            this.composer.S.cached('icon_show_prev_msg').show().addClass('progress');
            Xss.sanitizeAppend(this.composer.S.cached('icon_show_prev_msg'), '<div id="loader">0%</div>');
            this.composer.resizeComposeBox();
            try {
                this.messageToReplyOrForward = await this.composer.getAndDecryptMessage(msgId, (progress) => this.setQuoteLoaderProgress(progress + '%'));
            } catch (e) {
                if (Api.err.isSignificant(e)) {
                    Catch.reportErr(e);
                }
                await Ui.modal.error(`Could not load quoted content, please try again.\n\n${Api.err.eli5(e)}`);
            }
            this.composer.S.cached('icon_show_prev_msg').find('#loader').remove();
            this.composer.S.cached('icon_show_prev_msg').removeClass('progress');
        }
        if (!this.messageToReplyOrForward) {
            this.composer.S.cached('icon_show_prev_msg').click(Ui.event.handle(async el => {
                this.composer.S.cached('icon_show_prev_msg').unbind('click');
                await this.addTripleDotQuoteExpandBtn(msgId, method);
                if (this.messageToReplyOrForward) {
                    this.composer.S.cached('icon_show_prev_msg').click();
                }
            }));
            return;
        }
        if (this.messageToReplyOrForward.text) {
            if (method === 'forward') {
                this.composer.S.cached('icon_show_prev_msg').remove();
                await this.appendForwardedMsg(this.messageToReplyOrForward.text);
            } else {
                if (!this.messageToReplyOrForward.headers.from || !this.messageToReplyOrForward.headers.date) {
                    this.composer.S.cached('icon_show_prev_msg').hide();
                    return;
                }
                const sentDate = new Date(String(this.messageToReplyOrForward.headers.date));
                this.msgExpandingHTMLPart = '<br><br>' + this.generateHTMLRepliedPart(this.messageToReplyOrForward.text, sentDate, this.messageToReplyOrForward.headers.from);
                this.setExpandingTextAfterClick(this.msgExpandingHTMLPart);
            }
        } else {
            this.composer.S.cached('icon_show_prev_msg').hide();
        }
    }

    private quoteText(text: string) {
        return text.split('\n').map(l => '<br>&gt; ' + l).join('\n');
    }

    private appendForwardedMsg = (text: string) => {
        Xss.sanitizeAppend(this.composer.S.cached('input_text'), `<br/><br/>Forwarded message:<br/><br/>&gt; ${this.quoteText(Xss.escape(text))}`);
        this.composer.resizeComposeBox();
    }

    private generateHTMLRepliedPart = (text: string, date: Date, from: string) => {
        return `On ${Str.fromDate(date).replace(' ', ' at ')}, ${from} wrote:${this.quoteText(Xss.escape(text))}`;
    }

    private setExpandingTextAfterClick = (expandedHTMLText: string) => {
        this.composer.S.cached('icon_show_prev_msg')
            .click(Ui.event.handle(el => {
                el.style.display = 'none';
                Xss.sanitizeAppend(this.composer.S.cached('input_text'), expandedHTMLText);
                this.msgExpandingHTMLPart = undefined;
                this.composer.S.cached('input_text').focus();
                this.composer.resizeComposeBox();
            }));
    }

    private setQuoteLoaderProgress = (text: string) => this.composer.S.cached('icon_show_prev_msg').find('#loader').text(text);
}
