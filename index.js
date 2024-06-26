const express = require("express");
const cron = require("node-cron");
const { exec } = require("child_process");
const path = require("path");
const createReadStream = require("fs").createReadStream;
const fs = require("fs");
const process = require("process");
const { google } = require("googleapis");
require("dotenv").config();

const pkey = require("./service-account.json");

const app = express();

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Your API routes
app.get("/", (req, res) => {
  res.send("DB Backup Server");
});
/**
 * Authorize with service account and get jwt client
 *
 */
async function authorize() {
  const jwtClient = new google.auth.JWT(
    pkey.client_email,
    null,
    pkey.private_key,
    SCOPES
  );
  await jwtClient.authorize();
  return jwtClient;
}

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call if it's a directory
        deleteFolderRecursive(curPath);
      } else {
        // Delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath); // Finally, delete the folder itself
  }
}

/**
 * Create a new file on google drive.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function uploadFile(authClient) {
  // Get today's date
  const today = new Date();

  // Extract year, month, and day
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Month starts from 0, so add 1
  const day = String(today.getDate()).padStart(2, "0");

  // Format the date as yyyy-mm-dd
  const formattedDate = `${year}-${month}-${day}`;

  const fileName = `backup-${formattedDate}.zip`;

  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    var fileMetaData = {
      name: fileName,
      parents: [`${process.env.DRIVE_FOLDER_ID}`],
    };

    drive.files.create(
      {
        resource: fileMetaData,
        media: {
          body: createReadStream(`./dump/${fileName}`),
          mimeType: `application/zip`,
        },
        fields: "id",
      },
      function (error, file) {
        if (error) return reject(error);
        console.log("dump zip uploaded successfully");

        console.log("deleting the dump folder");
        deleteFolderRecursive("./dump");

        resolve(file);
      }
    );
  });
}

// Schedule cron job to take MongoDB backup every thursday 12pm
// testing */15 * * * * * every 15 seconds
// staging 1 * * * * first minute of every hour
cron.schedule("1 * * * *", () => {
  // Get today's date
  const today = new Date();

  // Extract year, month, and day
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Month starts from 0, so add 1
  const day = String(today.getDate()).padStart(2, "0");

  // Format the date as yyyy-mm-dd
  const formattedDate = `${year}-${month}-${day}`;

  const zipFileName = `backup-${formattedDate}.zip`;

  // Run mongodump command
  console.log("starting backup!");
  exec(
    `mongodump --uri=${process.env.MONGO_URL}`, // --out=${__dirname}
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing mongodump: ${error}`);
        return;
      }
      console.log(`mongodump stdout: ${stdout}`);
      console.log("Database backup taken successfully");

      // Create zip file of the backup directory then removing the folder
      exec(
        `cd ${__dirname}/dump && zip -r ${zipFileName} test  && rm -rf test`,
        async (zipError, zipStdout, zipStderr) => {
          if (zipError) {
            console.error(`Error creating zip file: ${zipError.message}`);
            return;
          }
          if (zipStderr) {
            console.error(`zip stderr: ${zipStderr}`);
            return;
          }
          console.log(`zip stdout: ${zipStdout}`);
          console.log(`Zip file ${zipFileName} created successfully`);

          console.log("uploading file");
          authorize()
            .then(uploadFile)
            .catch((error) => console.log("upload file error: ", error));
        }
      );
    }
  );
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
