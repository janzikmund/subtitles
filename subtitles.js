#!/usr/bin/env node

// load .env variables
require('dotenv').load();

var program = require('commander'),
fs = require('fs'),
_ = require('lodash'),
OS = require('opensubtitles-api'),
OpenSubtitles = new OS('White Box App'),

// main launch script
run = function() {
	// setup application
	program
	.version('0.1.0')
	.usage('[options] <file ...>')
	.description('Download subtitles for movie. Can also download trailers.')
	.option('-t, --trailer', 'Also download movie trailer')
	.parse(process.argv);

	// if any files provided, take them as files to be searched for,
	if(program.args.length > 0) {
		parseSpecifiedFiles(program.args, program.trailer);
	} else {
		parseActualFolder(program.trailer);
	}
},

// parse files in actual folder to find biggest one
parseActualFolder = function(trailer) {
	var files = [];
	fs.readdir('.', (err, folder) => {
		folder.forEach(file => {
			var stats = fs.statSync(file);
			files.push({ 'name': file, 'size': stats["size"], 'stats' : stats });
		});

		// take biggest file
		files = _.orderBy(files, 'size', 'desc');
		searchSubtitles(files[0]);

		// download trailer if turned on
		if(trailer) {
	  		downloadTrailer(files[0]);
	 	}
	});
},

// parse files specified as parameters
parseSpecifiedFiles = function(filenames, trailer) {
	filenames.forEach(file => {
		var stats = fs.statSync(file),
		file = { 'name': file, 'size': stats["size"], 'stats' : stats };

		searchSubtitles(file);

		// trailer if turned on
		if(trailer) {
			downloadTrailer(file);
		}
	});

},

// guess movie name from its filename
guessMovieName = function(filename) {
	filename = filename.split('/').pop() 	// just take last file if any folders present
		.split(/\d/).shift()				// if there is number, take everything before
		.replace(/[^\w\d]/gi, ' ');
		return filename;
},

// output to console and voice
say = function(msg) {
	const { exec } = require('child_process');

	exec('say "' + msg + '"', (err, stdout, stderr) => {
		if (err) {
			// node couldn't execute the command
			return;
		}
	});
},

// download subtitles from API
searchSubtitles = function (file) {
	console.log('Searching subtitles for ', file.name);
	// say('Searching for subtitles');

	OpenSubtitles.api.LogIn(process.env.USER, process.env.PASS, process.env.LANG, process.env.USER_AGENT).then(res => {
		OpenSubtitles.search({
			sublanguageid: 'eng',    // Can be an array.join, 'all', or be omitted.
			filesize: file.size,     // Total size, in bytes.
			path: './' + file.name,  // Complete path to the video file, it allows to automatically calculate 'hash'.
			filename: file.name,     // The video file name. Better if extension is included.
			extensions: ['srt'],     // Accepted extensions, defaults to 'srt'.
			limit: '5',              // Limit the number of results
			gzip: true               // Returns url to gzipped subtitles, defaults to false
		}).then(subtitles => {
			var i = '1',
			filename_base = file.name.substring(0, file.name.lastIndexOf(".") ),
			suffix = '',
			movie_name = guessMovieName(filename_base);

			// if english subtitles, download them
			if (subtitles.en) {
				console.log('[ ' + movie_name + ' ] ' + ' -- Subtitle found --');
				// say('Subtitles found, downloading them for you now. Enjoy the movie bro!');
				subtitles.en.forEach( subtitle => {
					// resolve filename
					var filename = './' + filename_base + suffix + '.srt';

					require('request')({
						url: subtitle.url,
						encoding: null
					}, (error, response, data) => {
						if (error) throw error;
						// set default encoding if not in subtitle
						if(typeof subtitle.encoding === undefined || (subtitle.encoding !=='ascii' && subtitle.encoding !=='utf8' && subtitle.encoding !=='ascii'  && subtitle.encoding !=='ucs2'  && subtitle.encoding !=='latin1') ) subtitle.encoding = 'utf8';
						require('zlib').unzip(data, (error, buffer) => {
							if (error) throw error;
							const subtitle_content = buffer.toString(subtitle.encoding);
							fs.writeFile(filename, subtitle_content, function(err) {
								if(err) {
									throw error;
								}
								console.log('[ ' + movie_name + ' ] ' + ' Subtitles downloaded: ' + filename);
							});
						});
					});

					// raise index and suffix
					i++;
					suffix = '.v-' + i;
				});

			} else {
				throw 'No subtitle found';
			}
		})
		// catch if no subtitles found or other error and display it
		.catch(err => {
			var filename_base = file.name.substring(0, file.name.lastIndexOf(".") ),
			movie_name = guessMovieName(filename_base);
			console.log('[ ' + movie_name + ' ] ' + ' Error: ' + err);
		});
	});
},

// download trailer for movie
downloadTrailer = function(file) {
	// @todo
	console.log('Downloading trailer for ' + file.name);
};

// run command
run();
