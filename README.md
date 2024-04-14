# Weekly Database Backup

This Node.js application automates MongoDB backups and uploads them to Google Drive using a cron job. It utilizes Express for API routes, Node-Cron for scheduling, Google Drive API for file uploads, and Child Process for executing MongoDB commands. The backups are compressed into ZIP files before uploading. Configuration is done via environment variables.

## Setting up google apis

1. open google apis
2. create a new project or open an existing project
3. search google drive from the top search bar and enable
4. if you dont already have a service account, then create creadential using the button in the top, select the service acconts
5. once created, it should show up in the service accounts section. then open the account, get to keys tab, and create a key by pressing the add key button.
6. a json file should be downloaded. rename it to `service-account.json`and place in the root of the codebase.
7. then add then add the following envs to complete the setup.

## Adding ENVS

you need to add the following envs in the .env file.

DATABASE=billing-system
MONGO_URL=mongodb://localhost:27017/billing-system
DRIVE_FOLDER_ID=GOODLE_DRIVE_FOLDER_ID

you can get the folder id form the url of the drive when you open the folder in the browser

You also have to give edit access to your service account so it can upload the file to drive. You can get the service account email from the service-account.json
