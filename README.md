# kobo-sync

A command line tool to download your highlights from your Kobo device over USB and optionally sync them to your [hardcover.app](https://hardcover.app/) reading journal.

## Setup

First, set up your configuration (you only need to do this once):
```bash
npx kobo-sync login
```

The login command accepts the following options:
- `--db <path>`: Kobo SQLite database path
- `--json <path>`: Path for the annotations.json file
- `--token <token>`: Hardcover API token
- `--api <url>`: Hardcover API URL

## Usage

Each command accepts a `-h` flag if you need more information, but once you've set up your config you can:

1. Extract annotations from your Kobo device:
   ```bash
   npx kobo-sync device
   ```

2. Sync annotations to Hardcover (optional):
   ```bash
   npx kobo-sync hardcover
   ```