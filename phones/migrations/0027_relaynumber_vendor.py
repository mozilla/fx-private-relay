# Generated by Django 3.2.16 on 2023-02-22 16:50

from django.db import migrations, models


def add_db_default_forward_func(apps, schema_editor):
    """
    Add a database default of 'twilio' for vendor, for PostgreSQL and SQLite3

    Using `./manage.py sqlmigrate` for the SQL, and the technique from:
    https://stackoverflow.com/a/45232678/10612
    """
    if schema_editor.connection.vendor.startswith("postgres"):
        schema_editor.execute(
            'ALTER TABLE "phones_relaynumber"'
            " ALTER COLUMN \"vendor\" SET DEFAULT 'twilio';"
        )
    elif schema_editor.connection.vendor.startswith("sqlite"):
        # Add default 'twilio' to phone_relaynumber.vendor
        schema_editor.execute(
            'CREATE TABLE "new__phones_relaynumber"'
            ' ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,'
            ' "number" varchar(15) NOT NULL,'
            ' "location" varchar(255) NOT NULL,'
            ' "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED,'
            ' "vcard_lookup_key" varchar(6) NOT NULL UNIQUE,'
            ' "enabled" bool NOT NULL,'
            ' "calls_blocked" integer NOT NULL,'
            ' "calls_forwarded" integer NOT NULL,'
            ' "remaining_texts" integer NOT NULL,'
            ' "texts_blocked" integer NOT NULL,'
            ' "texts_forwarded" integer NOT NULL,'
            ' "remaining_seconds" integer NOT NULL DEFAULT 3000,'
            ' "remaining_minutes" integer NULL,'
            " \"country_code\" varchar(2) NOT NULL DEFAULT 'US',"
            " \"vendor\" varchar(15) NOT NULL DEFAULT 'twilio');"
        )
        schema_editor.execute(
            'INSERT INTO "new__phones_relaynumber"'
            ' ("id", "number", "location", "user_id", "vcard_lookup_key", "enabled",'
            ' "calls_blocked", "calls_forwarded", "remaining_texts", "texts_blocked",'
            ' "texts_forwarded", "remaining_seconds", "remaining_minutes",'
            ' "country_code", "vendor")'
            ' SELECT "id", "number", "location", "user_id", "vcard_lookup_key",'
            ' "enabled", "calls_blocked", "calls_forwarded", "remaining_texts",'
            ' "texts_blocked", "texts_forwarded", "remaining_seconds",'
            ' "remaining_minutes", "country_code", \'twilio\' FROM "phones_relaynumber";'
        )
        schema_editor.execute('DROP TABLE "phones_relaynumber";')
        schema_editor.execute(
            'ALTER TABLE "new__phones_relaynumber" RENAME TO "phones_relaynumber";'
        )
        schema_editor.execute(
            'CREATE INDEX "phones_relaynumber_number_742e5d6b" ON "phones_relaynumber"'
            ' ("number");'
        )
        schema_editor.execute(
            'CREATE INDEX "phones_relaynumber_user_id_62c65ede" ON "phones_relaynumber"'
            ' ("user_id");'
        )


class Migration(migrations.Migration):
    dependencies = [
        ("phones", "0026_inboundcontact_add_last_call_and_text_dates"),
    ]

    operations = [
        migrations.AddField(
            model_name="relaynumber",
            name="vendor",
            field=models.CharField(default="twilio", max_length=15),
        ),
        migrations.RunPython(
            code=add_db_default_forward_func,
            reverse_code=migrations.RunPython.noop,
            elidable=True,
        ),
    ]
