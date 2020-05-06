from django.contrib import admin

from .models import Invitations


class InvitationsAdmin(admin.ModelAdmin):
    pass


admin.site.register(Invitations, InvitationsAdmin)
