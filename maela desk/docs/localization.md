# Localization

The API accepts `en` and `am`. An authenticated user's saved preference takes precedence; otherwise the API uses a supported `Accept-Language` value and falls back to English. Enum values and field names remain language-independent.

Backend-generated ticket and SLA notification copy is localized at creation time, and the selected locale is stored on the notification so queued delivery does not change language later. User-authored ticket subjects, descriptions, and comments are stored without translation.

MySQL must use `utf8mb4`. SLA business-hour intervals are currently interpreted in UTC; configure holiday dates as ISO `YYYY-MM-DD` strings.
