# Production Dashboard

Static, dependency-free review dashboard for `The Search Party`.

## Run locally

From the repository root:

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173/dashboard/
```

## What it shows

- current project status and safety gate
- valid visual review images
- all 16 shots with exact timing, action, Hebrew dialogue and sound
- production stages and approval gates
- browser-local shot approvals and review notes

Browser-local notes are not the repository source of truth. Copy them back into the project conversation before a decision is recorded in the Production Bible.

## Internet publishing

The dashboard is intentionally public and contains no secrets. `.github/workflows/deploy-dashboard.yml` packages only `dashboard/` and `assets/review/` and deploys them to GitHub Pages after a push to `main` or `work`.

The repository currently has no Git remote, so the workflow cannot run until a remote is configured and the branch is pushed. GitHub Pages may also need **Settings → Pages → Source: GitHub Actions** selected once in the repository.

## Update model

- Repository files remain the project source of truth.
- Dashboard content updates when a dashboard change is committed and pushed.
- Shot approvals and review notes entered in the browser are stored in that browser's `localStorage`; they are not automatically committed or synchronized between devices.
- Copy browser notes back into the project conversation so approved decisions can be recorded and published in the next dashboard update.
