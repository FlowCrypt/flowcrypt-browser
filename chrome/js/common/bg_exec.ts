
class BgExec {

  public static background_request_handler: BrowserMessageHandler = async (message: BgExecRequest, sender, respond: (r: BgExecResponse) => void) => {
    try {
      let arg_promises = BgExec.arg_object_urls_consume(message.args);
      let args = await Promise.all(arg_promises);
      let result = await BgExec.execute_and_format_result(message.path, args);
      respond({result});
    } catch(e) {
      try {
        respond({
          exception: {
            name: e.constructor.name,
            message: e.message,
            stack: (e.stack || '') + ((e as any).workerStack ? `\n\nWorker stack:\n${(e as any).workerStack}`: ''),
          },
        });
      } catch (e2) {
        respond({
          exception: {
            name: `CANNOT_PROCESS_BG_EXEC_ERROR: ${String(e2)}`,
            message: String(e),
            stack: new Error().stack!,
          },
        });
      }
    }
  }

  public static diagnose_message_pubkeys = (account_email: string, message: string) => {
    return BgExec.request_to_process_in_background('Pgp.message.diagnose_pubkeys', [account_email, message]) as Promise<DiagnoseMessagePubkeysResult>;
  }

  public static crypto_hash_challenge_answer = (password: string) => {
    return BgExec.request_to_process_in_background('Pgp.hash.challenge_answer', [password]) as Promise<string>;
  }

  public static crypto_message_decrypt = async (account_email: string, encrypted_data: string|Uint8Array, msg_pwd:string|null=null, get_uint8=false) => {
    let result = await BgExec.request_to_process_in_background('Pgp.message.decrypt', [account_email, encrypted_data, msg_pwd, get_uint8]) as DecryptResult;
    if (result.success && result.content && result.content.blob && result.content.blob.blob_url.indexOf(`blob:${chrome.runtime.getURL('')}`) === 0) {
      if(result.content.blob.blob_type === 'text') {
        result.content.text = Str.from_uint8(await tool.file.object_url_consume(result.content.blob.blob_url));
      } else {
        result.content.uint8 = await tool.file.object_url_consume(result.content.blob.blob_url);
      }
      result.content.blob = undefined;
    }
    return result;
  }

  public static crypto_message_verify_detached = (account_email: string, message: string|Uint8Array, signature: string|Uint8Array) => {
    return BgExec.request_to_process_in_background('Pgp.message.verify_detached', [account_email, message, signature]) as Promise<MessageVerifyResult>;
  }

  private static execute_and_format_result = async (path: string, resolved_args: any[]): Promise<PossibleBgExecResults> => {
    let f = BgExec.resolve_path_to_callable_function(path);
    let returned: Promise<PossibleBgExecResults>|PossibleBgExecResults = f.apply(null, resolved_args);
    if (returned && typeof returned === 'object' && typeof (returned as Promise<PossibleBgExecResults>).then === 'function') { // got a promise
      let resolved = await returned;
      if (path === 'Pgp.message.decrypt') {
        BgExec.crypto_message_decrypt_result_create_blobs(resolved as DecryptResult);
      }
      return resolved;
    }
    return returned as PossibleBgExecResults; // direct result
  }

  private static crypto_message_decrypt_result_create_blobs = (decrypt_result: DecryptResult) => {
    if (decrypt_result && decrypt_result.success && decrypt_result.content) {
      if(decrypt_result.content.text && decrypt_result.content.text.length >= MAX_MESSAGE_SIZE) {
        decrypt_result.content.blob = {blob_type: 'text', blob_url: tool.file.object_url_create(decrypt_result.content.text)};
        decrypt_result.content.text = undefined; // replaced with a blob
      } else if(decrypt_result.content.uint8 && decrypt_result.content.uint8 instanceof Uint8Array) {
        decrypt_result.content.blob = {blob_type: 'uint8', blob_url: tool.file.object_url_create(decrypt_result.content.uint8)};
        decrypt_result.content.uint8 = undefined; // replaced with a blob
      }
    }
  }

  private static is_object_url = (arg: any) => typeof arg === 'string' && arg.indexOf('blob:' + chrome.runtime.getURL('')) === 0;

  private static should_be_object_url = (arg: any) => (typeof arg === 'string' && arg.length > BrowserMsg.MAX_SIZE) || arg instanceof Uint8Array;

  private static arg_object_urls_consume = (args: any[]) => args.map((arg: any) => BgExec.is_object_url(arg) ? tool.file.object_url_consume(arg) : arg);

  private static arg_object_urls_create = (args: any[]) => args.map(arg => BgExec.should_be_object_url(arg) ? tool.file.object_url_create(arg) : arg);

  private static resolve_path_to_callable_function = (path: string): Function => {  // tslint:disable-line:ban-types
    let f:Function|object|null = null; // tslint:disable-line:ban-types
    for (let step of path.split('.')) {
      if (f === null && step === 'tool') {
        f = tool;
      } else if (f === null && step === 'window') {
        f = window;
      } else {
        // @ts-ignore
        f = f[step];
      }
    }
    return f as Function; // tslint:disable-line:ban-types
  }

  private static request_to_process_in_background = async (path: string, args: any[]) => {
    let response: BgExecResponse = await BrowserMsg.send_await(null, 'bg_exec', {path, args: BgExec.arg_object_urls_create(args)});
    if(response.exception) {
      let e = new Error(`[BgExec] ${response.exception.name}: ${response.exception.message}`);
      e.stack += `\n\nBgExec stack:\n${response.exception.stack}`;
      throw e;
    }
    return response.result!;
  }

}
