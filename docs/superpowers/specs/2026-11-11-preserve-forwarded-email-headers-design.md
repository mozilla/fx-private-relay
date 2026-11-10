# Preserve Original Email Headers During Forwarding

## Problem

Firefox Relay parses an inbound message and rewrites selected fields for the forwarded message. The current header cleanup keeps MIME and `Content-*` headers, drops other original headers, then applies Relay's outgoing headers. This discards useful routing history such as the original `Received` chain, so recipients cannot inspect the same server path information they could see in the source email.

## Design

Keep unique original headers that pass the existing header validation, except `Bcc`, which can expose hidden recipients. Continue replacing Relay-managed headers (`From`, `To`, `Subject`, `Reply-To`, and `Resent-From`) with the values Relay generates. Preserve all repeated `Received` headers because their ordered chain is the routing history users need. Keep the existing duplicate handling for other headers, including MIME and `Content-*`, and continue dropping malformed headers and reporting the same issues. This preserves useful original metadata without exposing hidden recipients or allowing original delivery fields to override Relay's privacy behavior.

The change belongs in `emails/views.py`'s `_replace_headers`, which already mutates the parsed email in place. Focused regression tests in `emails/tests/views_tests.py` will verify that a unique custom header and repeated `Received` headers survive, `Bcc` is removed, and Relay-owned headers are replaced.

## Alternatives considered

1. Preserve only selected trace/authentication headers. This needs a maintained allowlist and could omit useful metadata.
2. Preserve every header literally, including Relay-managed fields and `Bcc`. This could leak recipients or break Relay's address masking and forwarding behavior.

The selected design changes the generic header retention rule while preserving the existing safety checks and Relay rewrites.

## Acceptance criteria

- Unique non-Relay-managed headers that pass current validation remain in the forwarded message; all `Received` headers remain, including repeated instances; `Bcc` is removed.
- Relay-managed output headers replace their original values.
- Unsafe headers continue to be removed and reported by the current validation logic.
- Existing duplicate handling for headers other than `Received` remains unchanged, including MIME and `Content-*` headers.
- Regression tests cover unique and repeated trace-header preservation, `Bcc` removal, and Relay header replacement.
