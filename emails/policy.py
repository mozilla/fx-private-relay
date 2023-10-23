"""
Implement Python's email.policy.Policy for Relay

The library provides email.policy.default, which parses and generates RFC-compliant
email headers. However, Relay needs to be able to handle emails with non-compliant
headers as well.

See:
https://docs.python.org/3/library/email.policy.html
https://github.com/python/cpython/blob/main/Lib/email/_policybase.py
https://github.com/python/cpython/blob/main/Lib/email/policy.py
"""

from email.policy import EmailPolicy

from .headerregistry import relay_header_factory


relay_policy = EmailPolicy(header_factory=relay_header_factory)
