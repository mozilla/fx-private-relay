from django.contrib import admin

from .models import Session, RealPhone, RelayNumber


admin.site.register(Session, admin.ModelAdmin)
admin.site.register(RealPhone, admin.ModelAdmin)
admin.site.register(RelayNumber, admin.ModelAdmin)
