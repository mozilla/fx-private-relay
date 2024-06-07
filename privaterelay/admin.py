from django.contrib import admin

from .models import Profile, RegisteredSubdomain

admin.site.register(Profile)
admin.site.register(RegisteredSubdomain)
