# Preserve Original Email Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve safe unique inbound headers and the full `Received` chain in forwarded email while Relay-managed headers remain authoritative.

**Architecture:** Update `emails.views._replace_headers` to retain safe unique non-managed headers, explicitly discard `Bcc`, and keep repeated `Received` fields. Preserve existing validation, issue reporting, and duplicate collapsing for MIME and `Content-*` headers.

**Tech Stack:** Python 3.12, stdlib `email.message.EmailMessage`, pytest.

## Global Constraints

- Preserve Relay's outgoing values for `From`, `To`, `Subject`, `Reply-To`, and `Resent-From`.
- Never forward `Bcc`.
- Continue dropping headers with unsafe line-break characters and record the existing issue shape.
- Keep existing duplicate handling for every header except repeatable `Received` fields.
- Do not change email body rewriting or forwarding behavior.

---

### Task 1: Preserve safe inbound headers during conversion

**Files:**
- Modify: `emails/views.py` (`_replace_headers`)
- Test: `emails/tests/views_tests.py`

**Interfaces:**
- Consumes: `_replace_headers(email: EmailMessage, headers: OutgoingHeaders) -> EmailHeaderIssues`
- Produces: the same in-place email mutation and return type, with non-managed safe unique headers and repeated `Received` headers retained.

- [ ] **Step 1: Add a failing regression test**

Add this test next to the existing `_replace_headers` tests in `emails/tests/views_tests.py`:

```python
def test_replace_headers_preserves_safe_original_headers() -> None:
    email = EmailMessage(policy=relay_policy)
    email["From"] = "original@example.com"
    email["To"] = "mask@relay.example"
    email["Subject"] = "Original subject"
    email["X-Original-Trace"] = "trace-id-123"
    email["Received"] = (
        "from mx1.example by mx2.example; Tue, 01 Jan 2025 00:00:00 +0000"
    )
    email["Received"] = (
        "from mx0.example by mx1.example; Tue, 01 Jan 2025 00:00:00 +0000"
    )
    email["Bcc"] = "hidden@example.com"
    email.set_content("Forwarded body")

    outgoing_headers: OutgoingHeaders = {
        "From": "Relay <mask@relay.example>",
        "To": "user@example.com",
        "Subject": "Forwarded subject",
        "Reply-To": "replies@relay.example",
        "Resent-From": "sender@example.com",
    }

    issues = _replace_headers(email, outgoing_headers)

    assert issues == []
    assert email["X-Original-Trace"] == "trace-id-123"
    assert email.get_all("Received") == [
        "from mx1.example by mx2.example; Tue, 01 Jan 2025 00:00:00 +0000",
        "from mx0.example by mx1.example; Tue, 01 Jan 2025 00:00:00 +0000",
    ]
    assert email.get_all("Bcc") is None
    for name, value in outgoing_headers.items():
        assert email[name] == value
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `pytest emails/tests/views_tests.py::test_replace_headers_preserves_safe_original_headers -q`

Expected: FAIL because `X-Original-Trace` and `Received` are dropped by the current filter.

- [ ] **Step 3: Change the header retention loop**

In `emails/views.py`, replace the current header-collection loop with:

```python
    first_kept: dict[str, str] = {}
    duplicate_counts: dict[str, int] = {}
    for header in email.keys():
        header_lower = header.lower()
        if header_lower in replacements:
            # The replacement loop below deletes every copy and writes one new value
            continue
        if header_lower in to_drop:
            continue
        if header_lower == "bcc":
            to_drop.add(header_lower)
            continue

        line_break_issue = _header_line_break_issue(email, header)
        if line_break_issue is not None:
            issues.append(line_break_issue)
            to_drop.add(header_lower)
            continue

        if header_lower in first_kept:
            if header_lower == "received":
                continue
            if header_lower == "mime-version" or header_lower.startswith("content-"):
                duplicate_counts[header_lower] = (
                    duplicate_counts.get(header_lower, 0) + 1
                )
            else:
                to_drop.add(header_lower)
        else:
            first_kept[header_lower] = header
```

Keep the existing deletion, duplicate-collapse, and replacement loops after this block. Update the comment above the loop to explain that MIME and `Content-*` duplicates are collapsed for SES, other duplicate names are dropped, and repeated `Received` headers are retained as routing history.

- [ ] **Step 4: Run the focused test and relevant header tests**

Run: `pytest emails/tests/views_tests.py::test_replace_headers_preserves_safe_original_headers emails/tests/views_tests.py -k 'replace_headers or line_break_char_in_header' -q`

Expected: PASS, including the existing malformed-header and MIME duplicate cases.

- [ ] **Step 5: Check formatting and review the diff**

Run: `ruff check emails/views.py emails/tests/views_tests.py` and `git diff --check`.

Expected: both commands exit successfully, and the diff contains only the planned helper, regression test, and documentation changes.
