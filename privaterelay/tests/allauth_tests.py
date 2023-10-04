import pytest

from ..allauth import AccountAdapter


def test_account_adapter_is_safe_url_noreversematch_logs_error(
    caplog: pytest.LogCaptureFixture,
):
    adapter = AccountAdapter()
    return_value = adapter.is_safe_url("fuzzymcfuzzface")
    assert return_value is None
    (rec1,) = caplog.records
    assert rec1.levelname == "ERROR"
    assert rec1.getMessage() == "NoReverseMatch for fuzzymcfuzzface"


def test_account_adapter_is_safe_url_redirects():
    adapter = AccountAdapter()
    return_value = adapter.is_safe_url("account_logout")
    assert return_value is True
