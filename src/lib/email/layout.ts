/**
 * Shared shell for every transactional email.
 *
 * Email clients are not browsers: Outlook renders with Word, Gmail strips
 * <style> blocks in some contexts, and flexbox/grid are unreliable. So this is
 * deliberately old-fashioned — nested tables, inline styles, no external CSS
 * and no web fonts. It looks dated as source and renders everywhere.
 */
import { SITE_NAME, absoluteUrl } from '@/lib/site';

/** Brand purple, matching --primary in globals.css. */
const PRIMARY = '#B884F5';
const INK = '#1a1a1a';
const MUTED = '#6b7280';
const BORDER = '#ececec';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Primary call-to-action. A table, not an <a> with padding — Outlook ignores
 *  padding on inline elements and the button collapses to a bare link. */
export function button(label: string, href: string): string {
  return `
  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
    <tr>
      <td align="center" bgcolor="${PRIMARY}" style="border-radius:8px;">
        <a href="${escapeHtml(href)}"
           style="display:inline-block;padding:14px 30px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:bold;color:${INK};text-decoration:none;border-radius:8px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

/** Label/value rows for order summaries and the like. */
export function detailRows(rows: Array<[string, string]>): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 4px;">
    ${rows
      .map(
        ([label, value]) => `
    <tr>
      <td style="padding:7px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:${MUTED};">${escapeHtml(label)}</td>
      <td align="right" style="padding:7px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:${INK};font-weight:600;">${escapeHtml(value)}</td>
    </tr>`,
      )
      .join('')}
  </table>`;
}

/** A bordered callout for the one fact the reader must not miss. */
export function highlight(inner: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;background:#faf7ff;border:1px solid ${PRIMARY};border-radius:10px;">
    <tr><td style="padding:16px 18px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:${INK};line-height:1.55;">${inner}</td></tr>
  </table>`;
}

export interface LayoutArgs {
  /** Shown large at the top of the card. */
  heading: string;
  /** Body HTML — use the helpers above rather than raw markup. */
  body: string;
  /** Optional line under the heading. */
  preheader?: string;
}

export function renderEmail({ heading, body, preheader }: LayoutArgs): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f8;">
  <!-- Preheader: the grey text a client shows beside the subject. Hidden in
       the body itself, or it appears twice. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader ?? heading)}</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f6f6f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER};">

          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <a href="${absoluteUrl('/')}" style="text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:bold;letter-spacing:-0.5px;color:${PRIMARY};">
                ${escapeHtml(SITE_NAME.replace('App', ''))}<span style="color:${INK};">.</span>
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 0;">
              <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.3;color:${INK};font-weight:normal;">
                ${escapeHtml(heading)}
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:6px 32px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#3f3f46;">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 26px;border-top:1px solid ${BORDER};font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
              <p style="margin:0 0 6px;">
                <a href="${absoluteUrl('/help')}" style="color:${MUTED};">Help</a> &nbsp;·&nbsp;
                <a href="${absoluteUrl('/terms')}" style="color:${MUTED};">Terms</a> &nbsp;·&nbsp;
                <a href="${absoluteUrl('/privacy')}" style="color:${MUTED};">Privacy</a>
              </p>
              <p style="margin:0;">© ${year} ${escapeHtml(SITE_NAME)} · Tirana, Albania</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
