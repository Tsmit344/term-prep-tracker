# Term Prep Tracker

A simple, responsive term-prep dashboard designed for **Spring 2027 OMBA** and future terms. It requires **no installs, build tools, or external services**. GitHub Pages can host it directly.

## Features

- Dashboard with counts and a color-coded submission-progress bar.
- Course table for syllabus, import version, due dates, and live sessions.
- **Start Check-in**: work through every course, answer four questions, and add instructor/ID notes.
- Review screen, then **Finish Check-in & Update Dashboard** to recalculate all statuses.
- Click a table row to start a check-in focused on that course.
- Course directory to add or edit courses, instructors, and optional Canvas links.
- New terms, with an option to copy the existing course roster and reset submissions.
- Check-in history for completed check-ins.
- Export/import a JSON backup, export a CSV report, and print the dashboard.
- Responsive design for desktop and mobile; no analytics or third-party libraries.

## Important: historical overview versus course details

The supplied starting dashboard preserves the **October 30, 2026 aggregate summary of 1 complete, 6 partial, 8 none** as a *previous reported snapshot*, **not verified course-by-course data**. The individual fields begin at **Not checked**. The two courses absent from the available course list are clearly named **Course 14** and **Course 15**, and **MARK 538** has a missing title and instructor. Edit those in **All Courses**. Your first completed check-in replaces the historical aggregate with totals calculated entirely from your answers.

## Course status rules

- **Complete**: every field is `Received` or `N/A`.
- **Partial**: at least one field is `Received` and at least one is `Missing`, with no pending or clarification fields.
- **None**: at least one field is `Missing` and no fields are `Received`, with no pending or clarification fields.
- **To verify**: any field is still `Not checked` or set to `Clarify`, unless all fields are `Not checked`.
- **Not checked**: all four fields are unanswered.

A response of `N/A` means the requirement is not applicable; it does not count as missing.

## How to publish on GitHub Pages

1. Create a new repository in GitHub, e.g. `term-prep-tracker`.
2. Upload `index.html`, `styles.css`, `app.js`, and `favicon.svg` **to the repository root** (not inside another folder).
3. Open repository **Settings → Pages**.
4. Choose **Deploy from a branch** → `main` → `/(root)` → **Save**.
5. Open the published website from Settings → Pages.

The `.nojekyll` file is included to make static publishing explicit. No build step is needed.

## How to use the tracker

1. Open the website and check the starting dashboard.
2. Use **All Courses** to fill in missing course information.
3. Select **Start Check-in** and review each course. Options: **Received**, **Missing**, **N/A**, **Clarify**.
4. Add notes, including import preferences or any instructor-specific caveats.
5. On the summary screen, select **Finish Check-in & Update Dashboard**.
6. Use **Export / Import → Export backup (.json)** regularly to save a recoverable copy.

## Data storage / privacy

**Important:** this static GitHub Pages version stores changes in your browser's `localStorage` only. It does **not** automatically write data to GitHub or sync it across devices, browsers, or colleagues. Export/import JSON to back up or transfer data. Browser clearing or private/incognito windows may erase data. The supplied site code includes a public course roster, not individual submission notes; do not commit private instructor notes or other confidential data into a public GitHub repository. GitHub Pages can be publicly accessible **even when the source repository is private**, depending on the account and site configuration. A later multi-user version would require authenticated private storage (such as an approved institutional backend).

## Project structure

```
index.html   – page structure, buttons, forms, and navigation
styles.css   – visual appearance and mobile styles
app.js       – seed course list, check-in logic, dashboard, browser storage
favicon.svg  – site icon
.nojekyll    – GitHub Pages static publishing marker
```

## Customizing the roster

The initial courses are in `seedRows` near the top of `app.js`. Once data is saved in your browser, changes to `seedRows` won't overwrite your records. Update courses through **All Courses** or reset site data only when you intend to start fresh.