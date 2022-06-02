from typing import Final, Iterator
from unittest.mock import patch, Mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError

from model_bakery import baker
import pytest

from emails.models import RelayAddress
from emails.ses import SendRawEmailResponse, SimulatorScenario
from emails.tests.ses_tests import _ok_response_from_send_raw_email


COMMAND_NAME: Final = "send_simulator_email"
MOCK_BASE: Final = f"emails.management.commands.{COMMAND_NAME}"


@pytest.fixture()
def mock_send_simulator_email() -> Iterator[Mock]:
    """Mock the SES client to successfully call send_raw_email()"""
    response = SendRawEmailResponse.from_dict(_ok_response_from_send_raw_email())
    with patch(f"{MOCK_BASE}.send_simulator_email", return_value=response) as mock_send:
        yield mock_send


@pytest.mark.django_db
def test_send_success(mock_send_simulator_email, caplog) -> None:
    user = baker.make(User)
    relay_address = baker.make(RelayAddress, user=user, address="abcd1234", domain=2)
    from_email = relay_address.full_address

    call_command(COMMAND_NAME, from_email, "success")
    assert len(caplog.records) == 1
    assert caplog.records[0].msg == "Sending a success email"

    mock_send_simulator_email.assert_called_once_with(
        SimulatorScenario.SUCCESS, from_email, None
    )


@pytest.mark.django_db
def test_send_bounce_verbosity_0(mock_send_simulator_email, caplog) -> None:
    user = baker.make(User)
    relay_address = baker.make(RelayAddress, user=user, address="abcd1234", domain=2)
    from_email = relay_address.full_address

    call_command(COMMAND_NAME, from_email, "bounce", "--verbosity=0")
    assert len(caplog.records) == 0

    mock_send_simulator_email.assert_called_once_with(
        SimulatorScenario.BOUNCE, from_email, None
    )


@pytest.mark.django_db
def test_send_bounce_verbosity_2_with_label(mock_send_simulator_email, caplog) -> None:
    user = baker.make(User)
    relay_address = baker.make(RelayAddress, user=user, address="abcd1234", domain=2)
    from_email = relay_address.full_address

    call_command(COMMAND_NAME, from_email, "bounce", "--verbosity=2", "--label=a-label")
    assert len(caplog.records) == 2
    assert caplog.records[0].msg == "Sending a bounce email"
    assert caplog.records[1].msg == "SES send_raw_email responded"

    mock_send_simulator_email.assert_called_once_with(
        SimulatorScenario.BOUNCE, from_email, "a-label"
    )


def test_send_unknown_email_errors(mock_send_simulator_email) -> None:
    from_email = "abcd1234@relay.example.com"
    with pytest.raises(CommandError) as err:
        call_command(COMMAND_NAME, from_email, "success")
    assert str(err.value) == "No matching Relay address for abcd1234@relay.example.com"
    mock_send_simulator_email.assert_not_called()
