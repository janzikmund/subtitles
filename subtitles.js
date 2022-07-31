#!/usr/bin/env node
"use strict";

// load .env variables. Needs passing the path, otherwise node would search for .env
// in the movie folder where script command is called from
require('dotenv').config({
	path: __dirname + '/.env'
});

var program = require('commander'),
fs = require('fs'),
_ = require('lodash'),
OS = require('opensubtitles.com'),
os = new OS({apikey: process.env.OS_APIKEY}),
OSDbHash = require("osdb-hash"),
TheMovieDatabase = require('themoviedb'),
Youtubedl = require('youtube-dl-exec'),
pluralize = require('pluralize'),
path = require('path'),
request = require('request'),

// main launch script
run = function() {
	// setup application
	program
	.version('0.1.0')
	.usage('[options] <file ...>')
	.description('Downloads subtitles and trailer for movie.')
	.option('-t, --trailer', 'Download just trailer')
	.option('-s, --subtitles', 'Download just subtitles')
	.parse(process.argv);

	// if any files provided, take them as files to be searched for,
	if(program.args.length > 0) {
		parseSpecifiedFiles(program.args, program.trailer, program.subtitles);
	} else {
		parseActualFolder(program.opts().trailer, program.opts().subtitles);
	}
},

// parse files in actual folder to find biggest one
parseActualFolder = function(trailer, subtitles) {
	var files = [];
	fs.readdir('.', (err, folder) => {
		folder.forEach(file => {
			var stats = fs.statSync(file);
			files.push({ 'name': file, 'size': stats.size, 'stats' : stats });
		});

		// take biggest file
		files = _.orderBy(files, 'size', 'desc');

		// download subtitles if set or no param specified
		if(subtitles || (!subtitles && !trailer)) {
			searchSubtitles(files[0]);
		}
		// download trailer if set or no param specified
		if(trailer || (!subtitles && !trailer)) {
	  		downloadTrailer(files[0]);
	 	}
	});
},

// parse files specified as parameters
parseSpecifiedFiles = function(filenames, trailer, subtitles) {
	filenames.forEach(file => {
		var stats = fs.statSync(file),
		file = { 'name': file, 'size': stats["size"], 'stats' : stats };

		// subtitles if not excluded
		if(subtitles || (!subtitles && !trailer)) {
			searchSubtitles(file);
		}

		// trailer if turned on
		if(trailer || (!subtitles && !trailer)) {
			downloadTrailer(file);
		}
	});

},

// guess movie name from its filename
guessMovieName = function(filename) {
	filename = filename.split('/').pop() 	// just take last file if any folders present
		.split(/\d\d\d/).shift()				// if there is number of three decimals, take everything before
		.replace(/[^\w\d]/gi, ' ');
		return filename.trim();
},

bytesToSize = function(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return 'n/a';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  if (i === 0) return `${bytes} ${sizes[i]})`;
  return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`;
},

// download subtitles from API
searchSubtitles = async function (file) {
	var hash = await countMovieHash(file),
		searchParams = {
			query: file.name,
			moviehash: hash,
			languages: process.env.OS_LANG,
		};

	console.log(`Signing In for OpenSubtitles API`);
	try {
		let response = await os.login({
			username: process.env.OS_USER,
			password: process.env.OS_PASS
		});
		console.log(`Success, received JWT token ${response.token}`);

	} catch(err) {
		console.log(err);
	}

	console.log(`Searching subtitles for ${file.name}`);

	os.subtitles(searchParams).then(response => {
		let subtitles = response.data;
		if(subtitles.length > 0) {
			storeSubtitles(subtitles.slice(0, 5), file);
		} else {
			throw 'No subtitle found';
		}
	})
	// catch if no subtitles found or other error and display it
	.catch(err => {
		var filename_base = file.name.substring(0, file.name.lastIndexOf(".") ),
		movie_name = guessMovieName(filename_base);
		console.log('[ ' + movie_name + ' ]  Error: ' + err);
	});

},

countMovieHash = async function(file) {
	let osdb = new OSDbHash(`./${file.name}`);
	let res = await osdb.compute( (hash) => hash);
	return res;
},

storeSubtitles = function(subtitles, file) {
		var i = '1',
		filename_base = file.name.substring(0, file.name.lastIndexOf(".") ),
		suffix = '',
		movie_name = guessMovieName(filename_base);

		console.log('[ ' + movie_name + ' ]  -- Subtitle found --');

		subtitles.forEach((subtitle) => {
			// resolve filename
			var filename = './' + filename_base + suffix + '.srt';

			setTimeout(filename => {
				// resolve download URL
				os.download({
	  				file_id: subtitle.attributes.files[0].file_id,
	  			}).then(downloadResponse => {
					request(downloadResponse.link, (error, response, data) => {
						if (error) { throw error; }

						// skip file if exists already
						if(fs.existsSync(filename)) {
							console.log('[ ' + movie_name + ' ]  Subtitle file already exists, skipping: ' + filename);
							return;
						}

						fs.writeFile(filename, data, function(err) {
							if(err) {
								throw error;
							}
							console.log('[ ' + movie_name + ' ]  Subtitles downloaded: ' + filename);
						});

						// some legacy code from old version if it was still any relevant, will be removed fully in future versions
						/* 
						// set default encoding if not in subtitle
						if(typeof subtitle.encoding === undefined || (subtitle.encoding !=='ascii' && subtitle.encoding !=='utf8' && subtitle.encoding !=='ascii'  && subtitle.encoding !=='ucs2'  && subtitle.encoding !=='latin1') ) { subtitle.encoding = 'utf8'; }
						require('zlib').unzip(data, (error, buffer) => {
							if (error) { throw error; }

							// skip file if exists already
							if(fs.existsSync(filename)) {
								console.log('[ ' + movie_name + ' ]  Subtitle file already exists, skipping: ' + filename);
								return;
							}

							// store subtitles
							const subtitle_content = buffer.toString(subtitle.encoding);
							fs.writeFile(filename, subtitle_content, function(err) {
								if(err) {
									throw error;
								}
								console.log('[ ' + movie_name + ' ]  Subtitles downloaded: ' + filename);
							});
						});
						*/				
					});
	  			}).catch(console.error);
			}, (i-1) * 1000, filename);

			/*
			((filename) => {
				// resolve download URL
				os.download({
	  				file_id: subtitle.attributes.files[0].file_id,
	  			}).then(downloadResponse => {
					request(downloadResponse.link, (error, response, data) => {
						if (error) { throw error; }

						// skip file if exists already
						if(fs.existsSync(filename)) {
							console.log('[ ' + movie_name + ' ]  Subtitle file already exists, skipping: ' + filename);
							return;
						}

						fs.writeFile(filename, data, function(err) {
							if(err) {
								throw error;
							}
							console.log('[ ' + movie_name + ' ]  Subtitles downloaded: ' + filename);
						});

						// some legacy code from old version if it was still any relevant, will be removed fully in future versions
						/* 
						// set default encoding if not in subtitle
						if(typeof subtitle.encoding === undefined || (subtitle.encoding !=='ascii' && subtitle.encoding !=='utf8' && subtitle.encoding !=='ascii'  && subtitle.encoding !=='ucs2'  && subtitle.encoding !=='latin1') ) { subtitle.encoding = 'utf8'; }
						require('zlib').unzip(data, (error, buffer) => {
							if (error) { throw error; }

							// skip file if exists already
							if(fs.existsSync(filename)) {
								console.log('[ ' + movie_name + ' ]  Subtitle file already exists, skipping: ' + filename);
								return;
							}

							// store subtitles
							const subtitle_content = buffer.toString(subtitle.encoding);
							fs.writeFile(filename, subtitle_content, function(err) {
								if(err) {
									throw error;
								}
								console.log('[ ' + movie_name + ' ]  Subtitles downloaded: ' + filename);
							});
						});
					});
	  			}).catch(console.error);

			})(filename);
						*/				

			// raise index and suffix
			i++;
			suffix = '.v-' + i;
		});
},

// store file from youtube
storeYoutubeFile = async function(url, movieName, file) {
	var targetFile = path.dirname(process.cwd() + '/' + file.name) + '/_trailer.%(ext)s';

	// skip download if exists already
	if(fs.existsSync(targetFile)) {
		console.log('[ ' + movieName + ' ]  Trailer already exists, skipping: ' + targetFile);
		return;
	}

	let videoData = await Youtubedl(url, {
		dumpSingleJson: true,
		noWarnings: true,
		noCallHome: true,
		noCheckCertificate: true,
		preferFreeFormats: true,
		youtubeSkipDashManifest: true,
		referer: url
	});

	console.log(`[ ${movieName} ]  Downloading trailer from ${videoData.title}`);
	Youtubedl(url, {
		noWarnings: true,
		noCallHome: true,
		noCheckCertificate: true,
		preferFreeFormats: true,
		youtubeSkipDashManifest: true,
		referer: url,
		o: targetFile,
		mergeOutputFormat: 'mkv',
	}).then(output => {
		console.log(`[ ${movieName} ]  Trailer downloaded.`);
	});
},

// filter multiple videos returned to find best matching trailer
chooseBestTrailer = function(videos) {
	var filtered;

	filtered = _.filter(videos, o => _.includes(_.lowerCase(o.name), 'official trailer') );
	if(filtered.length > 0) return filtered[0];

	filtered = _.filter(videos, o => _.includes(_.lowerCase(o.name), 'trailer') );
	if(filtered.length > 0) return filtered[0];

	// return what we have
	return videos[0];
},

// download trailer for movie
downloadTrailer = function(file) {
	var movieName = guessMovieName(file.name),
	client = new TheMovieDatabase(process.env.TMD_APIKEY);

	console.log(`[ ${movieName} ]  Searching for trailer`);

	// search for movies
	client.searchMovies({
		query: movieName,
		sortBy: 'popularity.desc',
		includeAdult: false
	}, function(err, movies) {
		if(movies.length > 0) {
			console.log(`[ ${movieName} ]  Movie found in database: ${movies[0].title}`);
			console.log(`[ ${movieName} ]  Year ${movies[0].year}, Rating ${movies[0].voteAverage}`);

			// grab trailers
			client.getVideosOfMovie(movies[0].id, function(err, res) {
				if(res.videos.length > 0) {
			    	console.log(`[ ${movieName} ]  ${pluralize('trailer', res.videos.length, true)} found.`);

					// determine video and download it
					var video = (res.videos.length === 1 ? res.videos[0] : chooseBestTrailer(res.videos));
			    	storeYoutubeFile(video.url, movieName, file);
				} else {
					console.log(`[ ${movieName} ]  No trailers found for the movie.`);
				}
			});
		} else {
			console.log(`[ ${movieName} ]  Movie not found in database.`);
		}
	});
};

// run command
run();
