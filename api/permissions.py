from rest_framework import permissions

from emails.models import Profile


READ_METHODS = ["GET", "HEAD"]


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class HasPremium(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in READ_METHODS:
            return True
        profile = Profile.objects.get(request.user)
        return profile.has_premium()


class HasPhoneService(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in READ_METHODS:
            return True
        profile = Profile.objects.get(user=request.user)
        return profile.has_phone
