# Subtitles
Node.js script to automatically search and download movie subtitles from command line.

## Installation
- clone the project
- cd into the project folder and install dependencies
```bash
git clone git@github.com:janzikmund/subtitles.git
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

### Make it accessible globally - using symlink
- preferred way, just simlink `subtitles.js` in project folder to any bin folder in your `$PATH`
```bash
ln -s /Users/<path/to/project>/subtitles.js /Users/<username>/bin/subtitles
```

### Make it accessible globally - using NPM
- install project as NPM global package
```bash
npm install -g
```
- in this case if you modify the script, you will have to always call `npm install -g` while in project folder to push your changes to the global namespace

## Usage

### Default
Once globally installed, in any folder type `subtitles` in terminal to search for subtitles, script will automatically find the largest video in the directory and will query open subtitles using file name, size and hash.

```console
$ subtitles
```

### File(s) as parameter
You can pass any filename or multiple files as parameters

```console
$ subtitles movie1/movie1.mp4 movie2/movie2.mp4
```

### Shell expansion, find
Use shell expansion or find command to pass multiple folders and files. Following example will browse current folder and subfolders for all *.mp4 files larger than 1GB and downloads subtitles for them: 

```console
$ find . -name "*.mp4" -size +2G -exec subtitles {} +
```

### Multiple subtitles found
If subtitles are found, up to five of them are downloaded and unzipped in the folder. First file will have the same name as movie file, the other having a number suffix.

## Modifications, enhancements
- I will be happy to accept pull requests
