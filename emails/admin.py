from django.contrib import admin

from .models import DeletedAddress, DomainAddress, RelayAddress, Reply


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    readonly_fields = ("created_at",)
    list_display = ("relay_address", "domain_address", "created_at")


admin.site.register(DeletedAddress)
admin.site.register(RelayAddress)
admin.site.register(DomainAddress)
