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

@description('Currency the store prices in, ISO 4217.')
param storeCurrency string = 'USD'

@description('App Service Plan SKU. B1 is enough to launch; P1v3 once traffic justifies it.')
@allowed(['B1', 'B2', 'P0v3', 'P1v3'])
param appServiceSku string = 'B1'

@description('PostgreSQL SKU. Burstable is fine below a few hundred orders a day.')
param databaseSku string = 'Standard_B1ms'

@description('PostgreSQL storage, GB. Can be grown later but never shrunk.')
param databaseStorageGb int = 32

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
          name: 'STORE_CURRENCY'
          value: storeCurrency
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insights.properties.ConnectionString
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
