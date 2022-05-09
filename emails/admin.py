from django.contrib import admin

from .models import (
    DeletedAddress,
    DomainAddress,
    Profile,
    RegisteredSubdomain,
    RelayAddress,
    Reply,
)


class ReplyAdmin(admin.ModelAdmin):
    readonly_fields = ("created_at",)
    list_display = ("relay_address", "domain_address", "created_at")


admin.site.register(DeletedAddress)
admin.site.register(Profile)
admin.site.register(RelayAddress)
admin.site.register(DomainAddress)
admin.site.register(Reply, ReplyAdmin)
admin.site.register(RegisteredSubdomain)
