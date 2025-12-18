import 'dotenv/config'
import { program } from "commander";
import extractAnnotations from './lib/getAnnotations.js';
import syncAllAnnotations from './lib/syncAll.js';

program
  .command("read")
  .option('-i, --input <sqlite>','Kobo SQLite database',process.env.KOBO_DB)
  .option('-o, --out <json>','Path for the annotations.json file to create or update',process.env.ANNOTATIONS_FILE)
  .description("Read a Kobo sqlite database and extract all the annotations")
  .action(async ({input, out}) => {
    try {
      console.log("get annotations command called");
      await extractAnnotations({
        dbPath: input,
        outputFile: out
      });
    } catch (error) {
      console.error("Error extracting annotations:", error.message);
      process.exit(1);
    }
  });

program
  .command("send")
  .option('-i, --input <json>','Path for the annotations.json file to send from',process.env.ANNOTATIONS_FILE)
  .option('-t, --token <token>', 'Hardcover API token', process.env.HARDCOVER_API_TOKEN)
  .option('-a, --api <apiUrl>', 'Hardcover API url', process.env.HARDCOVER_API_URL)
  .description("Send any updated annotations to Hardcover")
  .action(async ({input, token, api}) => {
    try {
      console.log("send to hardcover command called");
      await syncAllAnnotations({
        annotationsFile: input,
        apiToken: token,
        apiUrl: api
      });
    } catch (error) {
      console.error("Error syncing annotations:", error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);