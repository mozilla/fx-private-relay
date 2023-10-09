# Django Migrations Standards

From Django 3.2 documentation on [Migrations][]

> Migrations are Django’s way of propagating changes you make to your models (adding a field, deleting a model, etc.) into your database schema. They’re designed to be mostly automatic, but you’ll need to know when to make migrations, when to run them, and the common problems you might run into.

For creating migrations use [Django's built-in commands][].

[Django's built-in commands]: https://docs.djangoproject.com/en/3.2/topics/migrations/#the-commands
[Migrations]: https://docs.djangoproject.com/en/3.2/topics/migrations/#module-django.db.migrations

### Adding New Model Field

The Django migration command `./manage.py makemigrations` utilizes [AddField operation][] from `django.db.migrations` and creates the new column in the database. If specified on the field, the migration applies the default value to the existing entries when the new column is added in the database. However, the migration never specifies the default value in the database column. The code and the database can be misaligned and cause errors when:

1. Version X code is happily running in several pods.
2. The migrations for Version X+1 run.
   - New empty tables are added.
   - New columns are added to existing tables.
3. Version X code needs to run happily against the X+1 database:

   - When writing a new entry to the updated table with a new column, version X doesn't know about new columns and will omit them from INSERT statements.
     > [!NOTE]
     > These columns need a database default or allow `NULL`

4. Canary pod with Version X+1 starts. It is running the same time as all the Version X pods.
5. Kubernetes rollout of Version X+1 starts:
   - New pod with Version X+1 starts.
   - When the Version X+1 pod is running, the Version X pod is shut down. This continues until no pods run Version X.
6. Version X+1 code is happily running in several pods.
   > [!WARNING]
   > Misaligned code and database happens in Step 3 when Version X adds a new entry to the table without proper default set. In Step 6, the Version X+1 retrieves the entry. The fetched entry added by Version X does not meet the field validation in Version X+1 causing validation error.

<!-- TODO: MPP-3464 Add instructions to prevent or mitigate the error while add new field -->

[AddField operation]: https://docs.djangoproject.com/en/3.2/ref/migration-operations/#addfield

### Deleting Existing Model or Model Field

Like adding a new field in an existing model, when deleting an existing model or a field in the model there is a possibility that the code referencing the fields can run while the table or the column no longer exists in the database. All reference to the field and the field is removed from the code. The Django migration command `./manage.py makemigrations` utilizes [RemoveField operation][] from `django.db.migrations` and deletes the corresponding column in the database. The code and the database can be misaligned when:

1. Version X code is happily running in several pods.
2. The migrations for Version X+1 run.
   - Old columns are removed.
3. Version X code needs to run happily against the X+1 database:
   - The deleted field is already removed from the Django model in version X.
   - Meanwhile the column remains in the database.
     > [!NOTE]
     > When writing to an existing table, version X should not refer to deleted columns.
4. Canary pod with Version X+1 starts. It is running the same time as all the Version X pods.
5. Kubernetes rollout of Version X+1 starts:
   - New pod with Version X+1 starts.
   - When the Version X+1 pod is running, the Version X pod is shut down. This continues until no pods run Version X.
6. Version X+1 code is happily running in several pods.
   > [!WARNING]
   > Error happens when Version X or Version X+1 code refers to the deleted column.

To prevent the error we need to:

1. Remove all references of the field or the model in the code.
2. Deploy the code removals to production.
3. Then remove the field or model from the `models.py` file and create a migration that removes the column or the table from the database.
4. Deploy the model changes and its migration to production.

[RemoveField operation]: https://docs.djangoproject.com/en/3.2/ref/migration-operations/#removefield

## Terms

<!-- TODO: MPP-3464 Add terminology definitions -->

Field
Column
Migration
Model
Entry

## Links

- [Database Refactoring] - a technique which enables Continuous Delivery

[Database Refactoring]: https://www.databaserefactoring.com/
