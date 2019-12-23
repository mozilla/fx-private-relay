from django.contrib import admin

from .models import Session


class SessionAdmin(admin.ModelAdmin):
    pass


admin.site.register(Session, SessionAdmin)
