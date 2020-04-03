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
