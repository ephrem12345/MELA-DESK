# Testing

Backend unit tests live in `backend/src/**/*.test.ts` and run through Vitest. They cover ticket access rules, status transitions, validation, and English/Amharic locale resolution.

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm test
```

Integration tests must use a dedicated MySQL database such as `meladesk_test`. Never run destructive migration or cleanup tests against production data. The GitHub Actions workflow provisions a separate MySQL service and applies checked-in migrations before test execution.

Coverage is configured for critical policy, validation, and localization code. Coverage numbers must come from an actual test run; no percentage is claimed here until dependencies and the test database are available.
