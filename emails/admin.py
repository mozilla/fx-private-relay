from django.contrib import admin

from .models import RelayAddress, Messages


class RelayAddressAdmin(admin.ModelAdmin):
    pass


class MessagesAdmin(admin.ModelAdmin):
    pass


admin.site.register(RelayAddress, RelayAddressAdmin)
admin.site.register(Messages, MessagesAdmin)
