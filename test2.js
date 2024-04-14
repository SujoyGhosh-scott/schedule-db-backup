const createReadStream = require("fs").createReadStream;
const { google } = require("googleapis");

const pkey = require("./service-account.json");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

console.log("uploading file");

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

async function uploadFile(authClient) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    var fileMetaData = {
      name: "billing-system-backup-2024-04-14.zip",
      parents: ["DRIVE_FOLDER_ID"],
    };

    drive.files.create(
      {
        resource: fileMetaData,
        media: {
          body: createReadStream(
            "./backup/billing-system-backup-2024-04-14.zip"
          ),
          mimeType: `application/zip`,
        },
        fields: "id",
      },
      function (error, file) {
        if (error) return reject(error);
        console.log("dump zip uploaded successfully");
        resolve(file);
      }
    );
  });
}

authorize()
  .then(uploadFile)
  .catch((error) => console.error("Authorization error:", error));
