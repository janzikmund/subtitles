# Subtitles
Node.js script to automatically search and download movie subtitles from command line.

## Installation
- clone the project
- cd into the project folder and install dependencies
```bash
cd subtitles
npm install
```

## Configuration
- register for your API user account on [opensubtitles](https://www.opensubtitles.org)
- apply for user agent as described in [opensubtitles docs](http://trac.opensubtitles.org/projects/opensubtitles/wiki/DevReadFirst)
- create `.env` file in project folder containing your login credentials
```
USER=Your Username
PASS=Your Password
LANG=eng
USER_AGENT=Your User Agent
```
- install it as NPM global package so you can use it anywhere
```bash
npm install -g
```

## Usage
- once globally installed, in any folder type "subtitles" in terminal to search for subtitles
- script will automatically find the largest video file and queries open subtitles using file name, size and hash
- if subtitles are found, up to five of them are downloaded, first one having the same name as movie file, the other having a number suffix

## Modifications, enhancements
- I will be happy to accept pull requests
- don't forget that if you modify the script, you have to always call `npm install -g` to push the changes into global package