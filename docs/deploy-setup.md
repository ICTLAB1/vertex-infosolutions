# Connecting GitHub to Azure, once

Every push to `main` already builds the site, runs the tests, applies the
database migrations and switches the live site over. It has been trying to do
that since 4 September and failing at the first step, because Azure has never
been told to trust this repository.

This is a one-time job of about ten minutes. Afterwards you never open Cloud
Shell for a deploy again.

Nothing here is a placeholder. Every command looks up the values it needs.

---

## Step 1 — create the identity Azure will trust

Paste this into Azure Cloud Shell, all at once:

```bash
RG=$(az group list --query "[?contains(name,'vertex')].name | [0]" -o tsv)
APP=$(az webapp list -g "$RG" --query "[0].name" -o tsv)
ACR=$(az acr list -g "$RG" --query "[0].name" -o tsv)
SUB=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)
APPID=$(az ad app create --display-name vertex-github-deploy --query appId -o tsv)
az ad sp create --id "$APPID" >/dev/null
echo "Group $RG / App $APP / Registry $ACR"
```

You should see one line naming your group, web app and registry. If any is
blank, stop and say so.

## Step 2 — let it deploy, and only to this resource group

```bash
az role assignment create \
  --role Contributor \
  --assignee "$APPID" \
  --scope "/subscriptions/$SUB/resourceGroups/$RG"
```

It prints a block of JSON. That is success.

## Step 3 — tell Azure which repository may use it

Two entries, and both are needed. The second one is the one everybody gets
wrong: because the deploy job runs in a GitHub *environment* named
`production`, the name Azure must trust is the environment, not the branch.
With only the branch entry the login still fails, with the same message.

```bash
cat > /tmp/fic-branch.json <<'JSON'
{
  "name": "vertex-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:ICTLAB1/vertex-infosolutions:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON

cat > /tmp/fic-env.json <<'JSON'
{
  "name": "vertex-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:ICTLAB1/vertex-infosolutions:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON

az ad app federated-credential create --id "$APPID" --parameters @/tmp/fic-branch.json
az ad app federated-credential create --id "$APPID" --parameters @/tmp/fic-env.json
```

## Step 4 — print the seven values GitHub needs

```bash
echo
echo "SECRETS  (Settings → Secrets and variables → Actions → Secrets tab)"
echo "  AZURE_CLIENT_ID        $APPID"
echo "  AZURE_TENANT_ID        $TENANT"
echo "  AZURE_SUBSCRIPTION_ID  $SUB"
echo "  DATABASE_URL           $(az webapp config appsettings list --name "$APP" --resource-group "$RG" --query "[?name=='DATABASE_URL'] | [0].value" -o tsv)"
echo
echo "VARIABLES  (same page, Variables tab)"
echo "  AZURE_RESOURCE_GROUP   $RG"
echo "  AZURE_REGISTRY         $ACR"
echo "  AZURE_WEBAPP_NAME      $APP"
echo
```

Keep this window open. `DATABASE_URL` is a password — put it straight into
GitHub and do not paste it anywhere else.

## Step 5 — put them into GitHub

Open
<https://github.com/ICTLAB1/vertex-infosolutions/settings/secrets/actions>.

- **Secrets** tab → *New repository secret* → add the four marked SECRETS.
- **Variables** tab → *New repository variable* → add the three marked
  VARIABLES.

Names must match exactly, including the underscores.

## Step 6 — create the environment the deploy job runs in

Open
<https://github.com/ICTLAB1/vertex-infosolutions/settings/environments>,
choose **New environment**, name it `production`, and save. No protection
rules are needed. This must exist or the deploy job never starts.

## Step 7 — run it

Open
<https://github.com/ICTLAB1/vertex-infosolutions/actions/workflows/azure-deploy.yml>,
press **Run workflow**, and leave *Rewrite the live catalogue* switched off.

Both jobs should go green in about six minutes. The last step waits for the
live site's health check to answer, so a green run means the new version is
genuinely serving — not merely that the image was pushed.

---

## Afterwards

**Every push to `main` deploys itself.** No commands, no Cloud Shell.

**When a price book changes** and the catalogue needs rewriting from the code,
run the workflow by hand with *Rewrite the live catalogue* switched **on**.
That is deliberately never automatic: it rewrites names and prices from
`prisma/seed.ts`, which would silently undo a price corrected in the back
office. It never touches an order, a basket, a review or an account.

**If a run fails**, the first step now names the setting that is missing
rather than failing inside the Azure sign-in with a message about client IDs.
