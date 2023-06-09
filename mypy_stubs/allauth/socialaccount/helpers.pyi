from allauth.socialaccount.models import SocialLogin
from django.http import HttpRequest


def complete_social_login(request: HttpRequest, sociallogin: SocialLogin): ...
