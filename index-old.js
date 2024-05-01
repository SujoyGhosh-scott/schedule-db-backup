const express = require("express");
const cron = require("node-cron");
const { exec } = require("child_process");
const path = require("path");
const createReadStream = require("fs").createReadStream;
const unlink = require("fs").unlink;
const process = require("process");
const { google } = require("googleapis");
require("dotenv").config();
const chmod = require("fs").chmod;

chmod(__dirname, 0o777, (err) => {
  if (err) {
    console.error("Error granting write access:", err);
    return;
  }
  console.log("Write access granted to the directory:", __dirname);
});

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

  const fileName = `${process.env.DATABASE}-backup-${formattedDate}.zip`;
  console.log("filename: ", fileName);

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
          body: createReadStream(`./backup/${fileName}`),
          mimeType: `application/zip`,
        },
        fields: "id",
      },
      function (error, file) {
        if (error) return reject(error);
        console.log("dump zip uploaded successfully");

        console.log("deleting the zip file");
        // Specify the path to the file you want to delete
        const filePath = `./backup/${fileName}`;

        // Delete the file
        unlink(filePath, (err) => {
          if (err) {
            console.error("Error deleting file:", err);
            return;
          }
          console.log("File deleted successfully");
        });

        resolve(file);
      }
    );
  });
}

// Schedule cron job to take MongoDB backup every thursday 12pm
cron.schedule("* * * * *", () => {
  const backupDir = path.join(__dirname, "backup"); // Backup directory in the root of the codebase

  // Get today's date
  const today = new Date();

  // Extract year, month, and day
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Month starts from 0, so add 1
  const day = String(today.getDate()).padStart(2, "0");

  // Format the date as yyyy-mm-dd
  const formattedDate = `${year}-${month}-${day}`;

  const zipFileName = `${process.env.DATABASE}-backup-${formattedDate}.zip`;

  // Run mongodump command
  console.log("starting backup!");
  exec(
    `mongodump --uri=${process.env.MONGO_URL} --out=${backupDir}`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing mongodump: ${error.message}`);
        return;
      }
      console.log(`mongodump stdout: ${stdout}`);
      console.log("Database backup taken successfully");

      // Create zip file of the backup directory then removing the folder
      exec(
        `cd ${backupDir} && zip -r ${zipFileName} ${process.env.DATABASE} && rm -rf ${process.env.DATABASE}`,
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
