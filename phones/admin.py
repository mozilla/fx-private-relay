from django.contrib import admin

from .models import InboundContact, RealPhone, RelayNumber

admin.site.register(InboundContact, admin.ModelAdmin)
admin.site.register(RealPhone, admin.ModelAdmin)
admin.site.register(RelayNumber, admin.ModelAdmin)
