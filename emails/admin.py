from django.contrib import admin

from .models import RelayAddress, Message


class RelayAddressAdmin(admin.ModelAdmin):
    pass


class MessageAdmin(admin.ModelAdmin):
    pass


admin.site.register(RelayAddress, RelayAddressAdmin)
admin.site.register(Message, MessageAdmin)
