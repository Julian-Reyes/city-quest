Check the deployment status of City Quest to GitHub Pages.

Steps:
1. Run `gh run list --limit 3` to show recent GitHub Actions workflow runs
2. If the latest run failed or is in progress, run `gh run view <run-id>` to get details and logs
3. Verify the live site is responding by fetching `https://julianreyes.dev/city-quest/` and checking for a 200 status
4. Report a clear summary: deployed successfully, in progress, or failed (with reason)
