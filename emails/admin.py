from django.contrib import admin

from .models import RelayAddress, Message, Profile


class RelayAddressAdmin(admin.ModelAdmin):
    pass


class MessageAdmin(admin.ModelAdmin):
    pass


class ProfileAdmin(admin.ModelAdmin):
    pass


admin.site.register(RelayAddress, RelayAddressAdmin)
admin.site.register(Message, MessageAdmin)
admin.site.register(Profile, ProfileAdmin)
