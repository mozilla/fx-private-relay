from django.contrib import admin

from .models import DeletedAddress, Profile, RelayAddress


class DeletedAddressAdmin(admin.ModelAdmin):
    pass


class ProfileAdmin(admin.ModelAdmin):
    pass


class RelayAddressAdmin(admin.ModelAdmin):
    pass


admin.site.register(DeletedAddress, DeletedAddressAdmin)
admin.site.register(Profile, ProfileAdmin)
admin.site.register(RelayAddress, RelayAddressAdmin)
