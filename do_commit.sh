#!/bin/bash
set -e
git add -u
git add CHANGELOG.md
git commit -m "docs: v2.3.0 professional documentation overhaul

- Remove 13 internal planning/optimization/Android artifacts
- Add CHANGELOG.md with full version history (v2.0.0 to v2.3.0)
- Update README: version badge 2.3.0, session auth + RBAC documented,
  v2.3.0 features listed, default credentials table, updated structure
- Update GCP_DEPLOY.md: version header, generalize username, clarify auth
- Update all projectbusiness/ docs: version 2.3.0, date March 4 2026
- Update .gitignore to permanently exclude internal planning docs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
echo "DONE"
