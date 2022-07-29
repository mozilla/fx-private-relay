# SNS and SES JSON test fixtures

These JSON files are used for testing email processing.

## SNS Fixtures

These were captured in the local development environment, and in some cases modified to work as test fixtures:

* `dmarc_failed_email_sns_body.json`
* `domain_recipient_email_sns_body.json`
* `hard_bounce_sns_body.json`
* `replies_email_sns_body.json`
* `s3_stored_email_sns_body.json`
* `s3_stored_replies_email_sns_body.json`
* `single_recipient_email_sns_body.json`
* `single_recipient_list_email_sns_body.json`
* `soft_bounce_sns_body.json`
* `spam_bounce_sns_body.json`
* `spamVerdict_FAIL_email_sns_body.json`
* `subscription_confirmation_invalid_sns_body.json`

## SES "Generic" Notification Examples

These are examples from [Amazon SNS notification examples for Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/notification-examples.html):

* `bounce_notification_with_dsn_example_ses_body.json`
* `bounce_notification_without_dsn_example_ses_body.json`
* `delivery_notification_example_ses_body.json`

These are derived from examples:

* `complaint_notification_with_feedback_example_ses_body.json`  - Added `"complaintSubType": null` to match captured complaints
* `complaint_notification_without_feedback_example_ses_body.json`  - Added `"complaintSubType": null` to match captured complaints

## SES Received Notification Examples

These are examples from [Examples of notifications for Amazon SES email receiving](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-examples.html):

* `received_notification_action_example_ses_body.json`
* `received_notification_alert_example_ses_body.json`

These are derived from the examples:

* `received_notification_action_no_headers_ses_body.json` - Removed headers to simulate when including headers is not configured

## SES Event Examples

These are examples from [Examples of event data that Amazon SES publishes to Amazon SNS](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-examples.html):

* `bounce_event_example_ses_body.json`
* `click_event_example_ses_body.json`
* `delivery_delay_event_example_ses_body.json`
* `delivery_event_example_ses_body.json`
* `open_event_example_ses_body.json`
* `reject_event_example_ses_body.json`
* `rendering_failure_example_ses_body.json`
* `send_event_example_ses_body.json`
* `subscription_event_example_ses_body.json`

These are derived from the examples:

* `complaint_event_example_ses_body.json` - Added `"complaintSubType": null` to match captured complaints

## SES Simulator Examples

These were captured as data from using the [SES Simulator mailboxes](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html), with the source anonymized as `test@relay.example.com`.

* `bounce_notification_from_simulator_ses_body.json`
* `complaint_notification_from_simulator_ses_body.json`
* `delivery_notification_complaint_from_simulator_ses_body.json`
* `delivery_notification_ooto_from_simulator_ses_body.json`
* `delivery_notification_success_from_simulator_ses_body.json`
* `ooto_bounce_notification_from_simulator_ses_body.json`
* `suppressionlist_bounce_notification_from_simulator_ses_body.json`
