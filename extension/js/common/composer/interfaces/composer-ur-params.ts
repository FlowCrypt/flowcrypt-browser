export type ComposerUrlParams = {
    disableDraftSaving: boolean;
    isReplyBox: boolean;
    tabId: string;
    acctEmail: string;
    threadId: string;
    draftId: string;
    subject: string;
    from: string | undefined;
    to: string[];
    frameId: string;
    parentTabId: string;
    skipClickPrompt: boolean;
    debug: boolean;
};
