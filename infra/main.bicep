// Vertex Infosolutions storefront — Azure infrastructure.
//
// Deploy:
//   az group create -n rg-vertex-prod -l centralindia
//   az deployment group create -g rg-vertex-prod -f infra/main.bicep \
//     -p namePrefix=vertex dbAdminPassword=<secret>
//
// What this creates:
//   - Azure Container Registry, for the image the GitHub Action pushes
//   - Azure Database for PostgreSQL Flexible Server, TLS-only
//   - Linux App Service Plan + Web App for Containers, with a managed identity
//     that pulls from the registry (no admin credentials anywhere)
//   - Log Analytics + Application Insights
//
// The database password is the one secret this template takes. Everything else
// the app needs is derived and written into the Web App's configuration.

@description('Prefix for every resource name. Lowercase letters and digits.')
@minLength(3)
@maxLength(11)
param namePrefix string = 'vertex'

@description('Region for all resources.')
param location string = resourceGroup().location

@description('Administrator login for PostgreSQL.')
param dbAdminUser string = 'vertexadmin'

@description('Administrator password for PostgreSQL. Supply at deploy time; never commit it.')
@secure()
@minLength(12)
param dbAdminPassword string

@description('App Service Plan SKU. B1 is enough to launch; P1v3 once traffic justifies it.')
@allowed(['B1', 'B2', 'P0v3', 'P1v3'])
param appServiceSku string = 'B1'

@description('PostgreSQL SKU. Burstable is fine below a few hundred orders a day.')
param databaseSku string = 'Standard_B1ms'

@description('PostgreSQL storage, GB. Can be grown later but never shrunk.')
param databaseStorageGb int = 32

// ---------------------------------------------------------------------------
// What the application needs to run
//
// These are parameters rather than something set by hand in the portal,
// because App Service replaces the *entire* app-settings collection on every
// deployment. Anything typed into the portal is silently gone the next time
// this template runs — which is a bad way to discover that your Stripe key has
// vanished mid-order.
//
// So the parameters file is the source of truth. Keep `infra/main.parameters.json`
// (git-ignored, copied from the example beside it), pass it on every deploy,
// and redeploying becomes safe by construction.
//
// Every one of these may be left empty. The application treats an empty value
// exactly as an unset one and degrades on purpose: no Stripe key means
// checkout refuses in production, no Resend key means messages are recorded
// but not sent, no CRON_SECRET means the scheduled endpoints answer 503. That
// is what makes the first deploy — before you have a Stripe webhook secret to
// give it — possible at all.
// ---------------------------------------------------------------------------

@description('Public URL of the store. Leave empty to use the App Service default hostname; set it when a custom domain is in front.')
param appUrl string = ''

@description('Addresses that may reach /admin, comma-separated. Empty means nobody.')
param adminEmails string = ''

@description('Shared secret for the scheduled endpoints. Generate with: openssl rand -hex 32')
@secure()
param cronSecret string = ''

@description('Stripe secret key. Without it checkout refuses to run in production.')
@secure()
param stripeSecretKey string = ''

@description('Stripe webhook signing secret. Empty on the first deploy — the endpoint has to exist before Stripe will give you one.')
@secure()
param stripeWebhookSecret string = ''

@description('Resend API key. Without it no one-time code is delivered and no account can be verified.')
@secure()
param resendApiKey string = ''

@description('Sender for all email, e.g. "Vertex Infosolutions <orders@example.com>".')
param emailFrom string = ''

@description('Header carrying the visitor country, set by a geo-IP rule at the edge.')
param geoCountryHeader string = ''

@description('Header carrying the caller IP, set by the edge. Without a trustworthy one the sign-in limits keyed on the caller can be evaded.')
param clientIpHeader string = ''

@description('WhatsApp Cloud API token. Optional; order updates only.')
@secure()
param whatsappToken string = ''

@description('WhatsApp Cloud API phone number id.')
param whatsappPhoneNumberId string = ''

@description('Who the seller legally is. Blank fields are not rendered, and a tax invoice missing these says so on its face.')
param companyLegalName string = ''
param companyAddress string = ''
param companyRegistrationNumber string = ''
param companyTaxId string = ''
param companySupportEmail string = ''
param companySupportPhone string = ''
param companyComplaintsName string = ''
param companyComplaintsEmail string = ''

var unique = uniqueString(resourceGroup().id)
var registryName = '${namePrefix}acr${unique}'
var databaseServerName = '${namePrefix}-pg-${unique}'
var webAppName = '${namePrefix}-web-${unique}'
var planName = '${namePrefix}-plan'
var databaseName = 'vertex'

// --- Observability ---------------------------------------------------------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// --- Container registry ----------------------------------------------------

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: {
    // The Web App authenticates with its managed identity instead, so the
    // admin account stays off.
    adminUserEnabled: false
  }
}

// --- Database --------------------------------------------------------------

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: databaseServerName
  location: location
  sku: {
    name: databaseSku
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: databaseStorageGb
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 14
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allows other Azure services — the Web App among them — to reach the server.
// Tighten this to a private endpoint or VNet integration before launch; it is
// the loosest rule that still works without a VNet, not the right end state.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// --- App Service -----------------------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: appServiceSku
  }
  kind: 'linux'
  properties: {
    reserved: true // required for Linux
  }
}

resource web 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      // Placeholder until the first image is pushed; the GitHub Action sets
      // the real tag on every deploy.
      linuxFxVersion: 'DOCKER|mcr.microsoft.com/appsvc/staticsite:latest'
      alwaysOn: appServiceSku != 'B1'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      acrUseManagedIdentityCreds: true
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${registry.properties.loginServer}'
        }
        {
          // sslmode=require is not optional: Flexible Server refuses plaintext.
          name: 'DATABASE_URL'
          value: 'postgresql://${dbAdminUser}:${dbAdminPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
        }
        {
          name: 'DATABASE_POOL_MAX'
          value: '10'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insights.properties.ConnectionString
        }
        {
          // Stripe returns customers here and every email links here, so it is
          // configuration rather than something derived from a request Host
          // header — that header is attacker-controlled, and trusting it would
          // let somebody redirect a completed payment to their own site.
          name: 'APP_URL'
          value: empty(appUrl) ? 'https://${webAppName}.azurewebsites.net' : appUrl
        }
        {
          name: 'ADMIN_EMAILS'
          value: adminEmails
        }
        {
          name: 'CRON_SECRET'
          value: cronSecret
        }
        {
          name: 'STRIPE_SECRET_KEY'
          value: stripeSecretKey
        }
        {
          name: 'STRIPE_WEBHOOK_SECRET'
          value: stripeWebhookSecret
        }
        {
          name: 'RESEND_API_KEY'
          value: resendApiKey
        }
        {
          name: 'EMAIL_FROM'
          value: emailFrom
        }
        {
          name: 'GEO_COUNTRY_HEADER'
          value: geoCountryHeader
        }
        {
          name: 'CLIENT_IP_HEADER'
          value: clientIpHeader
        }
        {
          name: 'WHATSAPP_TOKEN'
          value: whatsappToken
        }
        {
          name: 'WHATSAPP_PHONE_NUMBER_ID'
          value: whatsappPhoneNumberId
        }
        {
          name: 'COMPANY_LEGAL_NAME'
          value: companyLegalName
        }
        {
          name: 'COMPANY_ADDRESS'
          value: companyAddress
        }
        {
          name: 'COMPANY_REGISTRATION_NUMBER'
          value: companyRegistrationNumber
        }
        {
          name: 'COMPANY_TAX_ID'
          value: companyTaxId
        }
        {
          name: 'COMPANY_SUPPORT_EMAIL'
          value: companySupportEmail
        }
        {
          name: 'COMPANY_SUPPORT_PHONE'
          value: companySupportPhone
        }
        {
          name: 'COMPANY_COMPLAINTS_OFFICER_NAME'
          value: companyComplaintsName
        }
        {
          name: 'COMPANY_COMPLAINTS_OFFICER_EMAIL'
          value: companyComplaintsEmail
        }
      ]
    }
  }
  dependsOn: [database, allowAzure]
}

// Lets the Web App's identity pull images without a registry password.
var acrPullRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, web.id, acrPullRoleId)
  properties: {
    principalId: web.identity.principalId
    roleDefinitionId: acrPullRoleId
    principalType: 'ServicePrincipal'
  }
}

// --- Outputs ---------------------------------------------------------------

output webAppName string = web.name
output webAppUrl string = 'https://${web.properties.defaultHostName}'
output registryLoginServer string = registry.properties.loginServer
output registryName string = registry.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output databaseName string = databaseName
