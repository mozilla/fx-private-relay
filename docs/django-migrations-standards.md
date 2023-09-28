# Django Migrations Standards

From Django 3.2 documentation on [Migrations](https://docs.djangoproject.com/en/3.2/topics/migrations/#module-django.db.migrations)

> Migrations are Django’s way of propagating changes you make to your models (adding a field, deleting a model, etc.) into your database schema. They’re designed to be mostly automatic, but you’ll need to know when to make migrations, when to run them, and the common problems you might run into.

For creating migrations use Django's built-in commands [here](https://docs.djangoproject.com/en/3.2/topics/migrations/#the-commands).

### Deleting Existing Model or Model Field

Like adding a new field in an existing model, when deleting an existing model or a field in the model there is a possibility that the code referencing the fields can run while the table or the column no longer exists in the database. All reference to the field and the field is removed from the code. The Django migration command `./manage.py makemigrations` utilizes [RemoveField operation][] from `django.db.migrations` and deletes the corresponding column in the database. The code and the database can be misaligned when:

1. Version X code is happily running in several pods.
2. The migrations for Version X+1 run.
   - Old columns are removed.
3. Version X code needs to run happily against the X+1 database:
   - [!NOTE] When writing to an existing table, version X should not refer to deleted columns.
   - The deleted field is already removed from the Django model in version X.
   - Meanwhile the column remains in the database.
4. Canary pod with Version X+1 starts. It is running the same time as all the Version X pods.
5. Kubernetes rollout of Version X+1 starts:
   - New pod with Version X+1 starts.
   - When the Version X+1 pod is running, the Version X pod is shut down. This continues until no pods run Version X.
6. Version X+1 code is happily running in several pods.
   [!WARNING] Error happens when Version X or Version X+1 code refers to the deleted column.

To prevent the error we need to:

1. Remove all references of the field or the model in the code.
2. Deploy the removals to production.
3. Then remove the field or model from the `models.py` file and create a migration that removes the column or the table from the database.
4. Deploy the model changes and its migration to production.

[RemoveField operation]: https://docs.djangoproject.com/en/3.2/ref/migration-operations/#removefield
