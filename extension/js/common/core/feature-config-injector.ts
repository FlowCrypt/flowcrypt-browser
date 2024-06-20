/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
(() => {
  // Define the payload with explicit types
  const payload: string = JSON.stringify([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    String((window as any).GM_SPT_ENABLED),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    String((window as any).GM_RFT_ENABLED),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    String(((window as any).GLOBALS || [])[10]),
  ]);

  // Attempt to retrieve the existing div element
  let e: HTMLElement | null = document.getElementById('FC_VAR_PASS');

  // If the element doesn't exist, create it, set its properties, and append it to the body
  if (!e) {
    e = document.createElement('div');
    e.style.display = 'none';
    e.id = 'FC_VAR_PASS';
    document.body.appendChild(e);
  }

  // Safely assign the payload as the innerText of the element
  if (e) e.innerText = payload;
})();
