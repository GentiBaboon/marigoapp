/**
 * Throwaway mailbox providers that may not register an account.
 *
 * **This file exists twice** — here and at
 * `functions/src/disposable-email-domains.ts` — and the two must be
 * byte-identical. The Next app cannot import from `functions/` and the
 * functions bundle cannot import from `src/`, so the list is copied, and
 * `src/__tests__/lib/email-policy.test.ts` fails if the copies drift. Edit
 * one, copy it over the other.
 *
 * Keep the file free of imports: it is loaded by the sign-up form (browser),
 * `/api/auth/send-otp` (Node) and the `beforeUserCreated` blocking function.
 *
 * The list is deliberately curated rather than exhaustive. A domain here must
 * be a service whose whole purpose is an inbox nobody keeps; a small mail host
 * that a real person could plausibly use does not belong, however unfamiliar.
 * Matching is on the registrable domain **and any subdomain of it**, because
 * most of these services hand out `anything.example.com` addresses too.
 */
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  '10minutemail.com', '10minutemail.net', '10minmail.com', '10minutemail.org',
  '20minutemail.com', '33mail.com', 'anonaddy.me', 'anonbox.net', 'atomicmail.io',
  'binkmail.com', 'bobmail.info', 'bugmenot.com', 'burnermail.io',
  'byom.de', 'chammy.info', 'crazymailing.com', 'cuvox.de',
  'dayrep.com', 'deadaddress.com', 'despam.it', 'discard.email',
  'discardmail.com', 'discardmail.de', 'dispostable.com', 'disposableinbox.com',
  'disposablemail.com', 'dodgeit.com', 'dodgit.com', 'dontreg.com',
  'dropmail.me', 'drdrb.net', 'dump-email.info', 'dumpmail.de',
  'e4ward.com', 'einrot.com', 'emailfake.com', 'emailondeck.com',
  'emailsensei.com', 'emailtemporario.com.br', 'emltmp.com', 'ephemail.net',
  'evopo.com', 'fakeinbox.com', 'fakemail.net', 'fakemailgenerator.com',
  'fakemailz.com', 'filzmail.com', 'fleckens.hu', 'get-mail.me',
  'getairmail.com', 'getnada.com', 'gishpuppy.com', 'grr.la',
  'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.info',
  'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'gustr.com',
  'harakirimail.com', 'haltospam.com', 'hidemail.de', 'hmamail.com',
  'imgof.com', 'incognitomail.com', 'incognitomail.org', 'inboxalias.com',
  'inboxbear.com', 'inboxkitten.com', 'instantemailaddress.com', 'jetable.org',
  'jourrapide.com', 'junkmail.com', 'kasmail.com', 'klzlk.com',
  'koszmail.pl', 'kurzepost.de', 'lackmail.net', 'letthemeatspam.com',
  'lroid.com', 'mail-temp.com', 'mail-temporaire.fr', 'mail.tm',
  'mail1a.de', 'mail7.io', 'mailcatch.com', 'maildrop.cc',
  'maildu.de', 'maileater.com', 'mailexpire.com', 'mailforspam.com',
  'mailguard.me', 'mailimate.com', 'mailin8r.com', 'mailinator.com',
  'mailinator.net', 'mailinator.org', 'mailinator2.com', 'mailme.lv',
  'mailmetrash.com', 'mailmoat.com', 'mailnator.com', 'mailnesia.com',
  'mailnull.com', 'mailsac.com', 'mailseal.de', 'mailshell.com',
  'mailsiphon.com', 'mailslite.com', 'mailtemp.info', 'mailtothis.com',
  'mailzilla.com', 'mailzilla.org', 'mbx.cc', 'mega.zik.dj',
  'meltmail.com', 'mierdamail.com', 'mintemail.com', 'mohmal.com',
  'moakt.com', 'moakt.ws', 'mt2009.com', 'mt2014.com',
  'mvrht.com', 'mytemp.email', 'mytrashmail.com', 'nada.email',
  'neomailbox.com', 'nepwk.com', 'nervmich.net', 'nervtmich.net',
  'no-spam.ws', 'nobulk.com', 'noclickemail.com', 'nomail.xl.cx',
  'nomail2me.com', 'nospam.ze.tc', 'nospam4.us', 'nospamfor.us',
  'nowmymail.com', 'objectmail.com', 'obobbo.com', 'odnorazovoe.ru',
  'oneoffemail.com', 'onewaymail.com', 'opayq.com', 'ordinaryamerican.net',
  'owlpic.com', 'pookmail.com', 'proxymail.eu', 'putthisinyourspamdatabase.com',
  'quickinbox.com', 'rcpt.at', 'reallymymail.com', 'recode.me',
  'rhyta.com', 'rmqkr.net', 'rtrtr.com', 's0ny.net',
  'safetymail.info', 'sendspamhere.com', 'sharklasers.com', 'shieldemail.com',
  'shitmail.me', 'shitmail.org', 'sofimail.com', 'sogetthis.com',
  'spam.la', 'spam4.me', 'spamavert.com', 'spambob.com',
  'spambog.com', 'spambog.de', 'spambog.ru', 'spambox.us',
  'spamcannon.com', 'spamcannon.net', 'spamcorptastic.com', 'spamcowboy.com',
  'spamday.com', 'spamex.com', 'spamfree24.org', 'spamgourmet.com',
  'spamherelots.com', 'spamhereplease.com', 'spamhole.com', 'spamify.com',
  'spaml.com', 'spammotel.com', 'spamobox.com', 'spamspot.com',
  'spamthis.co.uk', 'spamthisplease.com', 'spamtroll.net', 'speed.1s.fr',
  'superrito.com', 'suremail.info', 'tafmail.com', 'teleworm.us',
  'temp-mail.io', 'temp-mail.org', 'temp-mail.ru', 'tempail.com',
  'tempalias.com', 'tempe-mail.com', 'tempemail.co.za', 'tempemail.com',
  'tempemail.net', 'tempinbox.co.uk', 'tempinbox.com', 'tempmail.de',
  'tempmail.eu', 'tempmail.it', 'tempmail.net', 'tempmail.plus',
  'tempmailaddress.com', 'tempmailer.com', 'tempmailo.com', 'tempomail.fr',
  'temporarioemail.com.br', 'temporaryemail.net', 'temporaryemail.us', 'temporaryforwarding.com',
  'temporaryinbox.com', 'temporarymailaddress.com', 'tempr.email', 'tempsky.com',
  'tempthe.net', 'thankyou2010.com', 'thisisnotmyrealemail.com', 'throwam.com',
  'throwawayemailaddress.com', 'throwawaymail.com', 'tilien.com', 'tmail.ws',
  'tmailinator.com', 'tmpeml.info', 'tmpmail.net', 'tmpmail.org',
  'tradermail.info', 'trash-mail.at', 'trash-mail.com', 'trash-mail.de',
  'trash2009.com', 'trashdevil.com', 'trashemail.de', 'trashmail.at',
  'trashmail.com', 'trashmail.de', 'trashmail.me', 'trashmail.net',
  'trashmail.org', 'trashmail.ws', 'trashmailer.com', 'trashymail.com',
  'trbvm.com', 'trialmail.de', 'trillianpro.com', 'twinmail.de',
  'tyldd.com', 'uggsrock.com', 'upliftnow.com', 'uplipht.com',
  'venompen.com', 'veryrealemail.com', 'viditag.com', 'viewcastmedia.com',
  'vomoto.com', 'vubby.com', 'wegwerfadresse.de', 'wegwerfemail.de',
  'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org', 'wh4f.org',
  'whyspam.me', 'willselfdestruct.com', 'winemaven.info', 'wronghead.com',
  'wuzup.net', 'wuzupmail.net', 'xagloo.com', 'xemaps.com',
  'xents.com', 'xmaily.com', 'xoxy.net', 'yapped.net',
  'yep.it', 'yogamaven.com', 'yopmail.com', 'yopmail.fr',
  'yopmail.net', 'yourdomain.com', 'ypmail.webarnak.fr.eu.org', 'yuurok.com',
  'zehnminutenmail.de', 'zippymail.info', 'zoemail.net', 'zoemail.org',
];

const DOMAIN_SET: ReadonlySet<string> = new Set(DISPOSABLE_EMAIL_DOMAINS);

/** The part after the last `@`, lower-cased and trimmed; `''` when absent. */
export function emailDomain(email: string): string {
  const at = (email ?? '').trim().toLowerCase().lastIndexOf('@');
  return at < 0 ? '' : (email ?? '').trim().toLowerCase().slice(at + 1);
}

/**
 * Is this domain, or any parent of it, a listed throwaway provider?
 *
 * `foo.mailinator.com` is checked as itself, then `mailinator.com`, then
 * `com`. The walk stops one label short of the TLD so `com` alone can never
 * match anything.
 */
export function isDisposableEmailDomain(domain: string): boolean {
  const labels = (domain ?? '').trim().toLowerCase().split('.').filter(Boolean);
  for (let i = 0; i < labels.length - 1; i++) {
    if (DOMAIN_SET.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}
