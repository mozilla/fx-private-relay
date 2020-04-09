import time

import markus


metrics = markus.get_metrics('fx-private-relay')


class FxAToRequest:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            return self.get_response(request)

        fxa_account = (
            request.user.socialaccount_set.filter(provider='fxa').first()
        )

        if not fxa_account:
            return self.get_response(request)

        request.fxa_account = fxa_account
        return self.get_response(request)


def _get_metric_view_name(request):
    if request.resolver_match:
        view = request.resolver_match.func
        return f'{view.__module__}.{view.__name__}'
    return '<unknown_view>'


class ResponseMetrics:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        delta = time.time() - start_time

        view_name = _get_metric_view_name(request)

        metrics.timing('response', value=delta * 1000.0, tags=[
            f'status:{response.status_code}',
            f'view:{view_name}',
            f'method:{request.method}',
        ])

        return response
