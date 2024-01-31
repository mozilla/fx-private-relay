from datetime import datetime
from logging import getLogger
from typing import Any

from django.conf import settings

from .glean.server_events import EventsServerEventLogger, GLEAN_EVENT_MOZLOG_TYPE
from .types import RELAY_CHANNEL_NAME


class RelayGleanLogger(EventsServerEventLogger):
    def __init__(
        self,
        *,
        application_id: str = "relay-backend",
        app_display_version: str | None = None,
        channel: RELAY_CHANNEL_NAME | None = None,
    ):
        assert settings.GLEAN_EVENT_MOZLOG_TYPE == GLEAN_EVENT_MOZLOG_TYPE
        self._logger = getLogger(GLEAN_EVENT_MOZLOG_TYPE)

        if app_display_version is None:
            from .utils import get_version_info

            app_display_version = get_version_info()["version"]

        if channel is None:
            channel = settings.RELAY_CHANNEL

        super().__init__(
            application_id=application_id,
            app_display_version=app_display_version,
            channel=channel,
        )

    def emit_record(self, now: datetime, ping: dict[str, Any]) -> None:
        """Emit record as a log instead of a print()"""
        self._logger.info(GLEAN_EVENT_MOZLOG_TYPE, extra=ping)
