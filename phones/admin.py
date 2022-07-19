from django.contrib import admin

from .models import RealPhone, RelayNumber


admin.site.register(RealPhone, admin.ModelAdmin)
admin.site.register(RelayNumber, admin.ModelAdmin)
