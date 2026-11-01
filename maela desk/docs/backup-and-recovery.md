# Backup and recovery

The Compose database volume is persistent but is not a backup. Production deployments must schedule encrypted MySQL backups, retain copies outside the database host, and test restores regularly.

For a local MySQL server, export a consistent snapshot with `mysqldump --single-transaction --routines --triggers` and store the encrypted dump in an access-controlled location. Restore into a new database first, validate row counts and application health, then perform a controlled cutover. Keep the private upload volume backed up with the same retention policy as attachment metadata.

Do not delete `audit_logs`, ticket status history, or assignment history as part of ordinary account deactivation. Define organization-specific data retention and legal-hold rules before purging ticket or attachment records.
