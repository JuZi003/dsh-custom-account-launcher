/**
 * Host half — intentionally empty.
 *
 * The repaint lives in the browser half (`./client`), which inserts a
 * stylesheet into the running page. It deliberately does **not** use
 * `webServer.tapIndex`: the desktop shell serves its document from
 * `dsh-app://app/`, so a host-side index tap never reaches the page the user
 * actually sees. Injecting from the page covers both surfaces.
 *
 * Nothing here reads, writes, or unbinds the account: the bound identity is
 * left exactly as it was for sign-in and for Settings → Account.
 *
 * @module dsh-custom-account-launcher
 */

/** Cordis plugin name. */
const name = 'custom-account-launcher';

/**
 * Apply the host half (no-op).
 *
 * @param {import('@deepseek-ai/cordis').Context} _ctx - The plugin context.
 */
function apply(_ctx) {}

export { apply, name };
