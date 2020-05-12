import contextlib
import markus
import logging
from socketlabs.injectionapi import SocketLabsClient

from django.conf import settings
from django.http import HttpResponse


logger = logging.getLogger('events')
metrics = markus.get_metrics('fx-private-relay')


def time_if_enabled(name):
    def timing_decorator(func):
        def func_wrapper(*args, **kwargs):
            ctx_manager = (metrics.timer(name) if settings.STATSD_ENABLED
                           else contextlib.nullcontext())
            with ctx_manager:
                return func(*args, **kwargs)
        return func_wrapper
    return timing_decorator


@time_if_enabled('socketlabs_client')
def get_socketlabs_client():
    return SocketLabsClient(
        settings.SOCKETLABS_SERVER_ID, settings.SOCKETLABS_API_KEY
    )


@time_if_enabled('socketlabs_client_send')
def socketlabs_send(sl_client, sl_message):
    try:
        return sl_client.send(sl_message)
    except Exception:
        logger.exception("exception during sl send")
        return HttpResponse("Internal Server Error", status=500)
