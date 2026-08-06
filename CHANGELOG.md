# Changelog

All notable changes to Virelio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Expanded local development seed data with paginated vendor and expense lists, multi-month reporting data, archived records, and downloadable proof fixtures.
- End-to-end coverage verifying repeated seed runs preserve database records and proof files.

### Changed

- Made development seeding repeatable without modifying the existing seed user or rewriting existing proof files.

## [0.4.0] - 2026-08-06

### Added

- Visible archive timestamps for vendors, expense categories, and expenses.
- Account creation and last-update timestamps in profile settings.
- A skip-to-content link and app-wide keyboard focus indicators.

### Changed

- Improved authentication and profile form accessibility with linked validation errors, invalid-state metadata, announced failures, and autocomplete hints.
- Improved vendor, expense-category, and expense form accessibility with linked validation errors, invalid-state metadata, semantic input types, and announced failures.
- Grouped dashboard and report date ranges and linked invalid-range feedback to both affected controls.
- Made proof uploads keyboard accessible and linked upload errors to the file control.
- Added contextual accessible names to archived-record and proof-removal actions.
- Identified the primary navigation and main-content landmarks for assistive technology.

## [0.3.0] - 2026-08-05

### Added

- Profile settings for updating the authenticated user's full name and email address.

## [0.2.0] - 2026-08-05

### Added

- Case-insensitive vendor search across names and contact fields.
- Expense search with vendor, category, and inclusive date-range filters.
- URL-persisted filters for refreshable, bookmarkable list views.
- Paginated active vendor and expense lists with total counts and previous or next navigation.
- Frontend unit and component integration coverage for shared application logic and primary workflows.

### Changed

- Added stable ordering to paginated lists so records do not move unpredictably between pages.
- Reloaded authoritative expense page data after create, edit, and archive operations.
- Updated the development seed user with a password compatible with the authentication flow.

## [0.1.0] - 2026-08-03

### Added

- Vendor creation, editing, archiving, restoration, permanent removal, and detail views.
- Expense category management with optional color values.
- Expense creation, editing, archiving, restoration, permanent removal, and detail views.
- Private receipt and invoice uploads, authenticated downloads, and removal.
- Dashboard spending summaries, category breakdowns, recent activity, and date filtering.
- Date-filtered expense reports with category totals and detailed expense rows.
- User registration, JWT authentication, protected routes, session hydration, and logout.
- Per-user ownership isolation across vendors, categories, expenses, proofs, dashboards, and reports.
- Tenant-scoped uniqueness for vendor contact information and category names.
- Backend unit and end-to-end coverage for the primary application workflows.

### Security

- Restricted proof-document access to authenticated owners and removed public upload serving.
