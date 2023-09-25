## Email test fixtures

These fixtures are used in `emails/tests/views_tests.py`

### Incoming Emails

Some fixtures capture the [SNS][] Delivery [notification JSON][] representing an
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

[notification JSON]: https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html
[DMARC]: https://en.wikipedia.org/wiki/DMARC
[SNS]: https://aws.amazon.com/sns/

There are related fixtures for the expected forwarded email. Some content, such as MIME
boundary strings, are standardized to remove variation from test to test. These
fixtures start with the name of the related SNS JSON fixture, and end in
`_expected.email`.

- `domain_recipient_expected.email`
- `s3_stored_replies_expected.email` - With text content `this is a text reply`
- `single_recipient_expected.email`
- `single_recipient_list_expected.email`

When the expected mail does not match the actual forwarded mail, the test creates a file
with the actual output (after standardization). These files end in `_actual.email`
instead of `_expected.email`. These can be used in a different tool, such as XCode's
[Opendiff][], to view the differences.

They can also be used when changing the email content. For example, if we change the
format of the HTML wrapper, then the email content will change. Once the developer is
happy with the new content, they can replace `_expected.email` with the contents of
`_actual.email`. These files are ignored by git, via the `.gitignore` file in this
directory.

[Opendiff]: https://keith.github.io/xcode-man-pages/opendiff.1.html

### Bounce notifications

Some fixtures represent SNS Bounce notifications:

- `hard_bounce_sns_body.json` - A hard bounce. Re-trying will not fix the issue.
- `soft_bounce_sns_body.json` - A soft bounce. Re-trying may fix the issue.
- `spam_bounce_sns_body.json` - A soft bounce. Sending with different content may work.

### Other notifications

This SNS notification is not handled by our system.

- `subscription_confirmation_invalid_sns_body.json`
