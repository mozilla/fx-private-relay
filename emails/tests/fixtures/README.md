# Email test fixtures

These fixtures are used in `emails/tests/views_tests.py`

## Incoming Emails

Incoming Email fixtures come in two varieties. The original fixtures capture the [SNS][]
Delivery [notification JSON][] representing an incoming email. The newer fixtures are
the raw incoming emails.

[notification JSON]: https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
[SNS]: https://aws.amazon.com/sns/

### Incoming Emails with SNS Notification JSON

These fixtures capture the [SNS][] Delivery [notification JSON][] representing an
incoming email. Their names all end in `_email_sns_body.json`.

- `dmarc_failed_email_sns_body.json` - Email that failed the [DMARC][] check,
  and the relevant domain's policy is to reject the email.
- `domain_recipient_email_sns_body.json` - Email to a premium domain email mask.
- `replies_email_sns_body.json` - Email from a Relay user, in reply to a previous
  message forwarded to the user.
- `s3_stored_email_sns_body.json` - Email content is stored in S3, not embedded in the
  notification.
- `s3_stored_replies_email_sns_body.json` - Email content for a reply to a forwarded
  email is stored in S3.
- `single_recipient_email_sns_body.json` - Email to a Relay mask
- `single_recipient_list_email_sns_body.json` - Email to a Relay mask from a mailing
  list, would be blocked by "block promotions" setting.
- `spamVerdict_FAIL_email_sns_body.json` - Email that AWS identified as spam

[DMARC]: https://en.wikipedia.org/wiki/DMARC

### Incoming Emails as raw emails

These fixtures were created outside of an SNS notification, such as exporting from a
mail client. They are stored in the [Internet Message Format][] (IMF).

- `emperor_norton_incoming.email` - The From: address contains an unquoted display name
  with a comma. AWS parses it as one email, Python as two emails, the first invalid.
- `inline_image_incoming.email` - Contains an inline image, referenced in the HTML by
  content ID
- `plain_text_incoming.email` - A simple email with only plain text content
- `russian_spam_incoming.email` - Contains UTF-8 encoded headers, Base64-encoded content
  - _TODO:_ Replace this with a legitimate email with UTF-8 encoded headers and
    content, to avoid unintentional overlap with
    `spamVerdict_FAIL_email_sns_body.json`.

[Internet Message Format]: https://datatracker.ietf.org/doc/html/rfc5322

## Expected Outgoing Emails

These fixtures represent the expected output email. They are stored in the
[Internet Message Format][]. These fixtures often start with the name of the related
fixture, and end in `_expected.email`.

The output fixtures for incoming emails with SNS Notification JSON:

- `domain_recipient_expected.email`
- `reply_requires_premium_first_expected.email` - Tells user the first reply is sent
- `reply_requires_premium_second_expected.email` - Tells user the next reply is not sent
- `s3_stored_replies_expected.email` - With text content `this is a text reply`
- `s3_stored_replies_with_emoji_expected.email` - With text content `👍 Thanks I got it!`
- `single_recipient_expected.email` - To a Relay user preferring English
- `single_recipient_fr_expected.email` - To a Relay user preferring French
- `single_recipient_list_expected.email`

The output fixtures for raw incoming emails:

- `emperor_norton_expected.email` - The email address was extracted
- `inline_image_expected.email` - The inline image is forwarded
- `plain_text_expected.email` - Demonstrates that an HTML section was added, including
  the Relay header and footer.
- `russian_spam_expected.email` - The UTF-8-encoded subject is forwarded

When the expected mail does not match the actual output mail, the test creates a file
with the actual output. These files end in `_actual.email` instead of `_expected.email`.
These can be used in a different tool, such as XCode's [Opendiff][], to view the
differences.

They can also be used when changing the email content. For example, if we change the
format of the HTML wrapper, then the email content will change. Once the developer is
happy with the new content, they can replace `_expected.email` with the contents of
`_actual.email`. These files are ignored by git, via the `.gitignore` file in this
directory.

[Opendiff]: https://keith.github.io/xcode-man-pages/opendiff.1.html

## Bounce notifications

Some fixtures represent SNS Bounce notifications:

- `hard_bounce_sns_body.json` - A hard bounce. Re-trying will not fix the issue.
- `soft_bounce_sns_body.json` - A soft bounce. Re-trying may fix the issue.
- `spam_bounce_sns_body.json` - A soft bounce. Sending with different content may work.

## Other notifications

This SNS notification is not handled by our system. It is included to test how our
system handles unknown notifications.

- `subscription_confirmation_invalid_sns_body.json`
