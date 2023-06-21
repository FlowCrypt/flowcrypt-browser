/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { PgpBlockView } from '../pgp_block.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Lang } from '../../../js/common/lang.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class PgpBlockViewRenderModule {
  private heightHist: number[] = [];

  public constructor(private view: PgpBlockView) {}

  public renderText = (text: string) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    document.getElementById('pgp_block')!.innerText = text;
  };

  public resizePgpBlockFrame = () => {
    const origHeight = $('#pgp_block').height();
    if (!origHeight) {
      // https://github.com/FlowCrypt/flowcrypt-browser/issues/3519
      // unsure why this happens. Sometimes height will come in as exactly 0 after the iframe was already properly sized
      // that then causes to default to 20 + 40 = 60px for height, hiding contents of the message if it in fact is taller
      return;
    }
    let height = Math.max(origHeight, 20) + 40 + 17 + 3 + 13; // pgp_badge has 17px height + 3px padding + 1em (13px) bottom margin
    this.heightHist.push(height);
    const len = this.heightHist.length;
    if (
      len >= 4 &&
      this.heightHist[len - 1] === this.heightHist[len - 3] &&
      this.heightHist[len - 2] === this.heightHist[len - 4] &&
      this.heightHist[len - 1] !== this.heightHist[len - 2]
    ) {
      console.info('pgp_block.js: repetitive resize loop prevented'); // got repetitive, eg [70, 80, 200, 250, 200, 250]
      height = Math.max(this.heightHist[len - 1], this.heightHist[len - 2]); // pick the larger number to stop if from oscillating
    }
    BrowserMsg.send.setCss(this.view.parentTabId, {
      selector: `iframe#${this.view.frameId}`,
      css: { height: `${height}px` },
    });
  };

  public renderContent = (htmlContent: string, isErr: boolean) => {
    let contentWithLink = linkifyHtml(htmlContent);

    // Temporary workaround for an issue where 'cryptup_reply' divs are not being hidden when replying to all
    // messages from the FES. The root cause is that FES currently returns the body of
    // password message replies as 'text/plain', which does not hide the divs as intended.
    // This workaround can be safely removed once the FES is updated to return the body of message replies as 'text/html'.
    // https://github.com/FlowCrypt/flowcrypt-browser/issues/5004
    const regEx = /&lt;div[^&]*class="[^"]*cryptup_reply[^"]*"[^&]*&gt;&lt;\/div&gt;/g;
    contentWithLink = contentWithLink.replace(regEx, match => {
      return match.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    });

    if (!isErr) {
      // rendering message content
      $('.pgp_print_button').show();
      $('#pgp_block').html(Xss.htmlSanitizeKeepBasicTags(contentWithLink)); // xss-sanitized
      Xss.appendRemoteImagesToContainer();
      $('#pgp_block .remote_image_container img').on(
        'load',
        this.view.setHandler(() => this.resizePgpBlockFrame())
      );
    } else {
      // rendering our own ui
      Xss.sanitizeRender('#pgp_block', contentWithLink);
    }
    if (isErr) {
      $('.action_show_raw_pgp_block').on(
        'click',
        this.view.setHandler(target => {
          $('.raw_pgp_block').css('display', 'block');
          $(target).css('display', 'none');
          this.resizePgpBlockFrame();
        })
      );
    }
    this.resizePgpBlockFrame(); // resize window now
    Catch.setHandledTimeout(() => {
      window.addEventListener(
        'resize',
        this.view.setHandlerPrevent('spree', () => this.resizePgpBlockFrame())
      );
    }, 1000); // start auto-resizing the window after 1s
  };

  public setFrameColor = (color: 'red' | 'green' | 'gray') => {
    if (color === 'red') {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if (color === 'green') {
      $('#pgp_background').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('#pgp_background').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  };

  public renderAsRegularContent = (content: string) => {
    this.setFrameColor('gray');
    this.renderSignatureStatus('not signed');
    this.renderEncryptionStatus('not encrypted');
    this.renderContent(content, false);
    Ui.setTestState('ready');
  };

  public renderPassphraseNeeded = (longids: string[]) => {
    const enterPp = `<a href="#" class="enter_passphrase" data-test="action-show-passphrase-dialog">${Lang.pgpBlock.enterPassphrase}</a> ${Lang.pgpBlock.toOpenMsg}`;
    this.view.errorModule.renderErr(enterPp, undefined, 'pass phrase needed');
    $('.enter_passphrase').on(
      'click',
      this.view.setHandler(() => {
        Ui.setTestState('waiting');
        BrowserMsg.send.passphraseDialog(this.view.parentTabId, {
          type: 'message',
          longids,
        });
      })
    );
  };
  public renderErrorStatus = (status: string): JQuery<HTMLElement> => {
    return $('#pgp_error').text(status).show();
  };

  public clearErrorStatus = (): JQuery<HTMLElement> => {
    return $('#pgp_error').hide();
  };

  public renderEncryptionStatus = (status: string): JQuery<HTMLElement> => {
    return $('#pgp_encryption')
      .addClass(status === 'encrypted' ? 'green_label' : 'red_label')
      .text(status);
  };

  public renderSignatureStatus = (status: string): JQuery<HTMLElement> => {
    return $('#pgp_signature')
      .addClass(status === 'signed' ? 'green_label' : 'red_label')
      .text(status);
  };

  public renderSignatureOffline = () => {
    this.renderSignatureStatus('error verifying signature: offline, click to retry').on(
      'click',
      this.view.setHandler(() => window.parent.postMessage({ retry: this.view.frameId }, '*'))
    );
  };
}
