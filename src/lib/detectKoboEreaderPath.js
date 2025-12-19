import drivelist from "drivelist";
import fs from "node:fs/promises";
import path from "node:path";

const SQLITE_PATH = ".kobo/KoboReader.sqlite";

export default async function detectKoboEreaderPath() {
  const drives = await drivelist.list();

  // 1. Map drives to their potential SQLite paths
  const matchingDrives = (
    await Promise.all(
      drives
        .filter((drive) => drive.mountpoints.length > 0)
        .map(async (drive) => {
          const mountPath = drive.mountpoints[0].path;
          const fullSqlitePath = path.join(mountPath, SQLITE_PATH);

          try {
            await fs.access(fullSqlitePath);
            return fullSqlitePath; // File exists
          } catch {
            return null; // File does not exist
          }
        })
    )
  ).filter(Boolean);

  const matchingPath = matchingDrives.length > 0 ? matchingDrives[0] : null;

  if (matchingPath) {
    console.info(`Found kobo database at ${matchingPath}`);
  }
  return matchingPath;
}
