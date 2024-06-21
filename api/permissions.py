from django.contrib.auth.models import AnonymousUser

from rest_framework import permissions
from rest_framework.request import Request
from rest_framework.views import APIView
from waffle import flag_is_active

READ_METHODS = ["GET", "HEAD"]


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class HasPremium(permissions.BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        if isinstance(request.user, AnonymousUser):
            return False
        if request.method in READ_METHODS:
            return True
        return request.user.profile.has_premium


class HasPhoneService(permissions.BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        if isinstance(request.user, AnonymousUser):
            return False
        if request.method in READ_METHODS:
            return True
        return request.user.profile.has_phone


class CanManageFlags(permissions.BasePermission):
    def has_permission(self, request, view):
        return flag_is_active(request, "manage_flags") and request.user.email.endswith(
            "@mozilla.com"
        )
