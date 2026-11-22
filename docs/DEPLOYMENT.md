# Deploying to Microsoft Azure (App Service for Containers)

Prerequisites: Azure account (Azure for Students works), Azure CLI (`az`), repo pushed to GitHub.

## 1. Create the Azure resources
```bash
az login
az group create --name placement-rg --location centralindia
az appservice plan create --name placement-plan --resource-group placement-rg --is-linux --sku B1
# Web app names must be globally unique - change "placement-portal-yourname"
az webapp create --resource-group placement-rg --plan placement-plan \
  --name placement-portal-yourname \
  --deployment-container-image-name ghcr.io/<github-username>/placement-portal:latest
```

## 2. Configure the app
```bash
az webapp config appsettings set --resource-group placement-rg --name placement-portal-yourname \
  --settings WEBSITES_PORT=3000 WEBSITES_ENABLE_APP_SERVICE_STORAGE=true DATA_DIR=/home/data
```
`DATA_DIR=/home/data` stores the JSON database and resumes on Azure's persistent `/home` storage.

## 3. Make the GHCR image pullable
GitHub > your profile > Packages > placement-portal > Package settings > set visibility to **Public**
(or add registry credentials in the Web App's Deployment Center).

## 4. Connect GitHub Actions
1. Azure Portal > your Web App > **Download publish profile**.
2. GitHub repo > Settings > Secrets and variables > Actions:
   - Secret `AZURE_WEBAPP_PUBLISH_PROFILE` = contents of the publish profile file
   - Variable `AZURE_WEBAPP_NAME` = `placement-portal-yourname`
3. Push to `main` (or run the "Deploy to Azure" workflow manually).

## 5. Verify
Open `https://placement-portal-yourname.azurewebsites.net` and `/health`.

## Clean up (to avoid charges)
```bash
az group delete --name placement-rg --yes
```
