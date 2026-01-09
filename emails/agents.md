# Emails App Development Guide

Guidance for working with the Relay email masking Django app.

See [../.agents/agents.backend.md](../.agents/agents.backend.md) for general backend guidance.

## Emails App Overview

The `emails/` app handles email logic, AWS SES/SNS/SQS integration, and email forwarding.

**Tech:** AWS SES/SNS/SQS via boto3, S3 for email storage, SQS for queueing

## Key Models

### RelayAddress

Random email masks (e.g., `abc123@relay.firefox.com`).

- Auto-generated random addresses
- Can be enabled/disabled

### DomainAddress

Custom subdomain masks (e.g., `shopping@johndoe.relay.firefox.com`).

- Premium feature
- User-controlled labels

### Reply

Tracks reply-to relationships for email replies.

- Maps masked sender addresses to original recipients
- Expires after configured time period
- Allows users to reply to forwarded emails

## Email Flow Architecture

Email forwarding happens **outside the web request cycle** via background processing:

### Inbound Email Flow

1. External email → AWS SES (receives email)
2. SES → S3 (stores email)
3. SES → SNS (publishes notification)
4. SNS → SQS queue
5. Background process polls SQS (`process_emails_from_sqs` management command)
6. Process retrieves email from S3
7. Process forwards via AWS SES to user's real email

## Management Commands

Background processes and utilities in `emails/management/commands/`:

### Long-Running Processes

- `process_emails_from_sqs.py` - Polls SQS queue and forwards emails (main email processor)

### Scheduled Utilities

- `delete_old_reply_records.py` - Deletes Reply records older than specified days
- `send_welcome_emails.py` - Sends welcome emails to users who haven't received one

## AWS Integration

### SES (Simple Email Service)

Used for:

- Receiving inbound emails to masked addresses via S3
- Forwarding emails to users' real addresses
- Sending reply emails from masked addresses

### SNS (Simple Notification Service)

Receives notifications from SES for:

- Email bounces
- Spam complaints
- Delivery status

### S3

Stores inbound email content temporarily.

- Email body retrieved by background processor
- Cleaned and forwarded to user

### SQS

Queue for email processing.

- SNS publishes to SQS
- Background process polls queue
- Ensures reliable processing

## Further Reading

- [../.agents/agents.backend.md](../.agents/agents.backend.md) - General backend guidance
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SNS Documentation](https://docs.aws.amazon.com/sns/)
