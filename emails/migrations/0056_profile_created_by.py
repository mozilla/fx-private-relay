# Generated by Django 3.2.19 on 2023-06-07 18:16

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("emails", "0055_add_date_phone_subsciption_end_reset_and_start_to_profile"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="created_by",
            field=models.CharField(blank=True, max_length=63, null=True),
        ),
    ]
