# Private operations and recovery

Keep account-specific dashboard/notebook links, resource inventories, test
identities and traffic snapshots outside this public repository. The local
operator index is `~/.config/notes-along-the-way/operations.md` (directory mode
`700`, file mode `600`). Do not copy it into the repository or build output.
The media uploader/provisioner also uses a private `media.json` in that directory
for its bucket and AWS resource IDs; recover these from CloudFormation stack
parameters/outputs and the related AWS consoles. Its public delivery URL is
intentionally configured in `publishing/media.json`.
Keep passwords/API keys in a password manager or the appropriate secret store,
not in the operations note. Public docs describe architecture, variable names,
events and reproducible procedures without private account links or measurements.
Required public identifiers in application/provisioning configuration are not
credentials; moving a note does not make browser-visible configuration secret.

## Analytics launcher

The shell shortcut `./analytics.sh` opens the dashboard list by default;
`./analytics.sh traffic` and `./analytics.sh collections` open the respective
reports. It delegates to the same private-note reader, accepts `--print` and
`--notes /absolute/path`, and works from another directory when invoked by its
absolute path. Node and installed repository dependencies are required.

`npm run analytics:open` reads the private note each time and opens its traffic
dashboard in the default browser. `npm run analytics:open -- collections` selects
the collection/book dashboard; `npm run analytics:open -- dashboards` opens the
project's dashboard list. `--print` prints the selected URL without opening it.
`--notes /absolute/path` selects an alternative private note.

Under `## PostHog`, maintain exactly one bullet starting `- Traffic: ` and one
starting `- Collections/books: `, each containing a Markdown link to its dashboard.
The expected URL shape is `https://eu.posthog.com/project/<project-id>/dashboard/<dashboard-id>`
without credentials, query parameters or fragments. Keep the actual IDs only in
the private note. Dashboard names can change without affecting the launcher.
When replacing a dashboard, update its labelled link rather than appending another
entry. The launcher does not determine the latest dashboard through the API.
Use the signed-in dashboard list to verify or recover the correct destination.
Opening a link still requires the browser's normal PostHog authentication.

## Reconstruct a lost note

The note is a convenience index. Provider configuration is the source of truth:

1. **PostHog:** sign in to the configured region, choose the site's project, and
   open **Dashboards**. The traffic dashboard measures page views, users and
   sessions; the collection/book dashboard measures the custom events documented
   in [analytics and privacy](analytics-and-privacy.md). Copy each dashboard URL.
   Recover setup reports from **Notebooks**. If project names are ambiguous,
   compare the project token in project settings with the production Amplify
   environment value privately.
2. **API option:** authenticated dashboard listing/retrieval can recover IDs and
   definitions; listing requires `dashboard:read`. See the official
   [PostHog dashboard API](https://posthog.com/docs/api/dashboards).
   The public ingestion token does not grant reporting access.
3. **AWS:** find the Amplify app by connected repository or custom domain; inspect
   its production branch environment and deployment history. Find the short-link
   CloudFront distribution by its domain alias, then inspect its S3 origin.
4. Recreate the private directory/file with owner-only access. Add recovered
   links and identifiers, not credential values or copied visitor records.

This recovers references while the provider resources and account access still
exist. Deleting the note does not delete dashboards. Losing the dashboards or
project itself is different: the site's configuration cannot recreate exact
custom filters/layouts or historical events. That requires separate private
backups of dashboard/insight definitions and retained data. Such backups and
analytics exports are not configured; a lost verification snapshot may also be
unrecoverable after provider retention expires.

## Existing public history

Removing account links from current files does not erase earlier Git commits.
Dashboard URLs identify resources; access still depends on PostHog authentication
and sharing settings. This cleanup does not change sharing, revoke credentials,
or rewrite repository history.
