# Developer mode: Collect more data and test the untestable

Developer mode helps Relay staff in two situations. It allows staff to opt-in
to extended data collection for their own account. It allows staff to test
scenarios that are hard to setup or would damage the service.

## Enabling developer mode

To enable developer mode for an existing Relay account, you can run this
Django management command in a shell:

```sh
./manage.py waffle_flag developer_mode --append --user "<your_real_email@example.com>"
```

This should only be applied to Relay staff with prior consent. This flag can
log additional data, retained for 90 days, that is not allowed under the
[Relay Privacy Policy][]. On [relay.firefox.com][], shell access is limited
to Service Reliability Engineers (SREs) and can not be done by Relay
developers. A Jira ticket should be used to track the request and the work to
enable the flag.

[Relay Privacy Policy]: https://www.mozilla.org/en-US/privacy/subscription-services/
[relay.firefox.com]: https://relay.firefox.com

## Developer mode features

To see where the code uses developer mode, search the codebase for the keyword
`developer_mode`.

### <a name="h-log-notification"></a>Extended logging of AWS SES Notifications

When the Amazon Web Service (AWS) Simple Email Service (SES) receives an email
to or from a Relay mask, it places a [Received Notification][] in the Relay
incoming mail queue. In production, this includes the email headers and other
metadata. In deprecated Relay configurations, this can include the email
content. Relay processes this notification to forward email.

When a user has developer mode active for their Relay account, and the email
mask description contains the text `DEV:`, then this received notification is
logged. The log will have the message `_handle_received: developer_mode`, and
these items:

- `mask_id`: The identifier for the email mask. For example, `R123` is the
  random mask with ID 123, and `D567` is the domain mask with the ID 567.
- `dev_action`: `log`
- `notification_gza85`: The received notification, which may be split over
  several log messages. See [Encoded Data][] for working with this format.
- `part`: The segment number of this log, starting at 0
- `parts`: The total number of logs needed to split the data into 1024-byte
  segments.

Extended logging is also enabled for Complaint Notifications, with the
log message `_handle_complaint: developer_mode`. See
[Simulate a Complaint][] below.

[Encoded Data]: #h-encoded-data
[Received Notification]: https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
[Simulate a Complaint]: #h-simulate-complaint

### <a name="h-simulate-complaint"></a>Simulate a Complaint

AWS SES subscribes to the [feedback loop][] for some email providers. When a
user marks a message as spam, the email provider notifies AWS via the feedback
loop. AWS SES marks this against Relay's sender reputation, and places a
[Complaint Notification][] in the Relay incoming mail queue.

When a user has developer mode active for their Relay account, and the email
mask description contains the text `DEV:simulate_complaint` (no spaces), then
emails to the mask are no longer forwarded to the user's real email, but
instead to the [mailbox simulator][] complaint email address. The address has
the format `complaint+R123@@simulator.amazonses.com`. The embedded mask
identifier (`R123` in this example) allows linking the simulated complant
back to the developer.

When handling the complaint notification, Relay performs the standard complaint
handling. It sets `auto_block_spam` on the first complaint, to block incoming
emails that AWS SES identifies as spam. If the flag `disable_mask_on_complaint`
is enabled, the mask is set to "Blocking all email" on the second complaint.
The email notifying that the mask was set to "Block all emails" is sent to the
user's real email address, not the SES complaint simulator email address.

Since `DEV:simulate_complaint` also includes `DEV:`, the incoming email
notification is also logged; see [Extended logging of AWS SES Notifications][].
In this case, the log message is `_handle_received: developer_mode` with
`"dev_action": "simulate_complaint"` instead of `"log"`.

Additionally, _any_ complaint notification is logged, not just ones to the mask
labeled `DEV:simulate_complaint`.

[Complaint Notification]: https://docs.aws.amazon.com/ses/latest/dg/notification-contents.html#complaint-object
[Extended logging of AWS SES Notifications]: #h-log-notification
[feedback loop]: https://docs.aws.amazon.com/ses/latest/dg/success-metrics.html#metrics-complaints
[mailbox simulator]: https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html#send-email-simulator

### <a name="h-encoded-data"></a>Encoded Data

When logging a notification (see [Extended logging of AWS SES Notifications]),
the notification is JSON-encoded, then compressed with [zlib][], then encoded
with [Ascii85]. This is implemented by `emails.utils.encode_dict_gza85`.

For example, this Python dict:

```python
{'notificationType': 'Received'}
```

is JSON-encoded to the very similar:

```json
{ "notificationType": "Received" }
```

and then compressed with [zlib.compress][] (hexadecimal format):

```text
789cab56cacb2fc94ccb4c4e2cc9cccf0ba92c4855b252500a4a4d4ecd2c4b4d51aa0500c6600bab
```

and finally encoded with [base64.a85encode][]:

```text
Gatg8b0)H[9Zp+)/BQ,^$`P[J<O,M!$;+#fbq)L^;5sd"`aB1T
```

This would then be logged in the [MozLog format][] like:

```json
{
  "Timestamp": 1729121615657684992,
  "Type": "eventsinfo",
  "Logger": "fx-private-relay",
  "Hostname": "dd52c3c5-0674-4d33-85db-2737887750e4",
  "EnvVersion": "2.0",
  "Severity": 6,
  "Pid": 102,
  "Fields": {
    "msg": "_handle_received: developer_mode",
    "mask_id": "R101",
    "dev_action": "log",
    "part": 0,
    "parts": 1,
    "notification_gza85": "Gatg8b0)H[9Zp+)/BQ,^$`P[J<O,M!$;+#fbq)L^;5sd\"`aB1T"
  }
}
```

In this example, the zlib-compressed version is longer than the JSON-encoded
version (40 versus 32 bytes). In general, notification JSON can be compressed
to a smaller size.

An Ascii85-encoded string is longer than the binary string by a 5:4 ratio. For
example a 120-byte binary string is encoded as 150 bytes in Ascii85. This is
more efficient than Base64, which has a 4:3 encoding ration. A 120-byte binary
string is encoded as 160 bytes in base64. A downside is that Ascii85 uses quote
characters like `"` and `'`, requiring escaping in JSON and in Python strings.

The function `emails.utils.decode_dict_gza85` can be used to decode an encoded
string back to a Python dictionary.

If the encoded string is more than 1024 bytes, it is split into 1024-byte segments
and emitted over several log messages. This ensures it does not exceed any log
backend limits. The log field `"part"` can be used to order the log messages,
and `"parts"` to collect all the segments. The segments can be concatenated or
joined by whitespace, such as newlines, before sending it to
`decode_dict_gza85`.

[Ascii85]: https://en.wikipedia.org/wiki/Ascii85
[MozLog format]: https://wiki.mozilla.org/Firefox/Services/Logging#MozLog_application_logging_standard
[base64.a85encode]: https://docs.python.org/3.11/library/base64.html#base64.a85encode
[zlib.compress]: https://docs.python.org/3/library/zlib.html
[zlib]: https://docs.python.org/3/library/zlib.html
