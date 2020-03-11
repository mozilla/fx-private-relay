from django.contrib import admin

from .models import RelayAddress, Profile


class RelayAddressAdmin(admin.ModelAdmin):
    pass


class ProfileAdmin(admin.ModelAdmin):
    pass


admin.site.register(RelayAddress, RelayAddressAdmin)
admin.site.register(Profile, ProfileAdmin)
