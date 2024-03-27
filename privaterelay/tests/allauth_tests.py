from collections.abc import Iterator
from unittest.mock import patch, Mock
import pytest

from allauth.core.context import request_context

from ..allauth import AccountAdapter


@pytest.fixture
def adapter(rf) -> Iterator[AccountAdapter]:
    request = rf.get("/accounts/fxa/login/callback/?code=oauth_code")
    with request_context(request):
        yield AccountAdapter()


def test_account_adapter_is_safe_url_invalid_path_logs_error(
    caplog: pytest.LogCaptureFixture, adapter: AccountAdapter
) -> None:
    assert not adapter.is_safe_url("/fuzzymcfuzzface")
    (rec1,) = caplog.records
    assert rec1.levelname == "ERROR"
    assert rec1.getMessage() == "No matching URL for '/fuzzymcfuzzface'"


def test_account_adapter_is_safe_url_valid_path(adapter: AccountAdapter) -> None:
    assert adapter.is_safe_url("/accounts/logout/")


@pytest.mark.parametrize("path", ("", None))
def test_account_adapter_is_safe_url_empty_does_not_log(
    caplog: pytest.LogCaptureFixture,
    adapter: AccountAdapter,
    path: str | None,
) -> None:
    assert not adapter.is_safe_url(path)
    assert len(caplog.records) == 0


@pytest.mark.parametrize("found", (True, False))
def test_account_adapter_is_safe_url_try_frontend_path(
    adapter: AccountAdapter, caplog: pytest.LogCaptureFixture, found
):
    mock_instance = Mock()
    mock_instance.find_file = Mock(return_value=found)
    path = "/frontend/path/"
    with patch(
        "privaterelay.allauth.RelayStaticFilesMiddleware", return_value=mock_instance
    ):
        assert adapter.is_safe_url(path) == found
    mock_instance.find_file.assert_called_once_with(path)
    if found:
        assert len(caplog.records) == 0
    else:
        (rec1,) = caplog.records
        assert rec1.levelname == "ERROR"
        assert rec1.getMessage() == f"No matching URL for '{path}'"


def test_account_adapter_is_safe_url_frontend_not_built(
    adapter: AccountAdapter, caplog: pytest.LogCaptureFixture
):
    with patch(
        "privaterelay.allauth.RelayStaticFilesMiddleware",
        side_effect=NotADirectoryError(),
    ):
        assert not adapter.is_safe_url("/faq/")
    (rec1,) = caplog.records
    assert rec1.levelname == "ERROR"
    assert rec1.getMessage() == "No matching URL for '/faq/'"
