import { program } from "commander";
import path from "node:path";
import Conf from 'conf';
import extractAnnotations from './lib/getAnnotations.js';
import syncAllAnnotations from './lib/syncAll.js';
import packageJson from '../package.json' with {type:'json'}
import detectKoboEreaderPath from "./lib/detectKoboEreaderPath.js";

const schema = {
	annotationsFilePath: {
		type: 'string',
		default: 'annotations.json'
	},
	koboDbPath: {
		type: 'string',
		default: 'autodetect'
	},
	hardcoverApiToken: {
		type: 'string'
	},
	hardcoverApiUrl: {
		type: 'string',
		default: 'https://api.hardcover.app/v1/graphql'
	}
};

const config = new Conf({
	projectName: packageJson.name,
	schema
});


program
  .command("login")
  .description("Set configuration values (or blank string to reset)")
  .option('-d, --db <path>', 'Kobo SQLite database path')
  .option('-j, --json <path>', 'Path for the annotations.json file')
  .option('-t, --token <token>', 'Hardcover API token')
  .option('-a, --api <url>', 'Hardcover API URL')
  .action(({db, output, token, api}) => {
    if (typeof db !== 'undefined') {
      config.set('koboDbPath', db||schema.koboDbPath.default);
      console.log("Kobo database path saved");
    }
    if (typeof output !== 'undefined') {
      config.set('annotationsFilePath', output||schema.annotationsFilePath.default);
      console.log("Annotations file path saved");
    }
    if (typeof token !== 'undefined') {
      config.set('hardcoverApiToken', token);
      console.log("Hardcover API token saved");
    }
    if (typeof api !== 'undefined') {
      config.set('hardcoverApiUrl', api||schema.hardcoverApiUrl.default);
      console.log("Hardcover API URL saved");
    }
    console.log("Configuration saved successfully");
  });

program
  .command("device")
  .option('-i, --input <sqlite>','Kobo SQLite database. Leave blank for auto-detect.', config.get('koboDbPath'))
  .option('-o, --out <json>','Path for the annotations.json file to create or update', config.get('annotationsFilePath'))
  .description("Read a Kobo sqlite database and extract all the annotations")
  .action(async ({input, out}) => {
    const dbPath = input === 'autodetect' ?
      await detectKoboEreaderPath() : 
      path.resolve(process.cwd(), input);

    try {
      await extractAnnotations({
        dbPath,
        outputFile: path.resolve(process.cwd(), out)
      });
    } catch (error) {
      console.error("Error extracting annotations:", error.message);
      process.exit(1);
    }
  });

program
  .command("hardcover")
  .option('-i, --input <json>','Path for the annotations.json file to send from', config.get('annotationsFilePath'))
  .option('-t, --token <token>', 'Hardcover API token', config.get('hardcoverApiToken'))
  .option('-a, --api <apiUrl>', 'Hardcover API url', config.get('hardcoverApiUrl'))
  .description("Send any updated annotations to Hardcover")
  .action(async ({input, token, api}) => {
    try {
      await syncAllAnnotations({
        annotationsFile: path.resolve(process.cwd(), input),
        apiToken: token,
        apiUrl: api
      });
    } catch (error) {
      console.error("Error syncing annotations:", error.message);
      process.exit(1);
    }
  });

program
  .command("migrate")
  .description("Print all config options as command line arguments for migration to a new device")
  .action(() => {
    const args = [
      ['--db', config.get('koboDbPath')],
      ['--json', config.get('annotationsFilePath')],
      ['--token', config.get('hardcoverApiToken')],
      ['--api', config.get('hardcoverApiUrl')]
    ]
      .filter(([flag, value]) => value !== undefined)
      .map(([flag, value]) => `${flag} "${String(value).replace(/"/g, '\\"')}"`)
      .join('\\\n');

    console.log(`login ${args}`);
  });

program.parse(process.argv);